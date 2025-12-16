// src/app/dashboard/Dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from "@mui/material";
import {
  collection,
  onSnapshot,
  getDocs, // Keeping getDocs for reference, but using onSnapshot
} from "firebase/firestore";
import { enableNetwork } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { County } from "../../types/County";

export default function Dashboard() {
  const { user, claims } = useAuth();
  const [loading, setLoading] = useState(true);
  const [counties, setCounties] = useState<County[]>([]);
  const [selectedCounty, setSelectedCounty] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);

  const role = claims?.role || "unknown";

  // 1. Memoize isStateAdmin to create a stable dependency
  const isStateAdmin = useMemo(() => claims?.role === "state_admin", [claims]);

  // Use a simplified loading state check tied only to the fetch
  useEffect(() => {
    // If we're not an admin, we aren't loading the county data
    if (!isStateAdmin) {
      setLoading(false);
    }
  }, [isStateAdmin]);

  // Enable network access (optional, but good practice if disabling elsewhere)
  useEffect(() => {
    enableNetwork(db);
    console.log("Forced Firestore network enable");
  }, []);

  // Fetch active counties — only for state admins
  useEffect(() => {
    // 2. CRITICAL SCOPE FIX: Declare the unsubscribe variable here
    let unsubscribeListener: (() => void) | undefined;

    // 3. CRITICAL GUARD: Stop the effect if claims or user is not yet stable/present
    if (!claims) {
      return;
    }

    if (!isStateAdmin) {
      console.log("Not state_admin — skipping county fetch");
      setLoading(false);
      return;
    }

    console.log("User is state_admin — starting county fetch");

    // The logic is now inside the useEffect for better scope control
    setLoading(true);
    setFetchError(null);

    const collectionRef = collection(db, "counties");

    try {
      console.log("Executing onSnapshot() diagnostic...");

      unsubscribeListener = onSnapshot(
        collectionRef,
        (snapshot) => {
          // SUCCESS PATH
          console.log(
            "✅ onSnapshot successful! Data received. Size:",
            snapshot.size
          );
          const fetchedCounties = snapshot.docs.map(
            (doc) =>
              ({
                id: doc.id,
                ...doc.data(),
              } as County)
          );
          setCounties(fetchedCounties);
          setLoading(false);
        },
        (error: any) => {
          // ERROR PATH
          console.error("❌ onSnapshot FAILED:", error);
          setFetchError(error.message || "Failed to load counties.");
          setLoading(false);
        }
      );
    } catch (err: any) {
      // SYNCHRONOUS ERROR PATH (rare)
      console.error("❌ onSnapshot failed synchronously:", err);
      setFetchError(err.message || "Query failed to start.");
      setLoading(false);
    }

    // 4. CRITICAL CLEANUP: Return the cleanup function, which can now access
    //    the outer 'unsubscribeListener' variable.
    return () => {
      if (unsubscribeListener) {
        console.log("Dashboard: Cleaning up onSnapshot listener.");
        unsubscribeListener();
      }
    };

    // 5. Stable Dependency Array
  }, [claims, isStateAdmin]);
  // NOTE: isStateAdmin depends on claims, but having both helps ensure the effect
  // only runs once claims has a stable value set by the AuthProvider.

  // Component rendering checks
  if (!user || !claims) {
    // This should only show briefly due to App.tsx loading guard
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="70vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Dashboard
      </Typography>

      {/* Welcome Card */}
      <Paper sx={{ p: 4, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Welcome back, {user.displayName || user.email}
        </Typography>
        <Typography variant="body1">
          <strong>Role:</strong> {role.replace("_", " ").toUpperCase()}
        </Typography>
      </Paper>

      {/* County Selector — ONLY for state_admin */}
      {isStateAdmin && (
        <Paper sx={{ p: 4, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Select County
          </Typography>

          {fetchError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Error: {fetchError}
            </Alert>
          )}

          {loading ? (
            <Box display="flex" justifyContent="center" my={4}>
              <CircularProgress />
              <Typography ml={2}>Loading counties...</Typography>
            </Box>
          ) : counties.length === 0 && !fetchError ? (
            <Alert severity="info">
              No active counties found in Firestore.
            </Alert>
          ) : (
            <FormControl fullWidth>
              <InputLabel id="county-select-label">County</InputLabel>
              <Select
                labelId="county-select-label"
                value={selectedCounty}
                label="County"
                onChange={(e) => setSelectedCounty(e.target.value)}
              >
                <MenuItem value="">
                  <em>All Counties</em>
                </MenuItem>
                {counties.map((county) => (
                  <MenuItem key={county.id} value={county.code}>
                    {county.name} ({county.code.toUpperCase()})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Paper>
      )}

      {/* Future KPI Section */}
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Key Performance Indicators
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Coming soon: Bar charts for voter registration, mail-in ballots, and
          new volunteers by age group.
          {selectedCounty && ` (Filtered to ${selectedCounty})`}
        </Typography>
      </Paper>
    </Box>
  );
}
