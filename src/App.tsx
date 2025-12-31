// src/App.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { User, onIdTokenChanged, multiFactor } from "firebase/auth";
import { auth } from "./lib/firebase";

import {
  Box,
  CircularProgress,
  Typography,
  Button,
  CssBaseline,
} from "@mui/material";

import { CustomThemeProvider } from "./context/ThemeContext";
import "./themeAugmentations";
import { AuthProvider } from "./context/AuthContext";
import { syncReferenceData } from "./services/referenceDataSync";
import MainLayout from "./app/layout/MainLayout";

import LoginPage from "./components/auth/LoginPage";
import EnrollMFAScreen from "./components/auth/EnrollMFAScreen";

import { useActivityLogger } from "./hooks/useActivityLogger";

import Dashboard from "./app/dashboard/Dashboard";
import ReportsPage from "./app/reports/ReportsAnalysisPage";
import AnalysisPage from "./app/analysis/AnalysisPage";
import MessagingPage from "./app/messaging/MessagingPage";
import VoterListPage from "./app/voters/VoterListPage";
import WalkListPage from "./app/walk/WalkListPage";
import NameSearchPage from "./app/voters/NameSearchPage";
import SettingsPage from "./app/settings/SettingsPage";
import FirebasePage from "./app/admin/FirebaseManagementPage";
import ManageTeamPage from "./app/precincts/ManageTeamPage";
import BadgeRedemptionPage from "./app/rewards/BadgeRedemptionPage";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Record<string, any> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const { logSuccess } = useActivityLogger();
  const hasSyncedRef = useRef(false);
  const forceRefreshAttempted = useRef(false);

  // === 1. Auth State Listener (defensive & safe cleanup) ===
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          let tokenResult = await currentUser.getIdTokenResult(false);

          // Only force refresh once per session if role missing
          if (!tokenResult.claims.role && !forceRefreshAttempted.current) {
            console.log(
              "⏳ Role missing — forcing ID token refresh (one-time)"
            );
            forceRefreshAttempted.current = true;
            try {
              tokenResult = await currentUser.getIdTokenResult(true);
            } catch (refreshErr) {
              console.warn("Force refresh failed:", refreshErr);
              // Continue with original claims — role may be missing temporarily
            }
          }

          setClaims(tokenResult.claims || {});
          console.warn("Claims:", claims);
        } else {
          setClaims(null);
          forceRefreshAttempted.current = false;
        }

        setUser(currentUser);
      } catch (err) {
        console.error("Error processing auth state:", err);
        setUser(currentUser); // Still set user to allow login flow
      } finally {
        setIsReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // === 2. One-time Reference Data Sync (idempotent & resilient) ===
  const performSync = useCallback(async () => {
    if (!user || hasSyncedRef.current) return;

    hasSyncedRef.current = true;
    console.log("[App] Starting one-time reference sync for UID:", user.uid);

    try {
      await syncReferenceData(user.uid);
      console.log("[App] SYNC SUCCESS");
      setIsSynced(true);
      logSuccess?.(); // Optional chain — safe if undefined
    } catch (err: any) {
      console.error("[App] Sync failed:", err);

      // Detect offline vs. other errors
      if (err?.message?.includes("offline") || !navigator.onLine) {
        setIsOffline(true);
      }

      setSyncError(err instanceof Error ? err : new Error(String(err)));
      setIsSynced(true); // Allow app to continue with cached data
    }
  }, [user, logSuccess]);

  useEffect(() => {
    if (isReady && user && claims?.role && !hasSyncedRef.current) {
      performSync();
    }
  }, [isReady, user, claims?.role, performSync]);

  // === 3. Loading States ===
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
        <Typography variant="h6">Initializing GroundGame26...</Typography>
      </Box>
    );
  }

  if (user && !isSynced) {
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
        {isOffline && (
          <Typography color="warning.main">
            You appear to be offline — using cached data
          </Typography>
        )}
      </Box>
    );
  }

  // === 4. Sync Error with Retry ===
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
        <Typography variant="h5" color="error" textAlign="center">
          Failed to load reference data
        </Typography>
        <Typography variant="body1" textAlign="center">
          {isOffline ? "No internet connection" : syncError.message}
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          The app may still work with cached data.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            hasSyncedRef.current = false;
            setSyncError(null);
            setIsSynced(false);
            performSync();
          }}
        >
          Retry Sync
        </Button>
      </Box>
    );
  }

  // === 5. Unauthenticated ===
  if (!user) {
    return <LoginPage />;
  }

  // === 6. MFA Enforcement (safe multiFactor call) ===
  let enrolledFactors: any[] = [];
  try {
    if (multiFactor && typeof multiFactor === "function") {
      const mfaUser = multiFactor(user);
      enrolledFactors = mfaUser?.enrolledFactors ?? [];
    }
  } catch (mfaErr) {
    console.warn("MFA check failed (non-critical):", mfaErr);
    // Continue — assume MFA not required if SDK fails
  }

  if (enrolledFactors.length === 0) {
    return <EnrollMFAScreen />;
  }

  // === 7. Authenticated App ===
  return (
    <AuthProvider>
      <MainLayout>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/messaging" element={<MessagingPage />} />
          <Route path="/voters" element={<VoterListPage />} />
          <Route path="/walk-lists" element={<WalkListPage />} />
          <Route path="/name-search" element={<NameSearchPage />} />
          <Route path="/manage-team" element={<ManageTeamPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<FirebasePage />} />
          <Route path="/rewards" element={<BadgeRedemptionPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </MainLayout>
    </AuthProvider>
  );
}
