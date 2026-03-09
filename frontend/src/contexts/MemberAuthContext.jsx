import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/member`;

const MemberAuthContext = createContext(null);

export function MemberAuthProvider({ children }) {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem("member_token");
    if (token) {
      // Set default auth header
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      // Verify token by fetching member profile
      fetchMemberProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchMemberProfile = async () => {
    try {
      const response = await axios.get(`${API}/me`);
      setMember(response.data);
    } catch (error) {
      // Token invalid, clear it
      localStorage.removeItem("member_token");
      delete axios.defaults.headers.common["Authorization"];
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/login`, { email, password });
    const { access_token, member: memberData } = response.data;
    
    localStorage.setItem("member_token", access_token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setMember(memberData);
    
    return memberData;
  };

  const register = async (email, password) => {
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

  const value = {
    member,
    loading,
    login,
    register,
    logout,
    changePassword,
    isAuthenticated: !!member,
    refreshProfile: fetchMemberProfile
  };

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
