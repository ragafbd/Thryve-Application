import { createContext, useContext, useState, useEffect, useMemo } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/member`;

const MemberAuthContext = createContext(null);

export function MemberAuthProvider({ children }) {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMemberProfile = async (token) => {
    try {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const response = await axios.get(`${API}/me`);
      setMember(response.data);
      return true;
    } catch (error) {
      // Token invalid, clear everything
      localStorage.removeItem("member_token");
      delete axios.defaults.headers.common["Authorization"];
      setMember(null);
      return false;
    }
  };

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem("member_token");
    if (token) {
      fetchMemberProfile(token).finally(() => setLoading(false));
    } else {
      // No stored credentials
      localStorage.removeItem("member_token");
      delete axios.defaults.headers.common["Authorization"];
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    // IMPORTANT: Clear any existing auth headers before login attempt
    delete axios.defaults.headers.common["Authorization"];
    localStorage.removeItem("member_token");
    
    try {
      const response = await axios.post(`${API}/login`, { email, password });
      const { access_token, member: memberData } = response.data;
      
      if (!access_token || !memberData) {
        throw new Error('Invalid response from server');
      }
      
      localStorage.setItem("member_token", access_token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      setMember(memberData);
      
      return memberData;
    } catch (error) {
      // Make sure headers are cleared on error
      delete axios.defaults.headers.common["Authorization"];
      throw error;
    }
  };

  const register = async (email, password) => {
    // Clear headers for registration too
    delete axios.defaults.headers.common["Authorization"];
    const response = await axios.post(`${API}/register`, { email, password });
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem("member_token");
    delete axios.defaults.headers.common["Authorization"];
    setMember(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    await axios.post(`${API}/change-password`, {
      current_password: currentPassword,
      new_password: newPassword
    });
  };

  const refreshProfile = async () => {
    const token = localStorage.getItem("member_token");
    if (token) {
      await fetchMemberProfile(token);
    }
  };

  const value = useMemo(() => ({
    member,
    loading,
    login,
    register,
    logout,
    changePassword,
    isAuthenticated: !!member,
    refreshProfile
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
