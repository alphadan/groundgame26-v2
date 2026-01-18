// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, onIdTokenChanged, getIdTokenResult } from "firebase/auth";
import { doc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { auth, db, analytics } from "../lib/firebase";
import { setUserProperties, setUserId } from "firebase/analytics";
import { Box, Typography, Button, CircularProgress } from "@mui/material";

// Import shared interfaces from your central types file
import { UserProfile, CustomClaims, UserRole } from "../types";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  claims: CustomClaims | null;
  role: UserRole;
  isAdmin: boolean;
  isLoaded: boolean;
  isLoading: boolean;
  error: Error | null;
}

const defaultContext: AuthContextType = {
  user: null,
  userProfile: null,
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [claims, setClaims] = useState<CustomClaims | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let unsubscribeProfile: Unsubscribe | null = null;

    const unsubscribeAuth = onIdTokenChanged(auth, async (currentUser) => {
      try {
        // Clear previous profile listener if user changes
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        if (currentUser) {
          const tokenResult = await getIdTokenResult(currentUser);
          const currentClaims = tokenResult.claims as CustomClaims;

          setUser(currentUser);
          setClaims(currentClaims);

          // --- ANALYTICS SYNC ---
          if (analytics) {
            setUserId(analytics, currentUser.uid);
            setUserProperties(analytics, {
              user_role: currentClaims.role || "base",
              user_group: currentClaims.group_id || "general",
            });
          }

          // Start Firestore Profile Listener
          unsubscribeProfile = onSnapshot(
            doc(db, "users", currentUser.uid),
            async (snapshot) => {
              let profileData: UserProfile | null = null;

              if (snapshot.exists()) {
                profileData = snapshot.data() as UserProfile;
              }

              // STRATEGIC BYPASS: If Developer is missing a doc or access object,
              // hydrate a "God Mode" profile to prevent UI crashes
              if (currentClaims.role === "developer") {
                profileData = {
                  uid: currentUser.uid,
                  display_name:
                    profileData?.display_name ||
                    currentUser.displayName ||
                    "Developer Admin",
                  email: currentUser.email || "",
                  role: "developer",
                  active: true,
                  access: profileData?.access || {
                    counties: ["ALL"],
                    areas: ["ALL"],
                    precincts: ["ALL"],
                  },
                  ...profileData,
                } as UserProfile;
              }

              setUserProfile(profileData);

              // Update Analytics with geographic data once profile is loaded
              if (analytics && profileData) {
                setUserProperties(analytics, {
                  user_county: profileData.county_id || "none",
                  user_area: profileData.area_id || "none",
                });
              }

              // Force token refresh if the Cloud Function signalled a sync
              // This is critical for the "Instant Permission" UX
              if (profileData?.last_claims_sync) {
                const updatedToken = await getIdTokenResult(currentUser, true);
                setClaims(updatedToken.claims as CustomClaims);
              }

              setIsLoading(false);
              setIsLoaded(true);
            },
            (err) => {
              console.error("❌ Profile Sync Error:", err);
              setIsLoading(false);
              setIsLoaded(true);
            },
          );
        } else {
          // Reset state and Analytics on Logout
          if (analytics) setUserId(analytics, null);
          setUser(null);
          setUserProfile(null);
          setClaims(null);
          setIsLoading(false);
          setIsLoaded(true);
        }
      } catch (err: any) {
        console.error("❌ Auth Error:", err);
        setError(err);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const contextValue = useMemo<AuthContextType>(() => {
    const safeRole = (claims?.role as UserRole) ?? "base";
    return {
      user,
      userProfile,
      claims: claims ?? null,
      role: safeRole,
      isAdmin: safeRole === "state_admin" || safeRole === "developer",
      isLoaded,
      isLoading,
      error,
    };
  }, [user, userProfile, claims, isLoaded, isLoading, error]);

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress size={40} />
      </Box>
    );
  }

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
          Authentication Critical Error
        </Typography>
        <Typography variant="body1" textAlign="center">
          {error.message}
        </Typography>
        <Button
          variant="contained"
          onClick={() => window.location.reload()}
          sx={{ mt: 3 }}
        >
          Retry Connection
        </Button>
      </Box>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
