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
  Chip,
} from "@mui/material";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  QuerySnapshot,
  DocumentData,
  FirestoreError,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { County } from "../../types/County";

export default function Dashboard() {
  // 1. Pull isLoaded to ensure the Gatekeeper has finished
  const { user, claims, isLoaded } = useAuth();
  const [loading, setLoading] = useState(false);
  const [counties, setCounties] = useState<County[]>([]);
  const [selectedCounty, setSelectedCounty] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);

  const role = claims?.role || "unknown";
  const isStateAdmin = useMemo(() => claims?.role === "state_admin", [claims]);

  useEffect(() => {
    // 1. Create a variable to hold the 'hang up' function
    let unsubscribe: () => void;

    const q = query(collection(db, "counties"), orderBy("name"));

    // 2. Start the listener and save the returned function to our variable
    unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as County)
      );
      setCounties(data);
      setLoading(false);
    });

    // 3. THE CLEANUP: This is the 'unsubscribe' method
    // React calls this automatically when the component is destroyed
    return () => {
      if (unsubscribe) {
        console.log("🧹 Hanging up the listener...");
        unsubscribe();
      }
    };
  }, [user?.uid, isStateAdmin]);

  // Phase 1: Wait for AuthContext Gatekeeper
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

      <Paper sx={{ p: 4, mb: 4, borderRadius: 2 }}>
        <Typography variant="h6">
          Welcome, {user?.displayName || user?.email}
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          <strong>Authorized Role:</strong>{" "}
          {role.replace("_", " ").toUpperCase()}
        </Typography>
      </Paper>

      {isStateAdmin && (
        <Paper sx={{ p: 4, mb: 4, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            State Administrator: County Control
          </Typography>

          {fetchError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {fetchError}
            </Alert>
          ) : loading ? (
            <Box display="flex" alignItems="center" gap={2} my={2}>
              <CircularProgress size={24} />
              <Typography>Synchronizing county data...</Typography>
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
