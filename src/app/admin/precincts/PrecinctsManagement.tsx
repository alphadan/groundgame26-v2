// src/app/admin/precincts/PrecinctsManagement.tsx
import React, { useEffect } from "react";
import { useAuth } from "../../../context/AuthContext"; // adjust path as needed
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db"; // adjust path
import { UserPermissions } from "../../../types"; // adjust path

// Import existing components
import { CreatePrecinctForm } from "../components/CreatePrecinctForm";
import { ImportPrecinctsForm } from "../components/ImportPrecinctsForm";

// Navigation & back button
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

export default function PrecinctsManagement() {
  const { user, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  // Fetch local user for permissions
  const localUser = useLiveQuery(async () => {
    if (!user?.uid) return null;
    return await indexedDb.users.get(user.uid);
  }, [user?.uid]);

  const permissions: UserPermissions = (localUser?.permissions || {
    can_create_documents: false,
    can_upload_collections: false,
    // ... other flags as needed
  }) as UserPermissions;

  const canCreateDocuments = !!permissions.can_create_documents;
  const canUploadCollections = !!permissions.can_upload_collections;

  const hasAccess = canCreateDocuments || canUploadCollections;

  // Prevent cursor blinking after navigation
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  // Sub-tabs state: 0 = Create, 1 = Import
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
            You do not have permission to manage precincts.
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
            Manage Precincts
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Create, import, and organize precincts
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Tabs - only show if user has any relevant permission */}
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
              label="Create Precinct"
              disabled={!canCreateDocuments}
              sx={{ fontWeight: tabValue === 0 ? "bold" : "normal" }}
            />
            <Tab
              label="Import Precincts (Bulk)"
              disabled={!canUploadCollections}
              sx={{ fontWeight: tabValue === 1 ? "bold" : "normal" }}
            />
          </Tabs>
        </Box>
      )}

      {/* Tab Content */}
      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          backgroundColor: "background.paper",
        }}
      >
        {tabValue === 0 && canCreateDocuments ? (
          <CreatePrecinctForm />
        ) : tabValue === 0 && !canCreateDocuments ? (
          <Alert severity="info">
            You do not have permission to create individual precincts.
          </Alert>
        ) : null}

        {tabValue === 1 && canUploadCollections ? (
          <ImportPrecinctsForm />
        ) : tabValue === 1 && !canUploadCollections ? (
          <Alert severity="info">
            You do not have permission to perform bulk precinct imports.
          </Alert>
        ) : null}
      </Paper>

      {/* Future features section */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          Planned Enhancements
        </Typography>
        <Box component="ul" sx={{ pl: 3, mt: 1 }}>
          <Typography component="li" variant="body1">
            Complete precinct list with search, filter, and assignment tools
          </Typography>
          <Typography component="li" variant="body1">
            Edit and delete existing precincts
          </Typography>
          <Typography component="li" variant="body1">
            Export precinct data (CSV/JSON)
          </Typography>
          <Typography component="li" variant="body1">
            Bulk assignment of users/teams to precincts
          </Typography>
          <Typography component="li" variant="body1">
            Validation during import + error reporting
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
