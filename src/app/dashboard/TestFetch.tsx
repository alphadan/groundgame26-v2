import React, { useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Button, Box, Typography, Paper, Divider } from "@mui/material";

export default function TestFetch() {
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addLog = (msg: string) =>
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

  const runSdkQuery = async () => {
    setLoading(true);
    addLog("🔍 Starting Firestore SDK Query...");

    try {
      const colRef = collection(db, "counties");
      const snapshot = await getDocs(query(colRef));
      addLog(`✅ SUCCESS: Found ${snapshot.size} docs.`);
    } catch (err: any) {
      addLog(`❌ SDK ERROR: [${err.code}] ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 800, mx: "auto", mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Database Connectivity Diagnostics
      </Typography>

      <Box display="flex" gap={2} mb={3}>
        <Button variant="contained" onClick={runSdkQuery} disabled={loading}>
          {loading ? "Querying..." : "Test Firestore SDK"}
        </Button>
      </Box>

      <Typography variant="subtitle2" color="textSecondary">
        System Logs:
      </Typography>
      <Box
        sx={{
          bgcolor: "#1e1e1e",
          color: "#00ff00",
          p: 2,
          borderRadius: 1,
          height: 200,
          overflow: "auto",
          fontFamily: "monospace",
          mt: 1,
        }}
      >
        {log.map((line, i) => (
          <Typography key={i} variant="caption" display="block">
            {line}
          </Typography>
        ))}
      </Box>
    </Paper>
  );
}
