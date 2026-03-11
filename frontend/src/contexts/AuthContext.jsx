import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

// Create a separate axios instance for admin
const adminAxios = axios.create();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Update axios default header when token changes
  const setAuthToken = (token) => {
    if (token) {
      adminAxios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Also set on global axios for backward compatibility
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete adminAxios.defaults.headers.common['Authorization'];
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  useEffect(() => {
    // Check for stored token on mount
    const token = localStorage.getItem('thryve_token');
    const storedUser = localStorage.getItem('thryve_user');
    
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setAuthToken(token);
        
        // Verify token is still valid
        adminAxios.get(`${API}/auth/me`)
          .then(res => {
            setUser(res.data);
            localStorage.setItem('thryve_user', JSON.stringify(res.data));
          })
          .catch(() => {
            // Token invalid, clear storage
            logout();
          })
          .finally(() => setLoading(false));
      } catch (e) {
        // Invalid JSON in storage
        logout();
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;
      
      if (!access_token || !userData) {
        throw new Error('Invalid response from server');
      }
      
      // Store token and user
      localStorage.setItem('thryve_token', access_token);
      localStorage.setItem('thryve_user', JSON.stringify(userData));
      
      // Set auth header
      setAuthToken(access_token);
      
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('thryve_token');
    localStorage.removeItem('thryve_user');
    setAuthToken(null);
    setUser(null);
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    const permissions = {
      admin: ['all'],
      staff: ['create_invoice', 'view_invoice', 'view_client', 'create_client', 'download_pdf', 'bulk_invoice'],
      viewer: ['view_invoice', 'view_client', 'download_pdf']
    };
    const userPerms = permissions[user.role] || [];
    return userPerms.includes('all') || userPerms.includes(permission);
  };

  const isAdmin = () => user?.role === 'admin';

  const value = useMemo(() => ({
    user,
    login,
    logout,
    loading,
    hasPermission,
    isAdmin
  }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
