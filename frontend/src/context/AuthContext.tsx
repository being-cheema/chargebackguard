import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface ReviewerProfile {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  token: string | null;
  reviewer: ReviewerProfile | null;
  isAuthenticated: boolean;
  login: (token: string, reviewer: ReviewerProfile) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // STRICT CONSTRAINT: React state only, ZERO localStorage or sessionStorage used.
  const [token, setToken] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState<ReviewerProfile | null>(null);

  const login = (newToken: string, newReviewer: ReviewerProfile) => {
    setToken(newToken);
    setReviewer(newReviewer);
  };

  const logout = () => {
    setToken(null);
    setReviewer(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        reviewer,
        isAuthenticated: !!token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
