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

// === Strict Types ===
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
  isLoaded: boolean; // Auth fully resolved (success or error)
  isLoading: boolean; // Auth in progress
  error: Error | null;
}

// === Safe Default Context (prevents crashes) ===
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

/**
 * Safe hook – never throws, returns defaults if misused
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  return context ?? defaultContext;
};

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider – Self-contained, listens to Firebase auth state
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
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
            try {
              const tokenResult = await currentUser.getIdTokenResult();
              const safeClaims: CustomClaims = tokenResult.claims ?? {};

              // Defensive claim validation
              if (safeClaims.role && !isValidRole(safeClaims.role)) {
                console.warn("Invalid role claim received:", safeClaims.role);
                safeClaims.role = "base";
              }

              setClaims(safeClaims);
            } catch (tokenErr) {
              console.error("Failed to fetch ID token claims:", tokenErr);
              setClaims({});
            }
          } else {
            setClaims(null);
          }

          setUser(currentUser);
        } catch (err) {
          setError(
            err instanceof Error ? err : new Error("Authentication state error")
          );
          setUser(null);
          setClaims(null);
        } finally {
          setIsLoading(false);
        }
      },
      (authErr) => {
        setError(
          authErr instanceof Error ? authErr : new Error(String(authErr))
        );
        setUser(null);
        setClaims(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // === Type guard for ValidRole ===
  const isValidRole = (role: any): role is ValidRole => {
    return [
      "state_admin",
      "county_chair",
      "area_chair",
      "candidate",
      "ambassador",
      "committeeperson",
      "user",
      "base",
    ].includes(role);
  };

  const contextValue = useMemo<AuthContextType>(() => {
    const safeClaims = claims ?? {};
    const safeRole = isValidRole(safeClaims.role) ? safeClaims.role : "base";

    return {
      user,
      claims: safeClaims,
      role: safeRole,
      isAdmin: safeRole === "state_admin",
      isLoaded: !isLoading && !error,
      isLoading,
      error,
    };
  }, [user, claims, isLoading, error]);

  // === Critical Error Fallback (Layout-safe) ===
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
          {error.message || "Unknown authentication failure"}
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

  // === Loading State ===
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
