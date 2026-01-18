import React, { useEffect, useRef, useCallback, useState } from "react";
import { multiFactor } from "firebase/auth";
import { Box, CircularProgress, Typography, Button } from "@mui/material";
import { useAuth } from "./context/AuthContext";
import { syncReferenceData } from "./services/referenceDataSync";
import MainLayout from "./app/layout/MainLayout";
import AppRouter from "./routes/AppRouter";
import EnrollMFAScreen from "./pages/auth/EnrollMFAScreen";
import { PublicFooter } from "./components/PublicFooter";
import ConsentScreen from "./pages/auth/ConsentScreen";

export default function App() {
  const {
    user,
    userProfile,
    isLoaded: authLoaded,
    isLoading: authLoading,
  } = useAuth();
  const [isSynced, setIsSynced] = useState(false);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const hasSyncedRef = useRef<string | null>(null);

  // Sync Logic
  const performSync = useCallback(async () => {
    if (!user?.uid || hasSyncedRef.current === user.uid) return;

    // Safety check: Only sync if MFA is enrolled
    const mfaUser = multiFactor(user);
    if (mfaUser.enrolledFactors.length === 0) return;

    hasSyncedRef.current = user.uid;
    try {
      await syncReferenceData(user.uid);
      setIsSynced(true);
    } catch (err: any) {
      console.error("App: Sync Error", err);
      hasSyncedRef.current = null;
      setSyncError(err);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (authLoaded && user?.uid) performSync();
  }, [authLoaded, user?.uid, performSync]);

  // --- BRANCH 1: GLOBAL LOADING ---
  if (authLoading || !authLoaded) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        minHeight="100vh"
        justifyContent="center"
        alignItems="center"
        bgcolor="background.default"
      >
        <CircularProgress size={50} sx={{ color: "#B22234" }} />
        <Typography variant="body1" sx={{ mt: 2 }} color="text.secondary">
          Initializing Auth...
        </Typography>
      </Box>
    );
  }

  // --- BRANCH 2: LOGGED OUT (PUBLIC) ---
  if (!user) {
    console.log("App.tsx: User is NULL. Rendering Public Area.");
    return (
      <Box
        display="flex"
        flexDirection="column"
        minHeight="100vh"
        bgcolor="background.default"
      >
        <Box flex={1}>
          <AppRouter />
        </Box>
        <PublicFooter />
      </Box>
    );
  }

  // --- BRANCH 3: LOGGED IN BUT NO MFA ---
  const mfaUser = multiFactor(user);
  if (mfaUser.enrolledFactors.length === 0) {
    console.log("App.tsx: User exists but no MFA. Rendering Enrollment.");
    return <EnrollMFAScreen />;
  }

  // 4. CONSENT GATE
  const CURRENT_LEGAL_VERSION = "2026.01.14";
  if (userProfile) {
    const hasAgreed = userProfile.has_agreed_to_terms === true;
    const isLatestVersion =
      userProfile.legal_consent?.version === CURRENT_LEGAL_VERSION;

    if (!hasAgreed || !isLatestVersion) {
      console.log(
        "App: Consent required. Agreed:",
        hasAgreed,
        "Version Match:",
        isLatestVersion,
      );
      return <ConsentScreen />;
    }
  }

  // --- BRANCH 5: LOGGED IN & MFA - SYNCING DATA ---
  if (!isSynced && !syncError) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        minHeight="100vh"
        justifyContent="center"
        alignItems="center"
        bgcolor="background.default"
      >
        <CircularProgress size={50} sx={{ color: "#B22234" }} />
        <Typography variant="body1" sx={{ mt: 2 }} color="text.secondary">
          Syncing precinct data...
        </Typography>
      </Box>
    );
  }

  // --- BRANCH 6: SYNC ERROR ---
  if (syncError) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        minHeight="100vh"
        justifyContent="center"
        alignItems="center"
        bgcolor="background.default"
        p={4}
      >
        <Typography variant="h5" color="error" gutterBottom fontWeight="bold">
          Initialization Error
        </Typography>
        <Typography variant="body1" textAlign="center" sx={{ mb: 3 }}>
          {syncError.message}
        </Typography>
        <Button variant="contained" onClick={performSync}>
          Retry Sync
        </Button>
      </Box>
    );
  }

  // --- BRANCH 7: PRIVATE DASHBOARD (SYNCED & AUTHENTICATED) ---
  console.log("App.tsx: User Synced & Auth. Rendering Private Layout.");
  return (
    <Box
      display="flex"
      flexDirection="column"
      minHeight="100vh"
      bgcolor="background.default"
    >
      <MainLayout>
        <AppRouter />
      </MainLayout>
    </Box>
  );
}
