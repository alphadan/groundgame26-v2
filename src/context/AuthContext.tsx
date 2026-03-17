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

// Import shared interfaces
import { UserProfile, CustomClaims, UserRole, UserPermissions } from "../types";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  claims: CustomClaims | null;
  permissions: UserPermissions; // NEW: Dynamic permission set
  role: UserRole;
  isAdmin: boolean;
  isLoaded: boolean;
  isLoading: boolean;
  error: Error | null;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  can_manage_team: false,
  can_create_users: false,
  can_manage_resources: false,
  can_create_documents: false,
  can_download_records: false,
};

const defaultContext: AuthContextType = {
  user: null,
  userProfile: null,
  claims: null,
  permissions: DEFAULT_PERMISSIONS,
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
  const [permissions, setPermissions] =
    useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let unsubscribeProfile: Unsubscribe | null = null;

    const unsubscribeAuth = onIdTokenChanged(auth, async (currentUser) => {
      try {
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        if (currentUser) {
          // Force refresh to get latest Firestore-synced claims
          const tokenResult = await getIdTokenResult(currentUser, true);
          const currentClaims = tokenResult.claims as CustomClaims;

          setUser(currentUser);
          setClaims(currentClaims);

          // --- DYNAMIC PERMISSIONS SYNC ---
          // Extract permissions from claims or fallback to default
          setPermissions(
            (currentClaims.permissions as UserPermissions) ||
              DEFAULT_PERMISSIONS,
          );

          if (analytics) {
            setUserId(analytics, currentUser.uid);
            setUserProperties(analytics, {
              user_role: currentClaims.role || "base",
              user_group: currentClaims.group_id || "general",
            });
          }

          unsubscribeProfile = onSnapshot(
            doc(db, "users", currentUser.uid),
            async (snapshot) => {
              let profileData: UserProfile | null = null;

              if (snapshot.exists()) {
                profileData = snapshot.data() as UserProfile;
              }

              // DEVELOPER GOD-MODE BYPASS
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
                  // Ensure developer has full permissions even if doc is missing
                  permissions: {
                    can_manage_team: true,
                    can_create_users: true,
                    can_manage_resources: true,
                    can_create_documents: true,
                    can_download_records: true,
                  },
                  ...profileData,
                } as UserProfile;
              }

              setUserProfile(profileData);

              if (analytics && profileData) {
                setUserProperties(analytics, {
                  user_county: profileData.access?.counties?.[0] || "none",
                  user_role: profileData.role || "none",
                });
              }

              // Check for sync flag from Cloud Function
              if (profileData?.last_claims_sync) {
                const updatedToken = await getIdTokenResult(currentUser, true);
                setClaims(updatedToken.claims as CustomClaims);
                setPermissions(
                  (updatedToken.claims.permissions as UserPermissions) ||
                    DEFAULT_PERMISSIONS,
                );
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
          if (analytics) setUserId(analytics, null);
          setUser(null);
          setUserProfile(null);
          setClaims(null);
          setPermissions(DEFAULT_PERMISSIONS);
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
      permissions, // Globally exposed dynamic permissions
      role: safeRole,
      isAdmin: permissions.can_manage_team || safeRole === "developer",
      isLoaded,
      isLoading,
      error,
    };
  }, [user, userProfile, claims, permissions, isLoaded, isLoading, error]);

  // Loading and Error UI remain exactly as you have them...
  if (isLoading)
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
  if (error)
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

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
