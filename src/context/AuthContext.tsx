// src/context/AuthContext.tsx
import React, { createContext, useContext } from "react";
import { User } from "firebase/auth";

interface AuthContextType {
  user: User | null;
  claims: any;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  user: User | null;
  claims: any;
}> = ({ children, user, claims }) => {
  return (
    <AuthContext.Provider value={{ user, claims }}>
      {children}
    </AuthContext.Provider>
  );
};
