// src/app/dashboard/Dashboard.tsx
import React, { useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../lib/db";
import { syncReferenceData } from "../../services/referenceDataSync";
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
  Chip,
} from "@mui/material";

export default function Dashboard() {
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);
  const { user, claims, isLoaded } = useAuth();
  const [selectedCounty, setSelectedCounty] = useState("");

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncStatus("Starting manual sync...");
    try {
      // We pass 'true' to force the sync regardless of version mismatch
      const result = await syncReferenceData(true);
      setSyncStatus(
        result ? "✅ Sync Success!" : "⚠️ Sync returned false (check console)"
      );
    } catch (err: any) {
      setSyncStatus(`❌ Error: ${err.message}`);
      console.error("Manual Sync Error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // 1. LIVE QUERY: Replaces manual useState/useEffect for counties
  // It observes IndexedDB and re-renders automatically when syncReferenceData() finishes.
  const counties = useLiveQuery(async () => {
    if (claims?.role !== "state_admin") return [];

    // 1. Get all counties sorted by name
    const allCounties = await indexedDb.counties.orderBy("name").toArray();

    // 2. Filter by the 'active' property using standard JS logic
    // This avoids the IndexedDB boolean indexing limitation
    return allCounties.filter((county) => county.active === true);
  }, [claims]);

  // 2. Derived States
  // useLiveQuery returns 'undefined' while loading the initial result
  const isLoadingCounties = isLoaded && counties === undefined;

  // Use a different name from the global 'role' to avoid confusion
  const currentRole = claims?.role || "unknown";
  const isStateAdmin = useMemo(() => claims?.role === "state_admin", [claims]);

  // Phase 1: Wait for AuthContext (Gatekeeper)
  if (!isLoaded) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="70vh"
      >
        <CircularProgress sx={{ color: "#B22234" }} />
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Last synced: {new Date().toLocaleString()}
      </Typography>

      <Paper sx={{ p: 2, mb: 4, bgcolor: "#f8f9fa", border: "1px solid #ddd" }}>
        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
          System Diagnostics
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            style={{
              padding: "8px 16px",
              cursor: isSyncing ? "not-allowed" : "pointer",
            }}
          >
            {isSyncing ? "Syncing..." : "Force One-Click Sync"}
          </button>
          <Typography variant="body2">{syncStatus}</Typography>
        </Box>
      </Paper>

      <Paper sx={{ p: 4, mb: 4, borderRadius: 2 }}>
        <Typography variant="h6">
          Welcome, {user?.displayName || user?.email}
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          <strong>Authorized Role:</strong>{" "}
          {currentRole.replace("_", " ").toUpperCase()}
        </Typography>
      </Paper>

      {isStateAdmin && (
        <Paper sx={{ p: 4, mb: 4, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            State Administrator: County Control
          </Typography>

          {/* Show loading indicator ONLY while IndexedDB is initially being read */}
          {isLoadingCounties ? (
            <Box display="flex" alignItems="center" gap={2} my={2}>
              <CircularProgress size={24} />
              <Typography>Accessing local database...</Typography>
            </Box>
          ) : (
            <FormControl fullWidth>
              <InputLabel>Active Counties</InputLabel>
              <Select
                value={selectedCounty}
                label="Active Counties"
                onChange={(e) => setSelectedCounty(e.target.value)}
              >
                <MenuItem value="">
                  <em>Show All Active</em>
                </MenuItem>
                {counties?.map((county) => (
                  <MenuItem key={county.id} value={county.id}>
                    {county.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Paper>
      )}

      <Paper sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Key Performance Indicators
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Data visualization modules will initialize once a county is selected
          above.
          {selectedCounty && (
            <Chip
              label={`Focus: ${selectedCounty.toUpperCase()}`}
              sx={{ ml: 1 }}
              size="small"
            />
          )}
        </Typography>
      </Paper>
    </Box>
  );
}
