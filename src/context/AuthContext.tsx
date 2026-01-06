// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, onIdTokenChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Box, Typography, Button } from "@mui/material";

export type ValidRole =
  | "state_admin"
  | "county_chair"
  | "area_chair"
  | "candidate"
  | "ambassador"
  | "committeeperson"
  | "user"
  | "base";

export interface CustomClaims {
  role?: ValidRole;
  roles?: string[];
  org_id?: string;
  counties?: string[];
  areas?: string[];
  precincts?: string[];
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  claims: CustomClaims | null;
  role: ValidRole;
  isAdmin: boolean;
  isLoaded: boolean; // True once we've checked auth at least once
  isLoading: boolean; // Currently fetching
  error: Error | null;
}

const defaultContext: AuthContextType = {
  user: null,
  claims: null,
  role: "base",
  isAdmin: false,
  isLoaded: false,
  isLoading: true,
  error: null,
};

const AuthContext = createContext<AuthContextType>(defaultContext);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  return context ?? defaultContext;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<CustomClaims | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    console.log("🔥 AuthProvider: Setting up listener");

    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      try {
        // 1. HARD GUARD: If the UID hasn't changed, do absolutely nothing.
        // This stops background refreshes from causing a re-render.
        if (currentUser?.uid === user?.uid && claims) {
          return;
        }

        // 2. Only clear/set loading if the user actually changed (login/logout)
        setIsLoading(true);
        setError(null);

        if (currentUser) {
          let tokenResult = await currentUser.getIdTokenResult();

          if (!tokenResult.claims.role) {
            console.log("🔑 Missing role, refreshing...");
            tokenResult = await currentUser.getIdTokenResult(true);
          }

          // 3. Update state only once for the new user
          setUser(currentUser);
          setClaims(tokenResult.claims as CustomClaims);
        } else {
          setUser(null);
          setClaims(null);
        }
      } catch (err: any) {
        console.error("❌ Auth Error:", err);
        setError(err);
      } finally {
        setIsLoading(false);
        setIsLoaded(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const contextValue = useMemo<AuthContextType>(() => {
    const safeRole = (claims?.role as ValidRole) ?? "base";
    return {
      user,
      claims: claims ?? null,
      role: safeRole,
      isAdmin: safeRole === "state_admin",
      isLoaded,
      isLoading,
      error,
    };
  }, [user, claims, isLoaded, isLoading, error]);

  // Handle fatal errors only here.
  // We removed the isLoading spinner to let App.tsx manage the UI.
  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        p={3}
      >
        <Typography variant="h5" color="error" gutterBottom>
          Auth Error
        </Typography>
        <Typography variant="body1">{error.message}</Typography>
        <Button
          variant="contained"
          onClick={() => window.location.reload()}
          sx={{ mt: 3 }}
        >
          Reload
        </Button>
      </Box>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
