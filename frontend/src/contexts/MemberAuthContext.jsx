import { createContext, useContext, useState, useEffect, useMemo } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/member`;

const MemberAuthContext = createContext(null);

// Create a separate axios instance for member portal
const memberAxios = axios.create();

export function MemberAuthProvider({ children }) {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  // Update axios header when token changes
  const setMemberToken = (token) => {
    if (token) {
      memberAxios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      // Also set on global axios for backward compatibility with existing API calls
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete memberAxios.defaults.headers.common["Authorization"];
      delete axios.defaults.headers.common["Authorization"];
    }
  };

  const fetchMemberProfile = async () => {
    try {
      const token = localStorage.getItem("member_token");
      if (!token) {
        setLoading(false);
        return;
      }
      
      setMemberToken(token);
      const response = await memberAxios.get(`${API}/me`);
      setMember(response.data);
    } catch (error) {
      // Token invalid, clear it
      localStorage.removeItem("member_token");
      setMemberToken(null);
      setMember(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem("member_token");
    if (token) {
      setMemberToken(token);
      fetchMemberProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/login`, { email, password });
      const { access_token, member: memberData } = response.data;
      
      if (!access_token || !memberData) {
        throw new Error('Invalid response from server');
      }
      
      localStorage.setItem("member_token", access_token);
      setMemberToken(access_token);
      setMember(memberData);
      
      return memberData;
    } catch (error) {
      console.error('Member login error:', error);
      throw error;
    }
  };

  const register = async (email, password) => {
    const response = await axios.post(`${API}/register`, { email, password });
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem("member_token");
    setMemberToken(null);
    setMember(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    await memberAxios.post(`${API}/change-password`, {
      current_password: currentPassword,
      new_password: newPassword
    });
  };

  const value = useMemo(() => ({
    member,
    loading,
    login,
    register,
    logout,
    changePassword,
    isAuthenticated: !!member,
    refreshProfile: fetchMemberProfile
  }), [member, loading]);

  return (
    <MemberAuthContext.Provider value={value}>
      {children}
    </MemberAuthContext.Provider>
  );
}

export function useMemberAuth() {
  const context = useContext(MemberAuthContext);
  if (!context) {
    throw new Error("useMemberAuth must be used within MemberAuthProvider");
  }
  return context;
}
