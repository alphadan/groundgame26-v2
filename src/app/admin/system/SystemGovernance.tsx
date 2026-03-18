import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Tooltip,
  Alert,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Stack,
  CircularProgress,
  Divider,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import SaveIcon from "@mui/icons-material/Save";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export default function SystemGovernance() {
  const { role, isLoaded: authLoaded } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const isDeveloper = role === "developer";

  const [form, setForm] = useState({
    current_app_version: "",
    min_app_version: "",
    current_db_version: 0,
    maintenance_mode: false,
    legal_version: "",
  });

  // 1. DATA FETCH: Automatically populates the form with Cloud values
  useEffect(() => {
    const docRef = doc(db, "config", "app_control");
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setForm({
          current_app_version: data.current_app_version || "0.0.0",
          min_app_version: data.min_app_version || "0.0.0",
          current_db_version: data.current_db_version || 0,
          maintenance_mode: data.maintenance_mode || false,
          legal_version: data.legal_version || "2026.1",
        });
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleUpdateKeystone = async () => {
    if (!isDeveloper) return;
    setSaving(true);
    try {
      const docRef = doc(db, "config", "app_control");
      await updateDoc(docRef, {
        ...form,
        last_updated: Date.now(),
      });
      alert("System Keystone Updated Successfully!");
    } catch (err: any) {
      alert("Update Failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!authLoaded || loading) return <CircularProgress sx={{ m: 5 }} />;

  // 2. ACCESS GATE
  if (!isDeveloper) {
    return (
      <Box sx={{ p: 4 }}>
        <IconButton onClick={() => navigate("/admin")} sx={{ mb: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>
          <Typography variant="h6">Access Denied</Typography>
          Only users with the <b>Developer</b> role can modify the system
          keystone.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Tooltip title="Back to Admin Dashboard" arrow>
          <IconButton
            onClick={() => navigate("/admin")}
            color="primary"
            size="large"
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
        </Tooltip>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            System Governance
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Manage the global enforcement layers for code, data, and
            maintenance.
          </Typography>
        </Box>
      </Box>

      {/* DEVELOPER STATUS ALERT */}
      <Alert severity="info" sx={{ mb: 3 }}>
        You are logged in as a <strong>Developer</strong>. You have authorized
        access to modify global system controls.
      </Alert>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: "100%" }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Deployment Control
            </Typography>
            <Stack spacing={3} mt={2}>
              <TextField
                label="Latest Stable Build"
                fullWidth
                value={form.current_app_version}
                onChange={(e) =>
                  setForm({ ...form, current_app_version: e.target.value })
                }
                helperText="Informational: Matches the current build in package.json"
              />
              <TextField
                label="Minimum Required Build"
                fullWidth
                value={form.min_app_version}
                onChange={(e) =>
                  setForm({ ...form, min_app_version: e.target.value })
                }
                helperText="Enforcement: Blocks users on code versions lower than this"
              />
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: "100%" }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Schema & Legal
            </Typography>
            <Stack spacing={3} mt={2}>
              <TextField
                label="Current DB Schema Version"
                type="number"
                fullWidth
                value={form.current_db_version}
                onChange={(e) =>
                  setForm({
                    ...form,
                    current_db_version: Number(e.target.value),
                  })
                }
                helperText="Triggers hard reset of local IndexedDB for all users"
              />
              <TextField
                label="Legal Terms Version"
                fullWidth
                value={form.legal_terms_version}
                onChange={(e) =>
                  setForm({ ...form, legal_terms_version: e.target.value })
                }
                helperText="Forces users to re-sign Terms of Service if version mismatches"
              />
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Paper
            sx={{
              p: 3,
              border: "2px solid",
              borderColor: form.maintenance_mode ? "error.main" : "divider",
            }}
          >
            <Typography variant="h6" color="error" fontWeight="bold">
              Emergency Protocol
            </Typography>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              mt={2}
            >
              <Typography variant="body2">
                Maintenance mode disconnects all non-admin users from the
                application interface.
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.maintenance_mode}
                    onChange={(e) =>
                      setForm({ ...form, maintenance_mode: e.target.checked })
                    }
                    color="error"
                  />
                }
                label="MAINTENANCE MODE"
              />
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={
              saving ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <SaveIcon />
              )
            }
            disabled={saving}
            onClick={handleUpdateKeystone}
            sx={{ py: 2, fontWeight: "bold" }}
          >
            {saving ? "Publishing Changes..." : "Publish Keystone Update"}
          </Button>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box sx={{ mt: 6 }}>
            <Divider sx={{ mb: 3 }} />
            <Typography
              variant="h6"
              color="primary"
              gutterBottom
              sx={{ fontWeight: "bold" }}
            >
              Systems Manager Instructions (SOP)
            </Typography>
            <Paper
              variant="outlined"
              sx={{ p: 3, bgcolor: "action.hover", borderRadius: 2 }}
            >
              <Stack spacing={2}>
                <Typography variant="body2">
                  <strong>1. Versioning:</strong> Update{" "}
                  <strong>Latest Stable Build</strong> for standard updates. Use{" "}
                  <strong>Min Required Build</strong> to force a refresh for all
                  users.
                </Typography>
                <Typography variant="body2">
                  <strong>2. Database Migrations:</strong> Increment{" "}
                  <strong>Current DB Version</strong> only to fix corrupted
                  local data or add new tables.{" "}
                  <em>Triggers global re-sync.</em>
                </Typography>
                <Typography variant="body2">
                  <strong>3. Legal Compliance:</strong> Update{" "}
                  <strong>Legal Terms Version</strong> to force a re-sign of
                  Privacy Policies.
                </Typography>
                <Typography variant="body2">
                  <strong>4. Safety:</strong> Use{" "}
                  <strong>Maintenance Mode</strong> during large-scale Firestore
                  imports.
                </Typography>
              </Stack>
            </Paper>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
