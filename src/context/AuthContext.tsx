import React, { createContext, useContext, useMemo } from "react";
import { User } from "firebase/auth";

// 1. DEFINE INTERFACES FIRST
interface CustomClaims {
  // Added 'state_admin' here to resolve the comparison error
  role?:
    | "admin"
    | "user"
    | "editor"
    | "state_admin"
    | "county_admin"
    | "chairman"
    | "committeeman";
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  claims: CustomClaims | null;
  role: string | null;
  isAdmin: boolean;
  isStateAdmin: boolean; // Added for convenience
  isLoaded: boolean;
}

// 2. CREATE CONTEXT SECOND (Now it knows what AuthContextType is)
const AuthContext = createContext<AuthContextType | null>(null);

// 3. EXPORT HOOK
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

// 4. DEFINE PROVIDER
export const AuthProvider: React.FC<{
  children: React.ReactNode;
  user: User | null;
  claims: CustomClaims | null;
}> = ({ children, user, claims }) => {
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
