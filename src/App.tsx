// src/App.tsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { User, onIdTokenChanged, multiFactor } from "firebase/auth";
import { auth } from "./lib/firebase";

// Material UI
import { Box, CircularProgress, Typography } from "@mui/material";

// Context & Layout
import { AuthProvider } from "./context/AuthContext";
import { syncReferenceData } from "./services/referenceDataSync";
import MainLayout from "./app/layout/MainLayout";

// Components & Security
import LoginPage from "./components/auth/LoginPage";
import EnrollMFAScreen from "./components/auth/EnrollMFAScreen";

// Hooks
import { useActivityLogger } from "./hooks/useActivityLogger";

// PAGE IMPORTS
import Dashboard from "./app/dashboard/Dashboard";
import ReportsPage from "./app/reports/ReportsPage";
import AnalysisPage from "./app/analysis/AnalysisPage";
import ActionsPage from "./app/actions/ActionsPage";
import VoterListPage from "./app/voters/VoterListPage";
import WalkListPage from "./app/walk/WalkListPage";
import NameSearchPage from "./app/voters/NameSearchPage";
import SettingsPage from "./app/settings/SettingsPage";
import ManageTeamPage from "./app/precincts/ManageTeamPage";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [syncError, setSyncError] = useState<Error | null>(null);

  const { logSuccess } = useActivityLogger();
  const hasLoggedEntry = useRef(false);

  // Auth listener – runs once on mount
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          let tokenResult = await currentUser.getIdTokenResult();

          // Force refresh if role is missing
          if (!tokenResult.claims.role) {
            console.log("⏳ Role missing, forcing token refresh...");
            tokenResult = await currentUser.getIdTokenResult(true);
          }

          setClaims(tokenResult.claims);
        } catch (err) {
          console.error("Claims sync failed:", err);
        }
      } else {
        setClaims(null);
        setIsSynced(false); // Reset sync state on logout
        hasLoggedEntry.current = false;
      }

      setUser(currentUser);
      setIsReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Reference data sync – runs only once after auth is ready
  useEffect(() => {
    if (!user || !claims?.role || !isReady) return;
    if (hasLoggedEntry.current) return;

    hasLoggedEntry.current = true;

    console.log("[App] User authenticated — starting one-time reference sync");

    // Uncomment to bypass sync during testing (temporary)
    // setIsSynced(true);
    // logSuccess();
    // return;

    syncReferenceData()
      .then(() => {
        console.log("[App] SYNC SUCCESS – setting isSynced to true");
        setIsSynced(true);
        logSuccess(); // Assuming it takes no args; remove if your hook needs a message
      })
      .catch((err) => {
        console.error("[App] Sync failed:", err);
        setSyncError(err);
        setIsSynced(true); // Proceed anyway (graceful degradation)
      });
  }, [user, isReady, claims?.role, logSuccess]);

  // Loading screen while auth or sync is in progress
  if (!isReady || (user && !isSynced)) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        gap={2}
      >
        <CircularProgress size={60} sx={{ color: "#B22234" }} />
        <Typography variant="h6" fontWeight="medium">
          {user
            ? "Syncing reference data... (this should take a few seconds)"
            : "Initializing GroundGame26..."}
        </Typography>
      </Box>
    );
  }

  // Error screen if sync fails (optional)
  if (syncError) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        gap={3}
      >
        <Typography variant="h5" color="error">
          Failed to load reference data
        </Typography>
        <Typography variant="body1">{syncError.message}</Typography>
        <Typography variant="body2">
          Please refresh the page or contact support.
        </Typography>
      </Box>
    );
  }

  // No user → Login page
  if (!user) {
    return <LoginPage />;
  }

  // User logged in but no MFA → Enroll MFA screen
  const mfaFactors = multiFactor(user).enrolledFactors ?? [];
  if (mfaFactors.length === 0) {
    return <EnrollMFAScreen />;
  }

  // Success → Authenticated routes
  return (
    <AuthProvider user={user} claims={claims}>
      <MainLayout>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/actions" element={<ActionsPage />} />
          <Route path="/voters" element={<VoterListPage />} />
          <Route path="/walk-lists" element={<WalkListPage />} />
          <Route path="/name-search" element={<NameSearchPage />} />
          <Route path="/manage-team" element={<ManageTeamPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </MainLayout>
    </AuthProvider>
  );
}
