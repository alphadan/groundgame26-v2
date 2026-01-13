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
import ManageTeamPage from "./app/precincts/ManageTeamPage";
import BadgeRedemptionPage from "./app/rewards/BadgeRedemptionPage";
import HowToUsePage from "./app/guide/HowToUsePage";

// ── Admin Pages (new structure) ─────────────────────────────────────────────
import AdminDashboard from "./app/admin/AdminDashboard"; // ← new main dashboard with cards
import UsersManagement from "./app/admin/users/UsersManagement";
import AreasManagement from "./app/admin/areas/AreasManagement";
import PrecinctsManagement from "./app/admin/precincts/PrecinctsManagement";
import MessagesManagement from "./app/admin/messages/MessagesManagement";
import ResourcesManagement from "./app/admin/resources/ResourcesManagement";
import GroupsManagement from "./app/admin/groups/GroupsManagement";
import RewardsManagement from "./app/admin/rewards/RewardsManagement"; // ← your new one (can start as stub)
import NotificationsManagement from "./app/admin/notifications/NotificationsManagement";
import AnalyticsManagement from "./app/admin/analytics/AnalyticsManagement";
import GoalsManagement from "./app/admin/goals/GoalsManagement";
import RolesManagement from "./app/admin/roles/RolesManagement";
import DncManagement from "./app/admin/dnc/DncManagement";

// You can keep the old page temporarily during transition
// import FirebaseManagementPage from "./app/admin/FirebaseManagementPage";

export default function App() {
  const [isSynced, setIsSynced] = useState(false);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const hasSyncedRef = useRef<string | null>(null);

  const {
    user,
    claims,
    isLoaded: authLoaded,
    isLoading: authLoading,
  } = useAuth();

  const performSync = useCallback(async () => {
    if (!user?.uid || hasSyncedRef.current === user.uid) return;

    hasSyncedRef.current = user.uid;
    console.log("[App] 🚀 Starting strategic sync for UID:", user.uid);

    try {
      setSyncError(null);
      setIsOffline(false);
      await syncReferenceData(user.uid);
      console.log("[App] ✅ SYNC COMPLETE");
      setIsSynced(true);
    } catch (err: any) {
      console.error("[App] ❌ Sync failed:", err);
      hasSyncedRef.current = null;

      if (!navigator.onLine || err?.code === "unavailable") {
        setIsOffline(true);
      }

      setSyncError(err instanceof Error ? err : new Error(String(err)));
      setIsSynced(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (authLoaded && user?.uid) {
      performSync();
    }
  }, [authLoaded, user?.uid, performSync]);

  // ── Loading / Auth / MFA / Sync States ──────────────────────────────────────
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

  if (!user) {
    return <LoginPage />;
  }

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
            hasSyncedRef.current = null;
            performSync();
          }}
        >
          Retry Sync
        </Button>
      </Box>
    );
  }

  // ── Main Application ────────────────────────────────────────────────────────
  const hasAdminAccess = claims?.permissions?.can_manage_team === true;

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
        <Route path="/rewards" element={<BadgeRedemptionPage />} />

        {/* ── Admin Routes ──────────────────────────────────────────────────── */}
        <Route
          path="/admin"
          element={
            hasAdminAccess ? (
              <AdminDashboard />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/admin/users"
          element={
            hasAdminAccess ? (
              <UsersManagement />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/admin/areas"
          element={
            hasAdminAccess ? (
              <AreasManagement />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/admin/precincts"
          element={
            hasAdminAccess ? (
              <PrecinctsManagement />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/admin/messages"
          element={
            hasAdminAccess ? (
              <MessagesManagement />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/admin/resources"
          element={
            hasAdminAccess ? (
              <ResourcesManagement />
            ) : (
              <Navigate to="/resources" replace />
            )
          }
        />
        <Route
          path="/admin/groups"
          element={
            hasAdminAccess ? (
              <GroupsManagement />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/admin/rewards"
          element={
            hasAdminAccess ? (
              <RewardsManagement />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/admin/notifications"
          element={
            hasAdminAccess ? (
              <NotificationsManagement />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/admin/analytics"
          element={
            hasAdminAccess ? (
              <AnalyticsManagement />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/admin/goals"
          element={
            hasAdminAccess ? (
              <GoalsManagement />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="/admin/roles"
          element={
            hasAdminAccess ? (
              <RolesManagement />
            ) : (
              <Navigate to="/roles" replace />
            )
          }
        />
        <Route
          path="/admin/dnc"
          element={
            hasAdminAccess ? <DncManagement /> : <Navigate to="/dns" replace />
          }
        />

        {/* Optional: keep old admin route during transition */}
        {/* <Route path="/admin/old" element={hasAdminAccess ? <FirebaseManagementPage /> : <Navigate to="/dashboard" replace />} /> */}

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </MainLayout>
  );
}
