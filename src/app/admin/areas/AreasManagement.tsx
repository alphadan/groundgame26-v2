// src/app/admin/areas/AreasManagement.tsx
import React, { useEffect } from "react";
import { useAuth } from "../../../context/AuthContext"; // adjust path as needed
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db"; // adjust path
import { UserPermissions } from "../../../types"; // adjust path

// Import the two existing components
import { AreaForm } from "../components/AreaForm";
import { ImportAreasForm } from "../components/ImportAreasForm";

// Back button & navigation imports
import { useNavigate } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Tooltip from "@mui/material/Tooltip";

import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  Tabs,
  Tab,
} from "@mui/material";

export default function AreasManagement() {
  const { user, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  // Local user from IndexedDB for permissions
  const localUser = useLiveQuery(async () => {
    if (!user?.uid) return null;
    return await indexedDb.users.get(user.uid);
  }, [user?.uid]);

  const permissions: UserPermissions = (localUser?.permissions || {
    can_create_documents: false,
    can_upload_collections: false,
    // ... other flags
  }) as UserPermissions;

  const canCreateDocuments = !!permissions.can_create_documents;
  const canUploadCollections = !!permissions.can_upload_collections;

  // Access to this page
  const hasAccess = canCreateDocuments || canUploadCollections;

  // Prevent cursor blinking after navigation
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  // Sub-tabs state (Create vs Import)
  const [tabValue, setTabValue] = React.useState(0);

  // Loading state
  if (!authLoaded) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "70vh",
        }}
      >
        <CircularProgress color="primary" size={60} />
      </Box>
    );
  }

  // Access denied
  if (authLoaded && !hasAccess) {
    return (
      <Box p={6} textAlign="center">
        <Alert severity="error" variant="filled">
          <Typography variant="h6">Access Denied</Typography>
          <Typography variant="body1" mt={1}>
            You do not have permission to manage areas.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Back Button + Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Tooltip title="Back to Admin Dashboard" arrow>
          <IconButton
            onClick={() => navigate("/admin")}
            color="primary"
            size="large"
            sx={{ mr: 2 }}
            aria-label="back to dashboard"
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
        </Tooltip>

        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Manage Areas
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Create, import, and manage geographic areas
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Tabs for Create vs Import */}
      {hasAccess && (
        <Box sx={{ mb: 4 }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab
              label="Create / Edit Area"
              disabled={!canCreateDocuments}
              sx={{ fontWeight: tabValue === 0 ? "bold" : "normal" }}
            />
            <Tab
              label="Import Areas (Bulk)"
              disabled={!canUploadCollections}
              sx={{ fontWeight: tabValue === 1 ? "bold" : "normal" }}
            />
          </Tabs>
        </Box>
      )}

      {/* Content based on active tab */}
      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          backgroundColor: "background.paper",
        }}
      >
        {tabValue === 0 && canCreateDocuments ? (
          <AreaForm />
        ) : tabValue === 0 && !canCreateDocuments ? (
          <Alert severity="info">
            You do not have permission to create or edit individual areas.
          </Alert>
        ) : null}

        {tabValue === 1 && canUploadCollections ? (
          <ImportAreasForm />
        ) : tabValue === 1 && !canUploadCollections ? (
          <Alert severity="info">
            You do not have permission to import areas in bulk.
          </Alert>
        ) : null}
      </Paper>

      {/* Future features placeholder */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          Upcoming Features
        </Typography>
        <Box component="ul" sx={{ pl: 3, mt: 1 }}>
          <Typography component="li" variant="body1">
            Full area list with search, filter, and map preview
          </Typography>
          <Typography component="li" variant="body1">
            Edit and delete existing areas
          </Typography>
          <Typography component="li" variant="body1">
            Export areas (CSV/GeoJSON)
          </Typography>
          <Typography component="li" variant="body1">
            Validation and duplicate detection during import
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
