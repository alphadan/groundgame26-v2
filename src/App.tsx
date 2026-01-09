// src/App.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { multiFactor } from "firebase/auth";
import { Box, CircularProgress, Typography, Button } from "@mui/material";

// Context & Services
import { useAuth } from "./context/AuthContext";
import { syncReferenceData } from "./services/referenceDataSync";
import MainLayout from "./app/layout/MainLayout";

// Components
import LoginPage from "./components/auth/LoginPage";
import EnrollMFAScreen from "./components/auth/EnrollMFAScreen";

// Page Imports
import Dashboard from "./app/dashboard/Dashboard";
import AnalysisPage from "./app/analysis/AnalysisPage";
import ResourcesPage from "./app/resources/ResourcesPage";
import VoterListPage from "./app/voters/VoterListPage";
import WalkListPage from "./app/walk/WalkListPage";
import NameSearchPage from "./app/voters/NameSearchPage";
import SettingsPage from "./app/settings/SettingsPage";
import FirebaseManagementPage from "./app/admin/FirebaseManagementPage";
import ManageTeamPage from "./app/precincts/ManageTeamPage";
import BadgeRedemptionPage from "./app/rewards/BadgeRedemptionPage";
import HowToUsePage from "./app/guide/HowToUsePage";

export default function App() {
  const [isSynced, setIsSynced] = useState(false);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const hasSyncedRef = useRef<string | null>(null);

  // 1. Correct Destructuring: Renaming isLoaded to authLoaded for clarity
  const {
    user,
    claims,
    role,
    isLoaded: authLoaded,
    isLoading: authLoading,
  } = useAuth();

  // 2. Defensive performSync Callback
  const performSync = useCallback(async () => {
    // 1. Exit if no user or we already successfully synced for THIS specific UID
    if (!user?.uid || hasSyncedRef.current === user.uid) {
      return;
    }

    // 2. Lock the sync immediately
    hasSyncedRef.current = user.uid;
    console.log("[App] 🚀 Starting strategic sync for UID:", user.uid);

    try {
      setSyncError(null);
      setIsOffline(false);

      // 3. The actual heavy lifting
      await syncReferenceData(user.uid);

      console.log("[App] ✅ SYNC COMPLETE");
      setIsSynced(true);
    } catch (err: any) {
      console.error("[App] ❌ Sync failed:", err);

      // 4. Reset the ref on error so the user can retry (or the next effect run can try)
      hasSyncedRef.current = null;

      if (!navigator.onLine || err?.code === "unavailable") {
        setIsOffline(true);
      }

      setSyncError(err instanceof Error ? err : new Error(String(err)));
      setIsSynced(false);
    }
  }, [user?.uid]);

  // 3. Trigger Sync when criteria are met
  useEffect(() => {
    if (authLoaded && user?.uid) {
      performSync();
    }
  }, [authLoaded, user?.uid, performSync]);

  // === RENDER LOGIC ===

  // A. Auth Loading State
  if (authLoading || !authLoaded) {
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
        <Typography variant="h6">Initializing Auth...</Typography>
      </Box>
    );
  }

  // B. Unauthenticated State
  if (!user) {
    return <LoginPage />;
  }

  // C. MFA Enforcement
  let enrolledFactors: any[] = [];
  try {
    const mfaUser = multiFactor(user);
    enrolledFactors = mfaUser?.enrolledFactors ?? [];
  } catch (mfaErr) {
    console.warn("MFA check failed:", mfaErr);
  }

  if (enrolledFactors.length === 0) {
    return <EnrollMFAScreen />;
  }

  // D. Data Sync Loading State
  if (!isSynced && !syncError) {
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
        <Typography variant="h6">Syncing reference data...</Typography>
      </Box>
    );
  }

  // E. Sync Error Boundary
  if (syncError) {
    return (
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
        <Typography variant="body1" textAlign="center">
          {isOffline ? "No internet connection detected." : syncError.message}
        </Typography>
        <Button
          variant="contained"
          onClick={() => {
            // FIX: Change false to null
            hasSyncedRef.current = null;
            performSync();
          }}
        >
          Retry Sync
        </Button>
      </Box>
    );
  }

  // F. Authenticated & Authorized Application UI
  return (
    <MainLayout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/voters" element={<VoterListPage />} />
        <Route path="/walk-lists" element={<WalkListPage />} />
        <Route path="/name-search" element={<NameSearchPage />} />
        <Route path="/manage-team" element={<ManageTeamPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/how-to-use" element={<HowToUsePage />} />
        <Route
          path="/admin"
          element={
            claims?.permissions?.can_manage_team ? (
              <FirebaseManagementPage />
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />
        <Route path="/rewards" element={<BadgeRedemptionPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </MainLayout>
  );
}
