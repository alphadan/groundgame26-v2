import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, onIdTokenChanged, getIdTokenResult } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore"; // Add these
import { auth, db } from "../lib/firebase"; // Ensure db is exported from your firebase lib
import { Box, Typography, Button, CircularProgress } from "@mui/material";

export type ValidRole =
  | "developer"
  | "state_admin"
  | "county_chair"
  | "area_chair"
  | "state_rep_district"
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
  permissions?: {
    can_manage_team: boolean;
    can_create_users: boolean;
    can_manage_resources: boolean;
    can_upload_collections: boolean;
    can_create_collections: boolean;
    can_create_documents: boolean;
  };
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
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 1. Primary Auth Listener
  useEffect(() => {
    const unsubscribeAuth = onIdTokenChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          const tokenResult = await getIdTokenResult(currentUser);
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

    return () => unsubscribeAuth();
  }, []);

  // 2. Claims Sync Listener (Watches for the Cloud Function's signal)
  useEffect(() => {
    if (!user?.uid) return;

    // Listen to the user's doc for the 'last_claims_sync' timestamp change
    const unsubscribeDoc = onSnapshot(
      doc(db, "users", user.uid),
      async (snapshot) => {
        const data = snapshot.data();
        if (data?.last_claims_sync) {
          console.log("🔄 Role change detected, refreshing token...");
          // Force refresh the token to pick up new claims
          const tokenResult = await getIdTokenResult(user, true);
          setClaims(tokenResult.claims as CustomClaims);
        }
      }
    );

    return () => unsubscribeDoc();
  }, [user?.uid]);

  const contextValue = useMemo<AuthContextType>(() => {
    const safeRole = (claims?.role as ValidRole) ?? "base";
    return {
      user,
      claims: claims ?? null,
      role: safeRole,
      isAdmin: safeRole === "state_admin" || safeRole === "developer",
      isLoaded,
      isLoading,
      error,
    };
  }, [user, claims, isLoaded, isLoading, error]);

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
