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
  getDocs,
  where,
  getDocsFromServer,
  serverTimestamp,
  doc,
  setDoc,
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

  // 0. Define the shape of your document

  useEffect(() => {
    interface TestData {
      active: boolean;
      test_field: string;
      [key: string]: any;
    }

    // 1. Only run if we have a user AND the Auth Gatekeeper is finished
    if (!isLoaded || !user?.uid) return;

    let isMounted = true; // Prevents logging on unmounted components

    async function runDiagnostic() {
      try {
        const usersRef = collection(db, "test_data");
        // Use getDocs instead of a persistent listener for a one-time test
        const querySnapshot = await getDocs(usersRef);

        if (isMounted) {
          console.log(
            `✅ [App] Connection Stable. Docs found: ${querySnapshot.size}`
          );
        }
      } catch (error: any) {
        if (isMounted) console.error("[App] Diagnostic failed:", error.code);
      }
    }

    runDiagnostic();

    return () => {
      isMounted = false;
    }; // Cleanup
  }, [user?.uid, isLoaded]); // Depend on isLoaded!

  useEffect(() => {
    if (!user?.uid) return;

    interface TestData {
      active: boolean;
      test_field: string;
      [key: string]: any;
    }

    console.log("[App] user: ", user.uid);
    console.log("[App] db.app.options.projectId: ", db.app.options.projectId);

    async function testDB(): Promise<void> {
      try {
        const usersRef = collection(db, "test_data");

        // You can skip query() and where() entirely
        const querySnapshot = await getDocs(usersRef);

        if (querySnapshot.empty) {
          console.log("⚠️ [App] Collection is empty.");
        } else {
          console.log(
            `✅ [App] READ SUCCESS: Found ${querySnapshot.size} docs.`
          );
          querySnapshot.forEach((doc) => {
            console.log(`- Doc ID: ${doc.id}`, doc.data());
          });
        }
      } catch (error: any) {
        console.error(
          "[App] Error reading collection:",
          error.code,
          error.message
        );
      }
    }

    testDB();
  }, [user?.uid]);

  /*
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
  */

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
