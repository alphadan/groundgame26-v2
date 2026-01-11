// src/app/admin/groups/GroupsManagement.tsx  // Assuming route /admin/groups; adjust if /admin/organizations
import React, { useEffect } from "react";
import { useAuth } from "../../../context/AuthContext"; // adjust path
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db"; // adjust path
import { UserPermissions } from "../../../types"; // adjust path

// Import the new form
import { CreateGroupsForm } from "../components/CreateGroupsForm";

// Back button
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

export default function GroupsManagement() {
  const { user, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  const localUser = useLiveQuery(async () => {
    if (!user?.uid) return null;
    return await indexedDb.users.get(user.uid);
  }, [user?.uid]);

  const permissions: UserPermissions = (localUser?.permissions || {
    can_create_documents: false, // Assuming this for creating groups; adjust if needed
    // ... other permissions
  }) as UserPermissions;

  const canCreateGroups = !!permissions.can_create_documents; // Or add a new permission flag if needed

  const hasAccess = canCreateGroups;

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

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

  if (authLoaded && !hasAccess) {
    return (
      <Box p={6} textAlign="center">
        <Alert severity="error" variant="filled">
          <Typography variant="h6">Access Denied</Typography>
          <Typography variant="body1" mt={1}>
            You do not have permission to manage groups.
          </Typography>
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
            aria-label="back to dashboard"
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
        </Tooltip>

        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Manage Groups
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Create and manage groups (organizations)
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Paper elevation={3} sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
        {canCreateGroups ? (
          <CreateGroupsForm />
        ) : (
          <Alert severity="info">
            You do not have permission to create groups.
          </Alert>
        )}
      </Paper>

      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          Planned Features
        </Typography>
        <Box component="ul" sx={{ pl: 3, mt: 1 }}>
          <Typography component="li" variant="body1">
            Group list with search and edit
          </Typography>
          <Typography component="li" variant="body1">
            Bulk import/export
          </Typography>
          <Typography component="li" variant="body1">
            Assign users to groups
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
