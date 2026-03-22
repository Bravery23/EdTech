import React, { createContext, useContext, useState, useEffect } from 'react';
import { Role } from '../types';

interface User {
  id: number;
  email: string;
  full_name: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  role: Role | null;
  token: string | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));

  useEffect(() => {
    // If we have a token but no user, fetch user profile
    if (token && !user) {
      fetch('http://localhost:8000/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (!res.ok) throw new Error('Token expired');
        return res.json();
      })
      .then(data => {
        setUser(data);
        setFrontendRole(data.roles || data.role);
      })
      .catch((err) => {
        console.error(err);
        logout();
      });
    }
  }, [token]);

  const setFrontendRole = (backendRoles: string[]) => {
    let userRole: Role = 'student';
    if (backendRoles.includes('admin')) userRole = 'admin';
    else if (backendRoles.includes('subject_teacher') || backendRoles.includes('homeroom_teacher')) userRole = 'teacher';
    else if (backendRoles.includes('parent')) userRole = 'parent';
    setRole(userRole);
  };

  const login = (newToken: string, userData: User) => {
    localStorage.setItem('access_token', newToken);
    setToken(newToken);
    setUser(userData);
    setFrontendRole(userData.roles || (userData as any).role);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
