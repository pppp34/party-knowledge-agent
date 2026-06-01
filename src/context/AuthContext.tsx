import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, AuthResponse, LoginRequest, RegisterRequest } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'party_agent_token';
const USER_KEY = 'party_agent_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated = !!token && !!user;

  // 验证 token 有效性
  useEffect(() => {
    if (token && !user) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Token invalid');
        })
        .then(userData => {
          const u: User = {
            id: userData.id,
            username: userData.username,
            displayName: userData.displayName,
            role: userData.role,
            branchName: userData.branchName
          };
          setUser(u);
          localStorage.setItem(USER_KEY, JSON.stringify(u));
        })
        .catch(() => {
          // Token 无效，清除
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
        });
    }
  }, [token, user]);

  const login = useCallback(async (data: LoginRequest) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || '登录失败');
      }

      const authRes: AuthResponse = result;
      setToken(authRes.token);
      setUser(authRes.user);
      localStorage.setItem(TOKEN_KEY, authRes.token);
      localStorage.setItem(USER_KEY, JSON.stringify(authRes.user));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || '注册失败');
      }

      const authRes: AuthResponse = result;
      setToken(authRes.token);
      setUser(authRes.user);
      localStorage.setItem(TOKEN_KEY, authRes.token);
      localStorage.setItem(USER_KEY, JSON.stringify(authRes.user));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isLoading, login, register, logout }}>
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

export default AuthContext;
