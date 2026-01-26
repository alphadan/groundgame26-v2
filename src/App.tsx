// src/App.tsx
import React, { useEffect, useRef, useCallback, useState } from "react";
import { multiFactor } from "firebase/auth";
import { Box, CircularProgress, Typography, Button } from "@mui/material";
import { useAuth } from "./context/AuthContext";
import { syncReferenceData } from "./services/referenceDataSync";
import { ensureDBInitialized } from "./lib/db"; // Import your DB initializer
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

  const [dbReady, setDbReady] = useState(false); // Gate 2
  const [isSynced, setIsSynced] = useState(false); // Gate 3
  const [initError, setInitError] = useState<Error | null>(null);
  const hasSyncedRef = useRef<string | null>(null);

  // --- 1. DB SCHEMA INITIALIZATION ---
  useEffect(() => {
  const initDB = async () => {
    // SECURITY GATE: Do not query Firestore if no user is logged in
    if (!authLoaded || !user) {
      // We can still open the DB to check the version, 
      // but we should NOT trigger the seedDatabase() Layer 1 sync here.
      return; 
    }

    try {
      await ensureDBInitialized(); // Now only runs for logged-in users
      setDbReady(true);
    } catch (err: any) {
      setInitError(err);
    }
  };
  initDB();
}, [authLoaded, user]);

  // --- 2. DATA SYNC LOGIC ---
  const performSync = useCallback(async () => {
    // Wait for DB schema and User Auth before syncing data
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

  // --- LOADING STATES ---

  // AUTH LOADING
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

  // PUBLIC AREA (No User)
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

  // MFA ENROLLMENT
  const mfaUser = multiFactor(user);
  if (mfaUser.enrolledFactors.length === 0) return <EnrollMFAScreen />;

  // DB INITIALIZING OR SYNCING
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

  // CONSENT GATE
  const CURRENT_LEGAL_VERSION = "2026.01.14";
  if (userProfile) {
    const hasAgreed = userProfile.has_agreed_to_terms === true;
    const isLatestVersion =
      userProfile.legal_consent?.version === CURRENT_LEGAL_VERSION;
    if (!hasAgreed || !isLatestVersion) return <ConsentScreen />;
  }

  // ERROR STATE
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

  // --- FINAL: PRIVATE DASHBOARD ---
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
