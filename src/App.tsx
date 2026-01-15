// src/App.tsx (Cleaned up)
import React, { useEffect, useRef, useCallback, useState } from "react";
import { multiFactor } from "firebase/auth";
import { Box, CircularProgress, Typography, Button } from "@mui/material";
import { useAuth } from "./context/AuthContext";
import { syncReferenceData } from "./services/referenceDataSync";
import MainLayout from "./app/layout/MainLayout";
import AppRouter from "./routes/AppRouter";
import LoginPage from "./pages/auth/LoginPage"; 
import EnrollMFAScreen from "./pages/auth/EnrollMFAScreen";

export default function App() {
  const [isSynced, setIsSynced] = useState(false);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const {
    user,
    claims,
    isLoaded: authLoaded,
    isLoading: authLoading,
  } = useAuth();
  const hasSyncedRef = useRef<string | null>(null);

  const performSync = useCallback(async () => {
    if (!user?.uid || hasSyncedRef.current === user.uid) return;
    hasSyncedRef.current = user.uid;
    try {
      await syncReferenceData(user.uid);
      setIsSynced(true);
    } catch (err: any) {
      hasSyncedRef.current = null;
      setSyncError(err);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (authLoaded && user?.uid) performSync();
  }, [authLoaded, user?.uid, performSync]);

  // Handle Global States (Loading, No Auth, MFA, Syncing)
  if (authLoading || !authLoaded)
    return <LoadingScreen message="Initializing Auth..." />;
  if (!user) return <LoginPage />;

  const mfaUser = multiFactor(user);
  if ((mfaUser?.enrolledFactors ?? []).length === 0) return <EnrollMFAScreen />;

  if (!isSynced && !syncError)
    return <LoadingScreen message="Syncing reference data..." />;
  if (syncError)
    return <SyncErrorScreen error={syncError} retry={performSync} />;

  // Main Application
  return (
    <MainLayout>
      <AppRouter />
    </MainLayout>
  );
}

// Sub-components for better readability
const LoadingScreen = ({ message }: { message: string }) => (
  <Box
    display="flex"
    flexDirection="column"
    justifyContent="center"
    alignItems="center"
    minHeight="100vh"
    gap={2}
  >
    <CircularProgress size={60} sx={{ color: "#B22234" }} />
    <Typography variant="h6">{message}</Typography>
  </Box>
);

const SyncErrorScreen = ({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) => (
  <Box
    display="flex"
    flexDirection="column"
    justifyContent="center"
    alignItems="center"
    minHeight="100vh"
    gap={3}
    px={2}
  >
    <Typography variant="h5" color="error">
      Reference Data Error
    </Typography>
    <Typography variant="body1">{error.message}</Typography>
    <Button variant="contained" onClick={retry}>
      Retry Sync
    </Button>
  </Box>
);
