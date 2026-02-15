import React, { useEffect, useRef, useCallback, useState } from "react";
import { multiFactor } from "firebase/auth";
import { Box, CircularProgress, Typography, Button } from "@mui/material";
import { useAuth } from "./context/AuthContext";
import { syncReferenceData } from "./services/referenceDataSync";
import { ensureDBInitialized } from "./lib/db";
import MainLayout from "./app/layout/MainLayout";
import AppRouter from "./routes/AppRouter";
import EnrollMFAScreen from "./pages/auth/EnrollMFAScreen";
import { PublicFooter } from "./components/PublicFooter";
import ConsentScreen from "./pages/auth/ConsentScreen";
import { LEGAL_CONFIG } from "./constants/legal"; // THE SINGLE SOURCE OF TRUTH

export default function App() {
  const {
    user,
    userProfile,
    isLoaded: authLoaded,
    isLoading: authLoading,
  } = useAuth();

  const [dbReady, setDbReady] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  const hasSyncedRef = useRef<string | null>(null);

  // --- 1. DB SCHEMA INITIALIZATION ---
  useEffect(() => {
    const initDB = async () => {
      if (!authLoaded || !user) return;

      try {
        await ensureDBInitialized();
        setDbReady(true);
      } catch (err: any) {
        console.error("App: DB Init Error", err);
        setInitError(err);
      }
    };
    initDB();
  }, [authLoaded, user]);

  // --- 2. DATA SYNC LOGIC ---
  const performSync = useCallback(async () => {
    if (!user?.uid || !dbReady || hasSyncedRef.current === user.uid) return;

    const mfaUser = multiFactor(user);
    if (mfaUser.enrolledFactors.length === 0) return;

    hasSyncedRef.current = user.uid;
    try {
      await syncReferenceData(user.uid);
      setIsSynced(true);
    } catch (err: any) {
      console.error("App: Sync Error", err);
      hasSyncedRef.current = null;
      setInitError(err);
    }
  }, [user?.uid, dbReady]);

  useEffect(() => {
    if (authLoaded && user?.uid && dbReady) performSync();
  }, [authLoaded, user?.uid, dbReady, performSync]);

  // --- 3. LOADING & PUBLIC STATES ---

  if (authLoading || !authLoaded) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        minHeight="100vh"
        justifyContent="center"
        alignItems="center"
      >
        <CircularProgress size={50} sx={{ color: "#B22234" }} />
        <Typography variant="body1" sx={{ mt: 2 }} color="text.secondary">
          Initializing Auth...
        </Typography>
      </Box>
    );
  }

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

  // --- 4. SECURITY & COMPLIANCE GATES ---

  // MFA ENROLLMENT
  const mfaUser = multiFactor(user);
  if (mfaUser.enrolledFactors.length === 0) return <EnrollMFAScreen />;

  // CONSENT GATE (Uses the Central Constants File)
  if (userProfile) {
    const hasAgreed = userProfile.has_agreed_to_terms === true;
    const isLatestVersion =
      userProfile.legal_consent?.version === LEGAL_CONFIG.CURRENT_VERSION;

    console.log(
      `DEBUG App.tsx: [Version Check] User: ${userProfile.legal_consent?.version} | Required: ${LEGAL_CONFIG.CURRENT_VERSION}`,
    );

    if (!hasAgreed || !isLatestVersion) {
      return <ConsentScreen />;
    }
  }

  // --- 5. DATABASE READINESS ---

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
        <Typography variant="body1" sx={{ mt: 2 }} color="text.secondary">
          {!dbReady
            ? "Preparing secure local database..."
            : "Synchronizing region data..."}
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
        <Typography variant="h5" color="error" gutterBottom fontWeight="bold">
          Database Error
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          {initError.message}
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Reload Application
        </Button>
      </Box>
    );
  }

  // --- 6. FINAL: PRIVATE DASHBOARD ---
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
