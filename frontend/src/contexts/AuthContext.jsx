import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored token on mount
    const token = localStorage.getItem('thryve_token');
    const storedUser = localStorage.getItem('thryve_user');
    
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      // Set default auth header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Verify token is still valid
      axios.get(`${API}/auth/me`)
        .then(res => {
          setUser(res.data);
          localStorage.setItem('thryve_user', JSON.stringify(res.data));
        })
        .catch(() => {
          // Token invalid, clear storage
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    
    // Store token and user
    localStorage.setItem('thryve_token', access_token);
    localStorage.setItem('thryve_user', JSON.stringify(userData));
    
    // Set default auth header
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('thryve_token');
    localStorage.removeItem('thryve_user');
    delete axios.defaults.headers.common['Authorization'];
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

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasPermission, isAdmin }}>
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
