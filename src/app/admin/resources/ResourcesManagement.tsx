// src/app/admin/resources/ResourcesManagement.tsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext"; // adjust path as needed
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db"; // adjust path
import { UserPermissions } from "../../../types"; // adjust path

// Import your existing component
import { CampaignResourcesManager } from "../components/CampaignResourcesManager";

// Back button imports
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
} from "@mui/material";

export default function ResourcesManagement() {
  const { user, claims, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  // Fetch local user permissions
  const localUser = useLiveQuery(async () => {
    if (!user?.uid) return null;
    return await indexedDb.users.get(user.uid);
  }, [user?.uid]);

  const permissions: UserPermissions = (localUser?.permissions || {
    can_manage_resources: false,
    can_upload_collections: false,
    can_create_collections: false,
    can_create_documents: false,
    can_create_users: false,
  }) as UserPermissions;

  const canManageResources = !!permissions.can_manage_resources;
  const hasAccess = canManageResources;

  // Prevent blinking cursor / retain focus from previous page
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

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
            You do not have permission to manage campaign resources.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Back Button + Title */}
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
            Manage Resources
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Upload, organize, and manage campaign resources and assets
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Main Content */}
      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          backgroundColor: "background.paper",
        }}
      >
        {canManageResources ? (
          <CampaignResourcesManager />
        ) : (
          <Alert severity="info">
            You do not have permission to manage campaign resources at this
            time.
          </Alert>
        )}
      </Paper>

      {/* Future Expansion Section */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          Planned Enhancements
        </Typography>
        <Box component="ul" sx={{ pl: 3, mt: 1 }}>
          <Typography component="li" variant="body1">
            Full resource library with search and filtering
          </Typography>
          <Typography component="li" variant="body1">
            Upload history and version control
          </Typography>
          <Typography component="li" variant="body1">
            Preview for images/videos/documents
          </Typography>
          <Typography component="li" variant="body1">
            Bulk upload and delete operations
          </Typography>
          <Typography component="li" variant="body1">
            Usage tracking (which campaigns use which resources)
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
