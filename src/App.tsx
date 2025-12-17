import React, { useEffect, useState, useMemo, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { User, onIdTokenChanged, multiFactor } from "firebase/auth";
import { auth } from "./lib/firebase";

// Material UI
import { Box, CircularProgress, Typography } from "@mui/material";

// Context & Layout
import { AuthProvider } from "./context/AuthContext";
import MainLayout from "./app/layout/MainLayout";

// Components & Security
import LoginPage from "./components/auth/LoginPage";
import EnrollMFAScreen from "./components/auth/EnrollMFAScreen";

// Hooks
import { useActivityLogger } from "./hooks/useActivityLogger";

// PAGE IMPORTS — Ensure these paths match your folder structure
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

  const { logSuccess } = useActivityLogger();
  const hasLoggedEntry = useRef(false);

  useEffect(() => {
    // Single observer for all Auth/Claims logic
    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          let tokenResult = await currentUser.getIdTokenResult();

          // Force network refresh only if the 'role' is missing
          if (!tokenResult.claims.role) {
            console.log("⏳ Role missing, syncing from server...");
            tokenResult = await currentUser.getIdTokenResult(true);
          }
          setClaims(tokenResult.claims);
        } catch (err) {
          console.error("Claims sync failed:", err);
        }
      } else {
        setClaims(null);
      }
      setUser(currentUser);
      setIsReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Professional Session Logging
  useEffect(() => {
    if (user && claims?.role && !hasLoggedEntry.current) {
      logSuccess();
      hasLoggedEntry.current = true;
    }
  }, [user, claims, logSuccess]);

  // Memoize routes to prevent layout "flicker" on re-renders
  const authenticatedRoutes = useMemo(
    () => (
      <MainLayout>
        <Routes>
          {/* Core Navigation */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/actions" element={<ActionsPage />} />

          {/* Field Operations */}
          <Route path="/voters" element={<VoterListPage />} />
          <Route path="/walk-lists" element={<WalkListPage />} />
          <Route path="/name-search" element={<NameSearchPage />} />

          {/* Management & Admin */}
          <Route path="/manage-team" element={<ManageTeamPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* Fallbacks */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </MainLayout>
    ),
    []
  );

  // --- SECURITY GATES ---

  if (!isReady) {
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
          Initializing GroundGame26...
        </Typography>
      </Box>
    );
  }

  if (!user) return <LoginPage />;

  // MFA Enforcement
  const mfaFactors = multiFactor(user).enrolledFactors;
  if (mfaFactors.length === 0) return <EnrollMFAScreen />;

  return (
    <AuthProvider user={user} claims={claims}>
      {authenticatedRoutes}
    </AuthProvider>
  );
}
