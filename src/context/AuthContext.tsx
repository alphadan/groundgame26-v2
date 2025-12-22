// src/context/AuthContext.tsx

import React, { createContext, useContext, useMemo } from "react";
import { User } from "firebase/auth";

// 1. Interfaces
interface CustomClaims {
  role?:
    | "admin"
    | "user"
    | "editor"
    | "state_admin"
    | "county_admin"
    | "chairman"
    | "committeeperson"
    | "committeeman";
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  claims: CustomClaims | null;
  role: string | null;
  isAdmin: boolean;
  isStateAdmin: boolean;
  isLoaded: boolean;
}

// 2. Create Context
const AuthContext = createContext<AuthContextType | null>(null);

// 3. Custom hook (this is what you need to export!)
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// 4. Provider
interface AuthProviderProps {
  children: React.ReactNode;
  user: User | null;
  claims: CustomClaims | null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  user,
  claims,
}) => {
  const contextValue = useMemo(() => {
    const role = claims?.role || null;
    return {
      user,
      claims,
      role,
      isAdmin: role === "admin",
      isStateAdmin: role === "state_admin",
      isLoaded: !!user && !!claims,
    };
  }, [user, claims]);

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

// Optional: Export the context type if you need it elsewhere
export type { AuthContextType };
