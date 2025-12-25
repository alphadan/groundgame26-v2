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
import { Box, Typography, Button, CircularProgress } from "@mui/material";

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
  isLoaded: boolean;
  isLoading: boolean;
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
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(
      auth,
      async (currentUser) => {
        try {
          setIsLoading(true);
          setError(null);

          if (currentUser) {
            const tokenResult = await currentUser.getIdTokenResult();
            setClaims(tokenResult.claims as CustomClaims);
          } else {
            setClaims(null);
          }
          setUser(currentUser);
        } catch (err) {
          setError(err instanceof Error ? err : new Error("Auth error"));
          setUser(null);
          setClaims(null);
        } finally {
          setIsLoading(false);
        }
      },
      (authErr) => {
        setError(authErr instanceof Error ? authErr : new Error("Auth error"));
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const contextValue = useMemo<AuthContextType>(() => {
    const safeRole = (claims?.role as ValidRole) ?? "base";
    return {
      user,
      claims: claims ?? null,
      role: safeRole,
      isAdmin: safeRole === "state_admin",
      isLoaded: !isLoading && !error,
      isLoading,
      error,
    };
  }, [user, claims, isLoading, error]);

  if (error) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        p={3}
        textAlign="center"
      >
        <Typography variant="h5" color="error" gutterBottom>
          Authentication Error
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {error.message || "Unknown error"}
        </Typography>
        <Button
          variant="contained"
          onClick={() => window.location.reload()}
          sx={{ mt: 3 }}
        >
          Reload Page
        </Button>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress sx={{ color: "#B22234" }} />
      </Box>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
