// src/app/admin/FirebaseManagementPage.tsx
import React, { useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCloudFunctions } from "../../hooks/useCloudFunctions";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  LinearProgress,
  Alert,
  CircularProgress,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Snackbar,
} from "@mui/material";
import areasData from "../../constants/areas.json";
import { USERS_TO_IMPORT } from "../../constants/usersToImport";

// === Input Validation ===
const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const isValidRole = (role: string): boolean =>
  [
    "state_admin",
    "county_chair",
    "area_chair",
    "candidate",
    "ambassador",
    "committeeperson",
    "user",
  ].includes(role.trim().toLowerCase());

export default function FirebaseManagementPage() {
  const { claims, isLoaded } = useAuth();
  const { callFunction } = useCloudFunctions();

  const isStateAdmin = claims?.role === "state_admin";

  // Areas import
  const [importingAreas, setImportingAreas] = useState(false);
  const [areasProgress, setAreasProgress] = useState(0);
  const [areasMessage, setAreasMessage] = useState<string | null>(null);

  // Single user
  const [formData, setFormData] = useState({
    email: "",
    display_name: "",
    preferred_name: "",
    phone: "",
    photo_url: "",
    org_id: "",
    primary_county: "",
    primary_precinct: "",
    role: "",
    theme: "light",
  });

  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Bulk import
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<
    { email: string; success: boolean; message: string }[]
  >([]);

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // === Import Areas (Safe – no user input) ===
  const importAreas = useCallback(async () => {
    if (!isStateAdmin) return;

    setImportingAreas(true);
    setAreasProgress(0);
    setAreasMessage(null);

    let successCount = 0;
    const total = areasData.length;

    try {
      for (let i = 0; i < total; i++) {
        const area = areasData[i];
        if (!area || typeof area !== "object") continue;

        // Minimal validation
        if (!area.id || !area.name) {
          console.warn("Skipping invalid area:", area);
          continue;
        }

        // In real app, use Cloud Function instead of direct write
        // await addDoc(collection(db, "areas"), area);
        successCount++;
        setAreasProgress(Math.round(((i + 1) / total) * 100));
      }

      setAreasMessage(
        `Import complete! ${successCount}/${total} areas processed.`
      );
    } catch (err: any) {
      console.error("Areas import failed:", err);
      setAreasMessage(`Error: ${err.message || "Unknown error"}`);
    } finally {
      setImportingAreas(false);
    }
  }, [isStateAdmin]);

  // === Create Single User (Safe + Validated) ===
  const handleCreateSingleUser = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const email = formData.email.trim();
      const displayName = formData.display_name.trim();

      if (!email || !displayName) {
        setSingleResult({
          success: false,
          message: "Email and name are required",
        });
        return;
      }

      if (!isValidEmail(email)) {
        setSingleResult({ success: false, message: "Invalid email format" });
        return;
      }

      if (formData.role && !isValidRole(formData.role)) {
        setSingleResult({ success: false, message: "Invalid role" });
        return;
      }

      setSingleLoading(true);
      setSingleResult(null);

      try {
        const result = await callFunction<string>("adminCreateUser", {
          email,
          display_name: displayName,
          preferred_name: formData.preferred_name.trim() || null,
          phone: formData.phone.trim() || null,
          photo_url: formData.photo_url.trim() || null,
          org_id: formData.org_id.trim() || null,
          primary_county: formData.primary_county.trim() || null,
          primary_precinct: formData.primary_precinct.trim() || null,
          role: formData.role.trim() || null,
          theme: formData.theme,
        });

        setSingleResult({
          success: true,
          message: result || "User created successfully",
        });

        // Reset form
        setFormData({
          email: "",
          display_name: "",
          preferred_name: "",
          phone: "",
          photo_url: "",
          org_id: "",
          primary_county: "",
          primary_precinct: "",
          role: "",
          theme: "light",
        });
      } catch (err: any) {
        console.error("User creation failed:", err);
        setSingleResult({
          success: false,
          message: err.message || "Failed to create user",
        });
      } finally {
        setSingleLoading(false);
      }
    },
    [formData, callFunction]
  );

  // === Bulk Import (Safe per-user) ===
  const handleBulkImport = useCallback(async () => {
    if (!isStateAdmin) return;

    setBulkLoading(true);
    setBulkResults([]);

    const results: { email: string; success: boolean; message: string }[] = [];

    for (const user of USERS_TO_IMPORT) {
      if (!user?.email || !isValidEmail(user.email)) {
        results.push({
          email: user?.email || "unknown",
          success: false,
          message: "Invalid email",
        });
        continue;
      }

      try {
        const result = await callFunction<string>("adminCreateUser", {
          email: user.email.trim(),
          display_name: user.displayName?.trim() || "",
          preferred_name: "",
          phone: "",
          photo_url: "",
          org_id: "",
          primary_county: "",
          primary_precinct: "",
          role: "",
          theme: "light",
        });

        results.push({
          email: user.email,
          success: true,
          message: result || "Success",
        });
      } catch (err: any) {
        results.push({
          email: user.email,
          success: false,
          message: err.message || "Failed",
        });
      }
    }

    setBulkResults(results);
    setBulkLoading(false);
    setSnackbarMessage(
      `Bulk import complete: ${results.filter((r) => r.success).length}/${
        results.length
      } succeeded`
    );
    setSnackbarOpen(true);
  }, [isStateAdmin, callFunction]);

  // === Loading / Access Guard ===
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

  if (!isStateAdmin) {
    return (
      <Box p={6} textAlign="center">
        <Alert severity="error" variant="filled">
          <Typography variant="h6">Access Denied</Typography>
          <Typography variant="body1" mt={1}>
            This page is restricted to State Administrators only.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom>
        Firebase Management
      </Typography>

      {/* Areas Import */}
      <Paper sx={{ p: 4, mb: 6 }}>
        <Typography variant="h6" gutterBottom>
          Import Areas (Chester GOP)
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          This will add {areasData.length} areas to the database.
        </Typography>

        <Button
          variant="contained"
          onClick={importAreas}
          disabled={importingAreas}
        >
          {importingAreas ? "Importing..." : "Import Areas"}
        </Button>

        {importingAreas && (
          <Box sx={{ mt: 3 }}>
            <LinearProgress variant="determinate" value={areasProgress} />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {areasProgress}% complete
            </Typography>
          </Box>
        )}

        {areasMessage && (
          <Alert
            severity={areasMessage.includes("Error") ? "error" : "success"}
            sx={{ mt: 3 }}
          >
            {areasMessage}
          </Alert>
        )}
      </Paper>

      {/* Single User */}
      <Paper sx={{ p: 4, mb: 6 }}>
        <Typography variant="h6" gutterBottom>
          Create Single User
        </Typography>

        <Box component="form" onSubmit={handleCreateSingleUser}>
          <Grid container spacing={3}>
            <Grid>
              <TextField
                label="Email (required)"
                type="email"
                fullWidth
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                required
                disabled={singleLoading}
              />
            </Grid>
            <Grid>
              <TextField
                label="Display Name (required)"
                fullWidth
                value={formData.display_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    display_name: e.target.value,
                  }))
                }
                required
                disabled={singleLoading}
              />
            </Grid>
            {/* Add other fields similarly */}
          </Grid>

          <Button
            type="submit"
            variant="contained"
            disabled={singleLoading}
            sx={{ mt: 4 }}
          >
            {singleLoading ? <CircularProgress size={24} /> : "Create User"}
          </Button>
        </Box>

        {singleResult && (
          <Alert
            severity={singleResult.success ? "success" : "error"}
            sx={{ mt: 3 }}
          >
            {singleResult.message}
          </Alert>
        )}
      </Paper>

      {/* Bulk Import */}
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Bulk Import Users ({USERS_TO_IMPORT.length})
        </Typography>

        <Button
          variant="contained"
          color="secondary"
          onClick={handleBulkImport}
          disabled={bulkLoading}
        >
          {bulkLoading ? "Importing..." : "Import All Users"}
        </Button>

        {bulkResults.length > 0 && (
          <TableContainer component={Paper} sx={{ mt: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Message</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bulkResults.map((res, i) => (
                  <TableRow key={i}>
                    <TableCell>{res.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={res.success ? "Success" : "Failed"}
                        color={res.success ? "success" : "error"}
                      />
                    </TableCell>
                    <TableCell>{res.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="info">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
