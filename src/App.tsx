import React, { useEffect, useRef, useCallback, useState } from "react";
import { multiFactor } from "firebase/auth";
import { Box, CircularProgress, Typography, Button, Link } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { syncReferenceData } from "./services/referenceDataSync";
import MainLayout from "./app/layout/MainLayout";
import AppRouter from "./routes/AppRouter";
import LoginPage from "./pages/auth/LoginPage";
import EnrollMFAScreen from "./pages/auth/EnrollMFAScreen";

export default function App() {
  const [isSynced, setIsSynced] = useState(false);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const { user, isLoaded: authLoaded, isLoading: authLoading } = useAuth();
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

  // Main content rendering logic
  const renderView = () => {
    if (authLoading || !authLoaded)
      return <LoadingScreen message="Initializing Auth..." />;
    if (!user) return <LoginPage />;

    const mfaUser = multiFactor(user);
    if ((mfaUser?.enrolledFactors ?? []).length === 0)
      return <EnrollMFAScreen />;

    if (!isSynced && !syncError)
      return <LoadingScreen message="Syncing reference data..." />;
    if (syncError)
      return <SyncErrorScreen error={syncError} retry={performSync} />;

    return (
      <MainLayout>
        <AppRouter />
      </MainLayout>
    );
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      minHeight="100vh"
      bgcolor="background.default"
    >
      {/* Main Application Area */}
      <Box flex={1} display="flex" flexDirection="column">
        {renderView()}
      </Box>

      {/* Global Public Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          textAlign: "center",
        }}
      >
        <Link
          component={RouterLink}
          to="/legal"
          variant="body2"
          sx={{
            color: "text.secondary",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline", color: "primary.main" },
          }}
        >
          Privacy & Data Use Agreement
        </Link>
      </Box>
    </Box>
  );
}

const LoadingScreen = ({ message }: { message: string }) => (
  <Box
    flex={1}
    display="flex"
    flexDirection="column"
    justifyContent="center"
    alignItems="center"
    gap={2}
  >
    <CircularProgress size={50} sx={{ color: "#B22234" }} />
    <Typography variant="body1" color="text.secondary">
      {message}
    </Typography>
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
    flex={1}
    display="flex"
    flexDirection="column"
    justifyContent="center"
    alignItems="center"
    gap={3}
    px={4}
  >
    <Typography variant="h5" color="error">
      Data Sync Error
    </Typography>
    <Typography variant="body1" textAlign="center">
      {error.message}
    </Typography>
    <Button variant="contained" onClick={retry}>
      Retry Initialization
    </Button>
  </Box>
);
