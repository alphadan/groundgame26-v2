import React, { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db as firestore } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { performHardReset } from "../../lib/db";
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  Alert,
  Container,
} from "@mui/material";
import UpgradeIcon from "@mui/icons-material/Upgrade";
import EngineeringIcon from "@mui/icons-material/Engineering";
import { AppControl } from "../../types";

interface Props {
  children: React.ReactNode;
}

// Helper to compare semantic versions (1.2.0 vs 1.1.9)
const isOutdated = (current: string, required: string) => {
  const parse = (v: string) => v.split("-")[0].split(".").map(Number);
  const v1 = parse(current);
  const v2 = parse(required);
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const n1 = v1[i] || 0;
    const n2 = v2[i] || 0;
    if (n1 < n2) return true;
    if (n1 > n2) return false;
  }
  return false;
};

export const VersionGuard: React.FC<Props> = ({ children }) => {
  const { user, role } = useAuth();
  const [keystone, setKeystone] = useState<AppControl | null>(null);
  const [status, setStatus] = useState<
    "checking" | "allowed" | "blocked_version" | "maintenance" | "resetting"
  >("checking");

  const APP_BUILD = "0.4.3-beta.9"; // This matches your package.json

  useEffect(() => {
    if (!user) {
      setStatus("allowed"); // Don't guard public login/reset pages
      return;
    }

    const unsub = onSnapshot(
      doc(firestore, "config", "app_control"),
      async (snap) => {
        if (!snap.exists()) {
          setStatus("allowed");
          return;
        }

        const data = snap.data() as AppControl;
        setKeystone(data);

        // 1. Check Maintenance (Allow Developers to bypass)
        if (data.maintenance_mode && role !== "developer") {
          setStatus("maintenance");
          return;
        }

        // 2. Check Build Version
        if (isOutdated(APP_BUILD, data.min_required_build)) {
          setStatus("blocked_version");
          return;
        }

        // 3. Check DB Schema Version
        // We look at the local IndexedDB 'app_control' table to see what we last synced
        const { db } = await import("../../lib/db");
        const localControl = await db.app_control.get("app_control");

        if (
          localControl &&
          localControl.current_db_version < data.current_db_version
        ) {
          console.warn("🔄 Schema Mismatch. Triggering Remote Reset...");
          setStatus("resetting");
          await performHardReset(true);
          window.location.reload(); // Refresh to start fresh sync
          return;
        }

        setStatus("allowed");
      },
    );

    return unsub;
  }, [user, role]);

  if (status === "checking") {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
      >
        <CircularProgress size={40} />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          Verifying System Integrity...
        </Typography>
      </Box>
    );
  }

  if (status === "maintenance") {
    return (
      <Container maxWidth="sm" sx={{ textAlign: "center", pt: 10 }}>
        <EngineeringIcon sx={{ fontSize: 80, color: "warning.main", mb: 2 }} />
        <Typography variant="h4" fontWeight="bold">
          System Maintenance
        </Typography>
        <Typography variant="body1" sx={{ mt: 2, mb: 4 }}>
          We are currently optimizing the database for the 2026 cycle. Please
          check back in a few minutes.
        </Typography>
        <Button variant="outlined" onClick={() => window.location.reload()}>
          Retry Connection
        </Button>
      </Container>
    );
  }

  if (status === "blocked_version") {
    return (
      <Container maxWidth="sm" sx={{ textAlign: "center", pt: 10 }}>
        <UpgradeIcon sx={{ fontSize: 80, color: "error.main", mb: 2 }} />
        <Typography variant="h4" fontWeight="bold">
          Update Required
        </Typography>
        <Typography variant="body1" sx={{ mt: 2, mb: 4 }}>
          Your version of GroundGame26 (v{APP_BUILD}) is no longer supported. A
          critical security or data fix is required.
        </Typography>
        <Alert severity="error" sx={{ mb: 4 }}>
          Required Version: {keystone?.min_required_build}
        </Alert>
        <Button
          variant="contained"
          size="large"
          onClick={() => window.location.reload()}
        >
          Refresh Browser to Update
        </Button>
      </Container>
    );
  }

  if (status === "resetting") {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
      >
        <CircularProgress color="secondary" />
        <Typography sx={{ mt: 2 }}>Updating Database Schema...</Typography>
      </Box>
    );
  }

  return <>{children}</>;
};
