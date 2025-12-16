// src/App.tsx

import React, { useEffect, useState, useMemo } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import {
  onAuthStateChanged,
  User,
  getIdTokenResult,
  onIdTokenChanged,
  multiFactor,
} from "firebase/auth";
import { auth } from "./lib/firebase"; // Ensure this import is correct

import LoginPage from "./components/auth/LoginPage";
import EnrollMFAScreen from "./components/auth/EnrollMFAScreen";
import MainLayout from "./app/layout/MainLayout";
import { AuthProvider } from "./context/AuthContext";
// Note: AppInitializer is temporarily commented out in the render block below
// import AppInitializer from "./components/AppInitializer";
import { useActivityLogger } from "./hooks/useActivityLogger";

// Page Imports (kept for context)
import ReportsPage from "./app/reports/ReportsPage";
import ActionsPage from "./app/actions/ActionsPage";
import MapsPage from "./app/maps/MapsPage";
import AnalysisPage from "./app/analysis/AnalysisPage";
import Dashboard from "./app/dashboard/Dashboard";
import TestFetch from "./app/dashboard/TestFetch";
import VoterListPage from "./app/voters/VoterListPage";
import WalkListPage from "./app/walk/WalkListPage";
import NameSearchPage from "./app/voters/NameSearchPage";
import SettingsPage from "./app/settings/SettingsPage";
import FirebaseManagementPage from "./app/admin/FirebaseManagementPage";

import { Box, CircularProgress, Typography } from "@mui/material";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const { logSuccess } = useActivityLogger();

  // Renamed 'loading' to 'authLoading' for clarity on the state being tracked
  const [authLoading, setAuthLoading] = useState(true);

  // NEW STATE: Tracks when the user's custom claims have been fetched and set.
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [claims, setClaims] = useState<any>(null);

  const authenticatedApp = useMemo(
    () => (
      <MainLayout>
        <Routes>
          {/* Core Pages */}
          <Route path="/reports" element={<ReportsPage />} />
          {/* ... all other routes ... */}
          <Route path="/dashboard" element={<TestFetch />} />
          {/* ... all other routes ... */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </MainLayout>
    ),
    []
  ); // Empty dependency array means this only creates the object once.

  // 1. Listen for Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("AUTH STATE CHANGED!");
      console.log("→ currentUser:", currentUser);
      console.log("→ email:", currentUser?.email || "none");
      console.log("→ uid:", currentUser?.uid || "none");

      setUser(currentUser);
      setAuthLoading(false); // Auth is done loading
    });

    return () => {
      console.log("App.tsx: Cleaning up auth listener");
      unsubscribe();
    };
  }, []);

  // 2. Fetch/Set Claims When User Object is Stable
  useEffect(() => {
    // If auth is still loading or there is no user, reset and stop.
    if (!user) {
      setClaims(null);
      setClaimsLoading(false); // Claims are 'loaded' (as null)
      return;
    }

    // Start loading claims
    setClaimsLoading(true);

    // CRITICAL: Immediately force-refresh and set initial claims only once.
    // This provides the first stable 'claims' object to the context.
    user
      .getIdTokenResult(true)
      .then((tokenResult) => {
        console.log("🔥 INITIAL CLAIMS SET, NOW STABLE:", tokenResult.claims);
        setClaims(tokenResult.claims);
        setClaimsLoading(false); // Claims are now loaded and stable
      })
      .catch((error) => {
        console.error("Error fetching initial claims:", error);
        setClaims(null);
        setClaimsLoading(false); // Ensure app doesn't hang on error
      });

    // Passive listener for token refreshes (without forcing a network roundtrip)
    const unsubscribe = onIdTokenChanged(auth, async (u: User | null) => {
      if (u) {
        // Fetch new token passively; this will cause subsequent, safe updates.
        const tokenResult = await u.getIdTokenResult();
        setClaims(tokenResult.claims);
      }
    });

    return unsubscribe;
  }, [user]); // Re-runs ONLY when the user object changes

  // 3. Activity Logger (Unrelated to the bug)
  useEffect(() => {
    if (user) {
      logSuccess();
    }
  }, [user, logSuccess]);

  // Combined Loading Check: Wait for both Auth and Claims
  if (authLoading || claimsLoading) {
    // console.log("App.tsx: Still loading auth or claims state...");
    
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
        <Typography ml={2}>Loading GroundGame26...</Typography>
      </Box>
    );
  }

  // Auth is loaded and claims are loaded (non-null or null)
  if (!user) {
    // console.log("No user → showing LoginPage");
    return <LoginPage />;
  }

  // User is logged in — check MFA
  const mfaFactors = multiFactor(user).enrolledFactors;

  if (mfaFactors.length === 0) {
    // console.log("NO MFA → SHOWING ENROLLMENT SCREEN NOW");
    return <EnrollMFAScreen />;
  }

  // MFA enrolled → showing main app
  return (
    <AuthProvider user={user} claims={claims}>
      {authenticatedApp}
    </AuthProvider>
  );
}
