// src/app/dashboard/MyPrecinctsPage.tsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  limit,
  onSnapshotsInSync,
  getDocsFromServer,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

import {
  getFirestore,
  connectFirestoreEmulator,
  enableIndexedDbPersistence,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

interface County {
  id: string;
  name: string;
  code: string;
  active: boolean;
  [key: string]: any;
}

export default function MyPrecinctsPage() {
  const { user, claims } = useAuth();
  const [loading, setLoading] = useState(true);
  const [counties, setCounties] = useState<any[]>([]);
  const [selectedCounty, setSelectedCounty] = useState("");

  const testSimpleQuery = async () => {
    console.log("=== SIMPLE USERS QUERY STARTED ===");
    const snapshot = await getDocsFromServer(collection(db, "users"));
    console.log("UNFILTERED users size:", snapshot.size);
    console.log("From cache?", snapshot.metadata.fromCache);

    /* const testRef = collection(db, "users");
    console.log("testRef: ", testRef);
    const q = query(testRef); // no filter — fetch all
    console.log("q: ", q);
    const snapshot = await getDocsFromServer(q);
    console.log("Snapshot size:", snapshot.size);
    console.log("From cache?", snapshot.metadata.fromCache); // Likely true
    console.log("Has pending writes?", snapshot.metadata.hasPendingWrites);

    console.log("Test query snapshot: ", snapshot);

    if (snapshot) {
      snapshot.docs.forEach((doc) => {
        console.log("Test document:", doc.id, doc.data());
      });
    }
      */

    console.log("=== SIMPLE USERS QUERY END ===");
  };

  const fetchCounties = async () => {
    console.log("=== SIMPLE COUNTIES QUERY STARTED ===");

    const countiesRef = collection(db, "counties");
    console.log("counties countiesRef: ", countiesRef);
    const q = query(countiesRef); // NO where clause at all
    console.log("counties q :", q);

    const snapshot = await getDocsFromServer(q); // or getDocsFromServer(q) to be extra sure
    console.log("Snapshot size:", snapshot.size);
    console.log("From cache?:", snapshot.metadata.fromCache); // Will be false

    console.log("UNFILTERED counties size:", snapshot.size);
    snapshot.docs.forEach((doc) => {
      console.log("County doc:", doc.id, doc.data());
    });

    /* setLoading(true);
    try {
      const countiesRef = collection(db, "counties");
      console.log("counties countiesRef: ", countiesRef);
      const q = query(countiesRef, where("active", "==", true));

      console.log("counties q :", q);

      const snapshot = await getDocs(q);
      console.log("Snapshot size:", snapshot.size);
      console.log("From cache?", snapshot.metadata.fromCache); // Likely true
      console.log("Has pending writes?", snapshot.metadata.hasPendingWrites);

      const fetchedCounties: County[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }));

      fetchedCounties.sort((a, b) => a.name.localeCompare(b.name));

      setCounties(fetchedCounties);

      if (fetchedCounties.length > 0) {
        setSelectedCounty(fetchedCounties[0].code);
      }
    } catch (err) {
      console.error("Failed to load counties:", err);
    } finally {
      setLoading(false);
    }
      */
  };

  if (!user || !claims) {
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

  const role = claims.role || "unknown";
  const isStateAdmin = role === "state_admin";

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        My Precincts Dashboard
      </Typography>

      <Paper sx={{ p: 4, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Welcome, {user.email}
        </Typography>
        <Typography variant="body1">
          <strong>Role:</strong> {role.replace("_", " ").toUpperCase()}
        </Typography>
      </Paper>

      {/* County Selector — Only for state_admin */}

      {/* Placeholder for future content */}
      <Paper sx={{ p: 4 }}>
        <Alert severity="info">
          {isStateAdmin
            ? selectedCounty
              ? `Ready to load data for county ${selectedCounty}...`
              : "Please select a county to continue."
            : "Area-specific dashboard coming soon."}
        </Alert>
        <Button variant="outlined" onClick={fetchCounties} sx={{ mt: 2 }}>
          Refresh Counties (test)
        </Button>
        <Button onClick={testSimpleQuery} variant="outlined" sx={{ mt: 2 }}>
          Test Simple Query
        </Button>

        <Typography variant="body2" color="text.secondary" mt={2}>
          Next: We'll add area selector, precincts, voter stats, and team
          management.
        </Typography>
      </Paper>
    </Box>
  );
}
