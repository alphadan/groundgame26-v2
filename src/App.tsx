import React, { useEffect, useRef, useCallback, useState } from "react";
import { multiFactor } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { Box, CircularProgress, Typography, Button } from "@mui/material";
import { db as firestore } from "./lib/firebase";
import { useAuth } from "./context/AuthContext";
import { syncReferenceData } from "./services/referenceDataSync";
import { ensureDBInitialized } from "./lib/db";
import { AppControl } from "./types";
import MainLayout from "./app/layout/MainLayout";
import AppRouter from "./routes/AppRouter";
import EnrollMFAScreen from "./pages/auth/EnrollMFAScreen";
import UpdatePasswordScreen from "./pages/auth/UpdatePasswordScreen";
import ConsentScreen from "./pages/auth/ConsentScreen";
import { PublicFooter } from "./components/PublicFooter";
import { VersionGuard } from "./components/auth/VersionGuard";

export default function App() {
  const {
    user,
    userProfile,
    isLoaded: authLoaded,
    isLoading: authLoading,
    role,
  } = useAuth();

  const [keystone, setKeystone] = useState<any>(null);
  const [dbReady, setDbReady] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  const hasSyncedRef = useRef<string | null>(null);

  // --- HOOKS (Must be at the top, never conditional) ---

  // 1. Keystone Listener
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(firestore, "config", "app_control"),
      (snap) => {
        if (snap.exists()) setKeystone(snap.data());
      },
    );
    return unsub;
  }, [user]);

  // 2. Sync Logic Definition
  const performSync = useCallback(async () => {
    if (!user?.uid || !dbReady || hasSyncedRef.current === user.uid) return;
    hasSyncedRef.current = user.uid;
    try {
      await syncReferenceData(user.uid);
      setIsSynced(true);
    } catch (err: any) {
      hasSyncedRef.current = null;
      setInitError(err);
    }
  }, [user?.uid, dbReady]);

  // 3. DB Initialization Trigger
  useEffect(() => {
    // Only init if we have a user and they've passed the "Gates" (checked in render)
    const canInit = user && authLoaded && userProfile && keystone;
    const isDev = role === "developer";
    const hasAgreed =
      userProfile?.has_agreed_to_terms &&
      userProfile?.legal_consent?.version === keystone?.legal_terms_version;

    if (canInit && (isDev || hasAgreed) && !dbReady && !initError) {
      ensureDBInitialized(true)
        .then(() => setDbReady(true))
        .catch(setInitError);
    }
  }, [user, authLoaded, userProfile, keystone, dbReady, initError, role]);

  // 4. Sync Trigger
  useEffect(() => {
    if (dbReady && !isSynced && !initError) {
      performSync();
    }
  }, [dbReady, isSynced, initError, performSync]);

  // --- RENDER GATES (After all hooks are declared) ---
  // 1. AUTH LOADING GATE
  if (authLoading || !authLoaded) {
    return (
      <Box
        display="flex"
        minHeight="100vh"
        justifyContent="center"
        alignItems="center"
      >
        <CircularProgress />
      </Box>
    );
  }

  // 2. UNAUTHENTICATED GATE
  if (!user) {
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

  // 3. SYSTEM CONFIG GATE
  if (!keystone) {
    return (
      <Box
        display="flex"
        minHeight="100vh"
        justifyContent="center"
        alignItems="center"
      >
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>System Governance...</Typography>
      </Box>
    );
  }

  // 4. MFA ENFORCEMENT GATE
  const mfaUser = multiFactor(user);
  if (mfaUser.enrolledFactors.length === 0) return <EnrollMFAScreen />;

  // 5. PASSWORD UPDATE GATE (STEP 3 CONFIRMED)
  if (userProfile?.requires_password_update) {
    return <UpdatePasswordScreen />;
  }

  // 6. CONSENT GATE
  if (userProfile) {
    const isDev = role === "developer";

    // Use the ACTUAL data from your AuthContext/Firestore
    const hasAgreed = userProfile.has_agreed_to_terms === true;
    const isLatestVersion =
      userProfile.legal_consent?.version === keystone?.legal_terms_version;

    console.log(
      `🔍 [Gate] Dev: ${isDev} | Agreed: ${hasAgreed} | VersionMatch: ${isLatestVersion}`,
    );

    // Only show consent if they aren't a dev AND (haven't agreed OR version is old)
    if (!isDev && (!hasAgreed || !isLatestVersion)) {
      return <ConsentScreen />;
    }
  }

  // 7. HYDRATION LOADING
  if (!dbReady || (!isSynced && !initError)) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        minHeight="100vh"
        justifyContent="center"
        alignItems="center"
      >
        <CircularProgress size={50} sx={{ color: "#B22234" }} />
        <Typography variant="body1" sx={{ mt: 2 }}>
          {!dbReady
            ? "Initializing secure storage..."
            : "Downloading region data..."}
        </Typography>
      </Box>
    );
  }

  if (initError) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        minHeight="100vh"
        justifyContent="center"
        alignItems="center"
        p={4}
      >
        <Typography variant="h5" color="error" gutterBottom>
          Database Error
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          {initError.message}
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Box>
    );
  }

  // 8. FINAL APP RENDER
  return (
    <VersionGuard>
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
    </VersionGuard>
  );
}
