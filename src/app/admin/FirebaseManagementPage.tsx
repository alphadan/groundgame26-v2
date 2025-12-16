// src/app/admin/FirebaseManagementPage.tsx
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
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
} from "@mui/material";
import { Area } from "../../types/Area";
import areasData from "../../constants/areas.json";
import { USERS_TO_IMPORT } from "../../constants/usersToImport";
import { UserDoc } from "../../types/User";

const areas: Area[] = areasData;

export default function FirebaseManagementPage() {
  const { claims } = useAuth();
  const { callFunction } = useCloudFunctions();

  // Areas import state
  const [importingAreas, setImportingAreas] = useState(false);
  const [areasProgress, setAreasProgress] = useState(0);
  const [areasMessage, setAreasMessage] = useState<string | null>(null);

  // Single user form state
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
    theme: "light", // default
  });

  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Bulk import state
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<
    { email: string; success: boolean; message: string }[]
  >([]);

  const isStateAdmin = claims?.role === "state_admin";

  // === IMPORT AREAS (unchanged) ===
  const importAreas = async () => {
    if (!isStateAdmin) return;

    setImportingAreas(true);
    setAreasProgress(0);
    setAreasMessage(null);

    const areasCollection = collection(db, "areas");
    let successCount = 0;
    const total = areasData.length;

    try {
      for (let i = 0; i < total; i++) {
        await addDoc(areasCollection, areasData[i]);
        successCount++;
        setAreasProgress(Math.round(((i + 1) / total) * 100));
      }
      setAreasMessage(
        `Import complete! ${successCount} areas added successfully.`
      );
    } catch (error: any) {
      console.error("Import failed:", error);
      setAreasMessage(`Error: ${error.message || "Unknown error"}`);
    } finally {
      setImportingAreas(false);
    }
  };

  // === CREATE SINGLE USER ===
  const handleCreateSingleUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.display_name.trim()) return;

    setSingleLoading(true);
    setSingleResult(null);

    try {
      // Use the hook instead of direct httpsCallable
      const result = await callFunction("adminCreateUser", {
        email: formData.email.trim(),
        display_name: formData.display_name.trim(),
        preferred_name: formData.preferred_name || "",
        phone: formData.phone || "",
        photo_url: formData.photo_url || "",
        org_id: formData.org_id || "",
        primary_county: formData.primary_county || "",
        primary_precinct: formData.primary_precinct || "",
        role: formData.role || "",
        theme: formData.theme || "light",
      });

      setSingleResult({ success: true, message: result.data as string });

      // Reset form on success
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
      setSingleResult({
        success: false,
        message: err.message || "Failed to create user",
      });
    } finally {
      setSingleLoading(false);
    }
  };

  // === BULK IMPORT (unchanged logic) ===
  const handleBulkImport = async () => {
    setBulkLoading(true);
    setBulkResults([]);

    const results = [];

    for (const user of USERS_TO_IMPORT) {
      try {
        const result = await callFunction("adminCreateUser", {
          email: user.email,
          display_name: user.displayName,
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
          message: result.data as string,
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
  };

  if (!isStateAdmin) {
    return (
      <Box p={6} textAlign="center">
        <Alert
          severity="error"
          variant="filled"
          sx={{ maxWidth: 600, mx: "auto" }}
        >
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

      {/* === IMPORT AREAS === */}
      <Paper sx={{ p: 4, mb: 6 }}>
        <Typography variant="h6" gutterBottom>
          Import Areas (Chester GOP)
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          This will add {areasData.length} areas to the 'areas' collection.
        </Typography>

        <Button
          variant="contained"
          color="primary"
          onClick={importAreas}
          disabled={importingAreas}
          size="large"
        >
          {importingAreas ? "Importing..." : "Import Areas"}
        </Button>

        {importingAreas && (
          <Box sx={{ mt: 3, width: "100%" }}>
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

      {/* === CREATE SINGLE USER === */}
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
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </Grid>
            <Grid>
              <TextField
                label="Display Name (required)"
                fullWidth
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                required
              />
            </Grid>
            <Grid>
              <TextField
                label="Preferred Name"
                fullWidth
                value={formData.preferred_name}
                onChange={(e) =>
                  setFormData({ ...formData, preferred_name: e.target.value })
                }
              />
            </Grid>
            <Grid>
              <TextField
                label="Phone"
                fullWidth
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </Grid>
            <Grid>
              <TextField
                label="Photo URL"
                fullWidth
                value={formData.photo_url}
                onChange={(e) =>
                  setFormData({ ...formData, photo_url: e.target.value })
                }
              />
            </Grid>
            <Grid>
              <TextField
                label="Org ID"
                fullWidth
                value={formData.org_id}
                onChange={(e) =>
                  setFormData({ ...formData, org_id: e.target.value })
                }
              />
            </Grid>
            <Grid>
              <TextField
                label="Primary County"
                fullWidth
                value={formData.primary_county}
                onChange={(e) =>
                  setFormData({ ...formData, primary_county: e.target.value })
                }
              />
            </Grid>
            <Grid>
              <TextField
                label="Primary Precinct"
                fullWidth
                value={formData.primary_precinct}
                onChange={(e) =>
                  setFormData({ ...formData, primary_precinct: e.target.value })
                }
              />
            </Grid>
            <Grid>
              <TextField
                label="Role (e.g. state_admin, county_chair)"
                fullWidth
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
              />
            </Grid>
            <Grid>
              <TextField
                label="Theme"
                fullWidth
                select
                SelectProps={{ native: true }}
                value={formData.theme}
                onChange={(e) =>
                  setFormData({ ...formData, theme: e.target.value })
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </TextField>
            </Grid>
          </Grid>

          <Button
            type="submit"
            variant="contained"
            disabled={singleLoading}
            sx={{ mt: 4 }}
            size="large"
          >
            {singleLoading ? <CircularProgress size={24} /> : "Create User"}
          </Button>
        </Box>

        {singleResult && (
          <Alert
            severity={singleResult.success ? "success" : "error"}
            sx={{ mt: 4 }}
          >
            {singleResult.message}
          </Alert>
        )}
      </Paper>

      {/* === BULK IMPORT USERS === */}
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Bulk Import Users ({USERS_TO_IMPORT.length} users)
        </Typography>

        <Button
          variant="contained"
          color="secondary"
          onClick={handleBulkImport}
          disabled={bulkLoading}
          sx={{ mb: 3 }}
        >
          {bulkLoading ? <CircularProgress size={24} /> : "Import All Users"}
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
                        size="small"
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
    </Box>
  );
}
