// src/app/admin/users/UsersManagement.tsx
import React, { useEffect } from "react";
import { useAuth } from "../../../context/AuthContext"; // adjust path as needed
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db"; // adjust path
import { UserPermissions } from "../../../types"; // adjust path
import { CreateUserForm } from "../components/CreateUserForm"; // ← import from your existing location

// NEW IMPORTS for back button
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

export default function UsersManagement() {
  const { user, claims, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  // Fetch local user from IndexedDB to derive permissions
  const localUser = useLiveQuery(async () => {
    if (!user?.uid) return null;
    return await indexedDb.users.get(user.uid);
  }, [user?.uid]);

  // Derive permission flags (same logic as before)
  const permissions: UserPermissions = (localUser?.permissions || {
    can_manage_resources: false,
    can_upload_collections: false,
    can_create_collections: false,
    can_create_documents: false,
    can_create_users: false, // ← important for this page
  }) as UserPermissions;

  const canCreateUsers = !!permissions.can_create_users;

  // Global access check for this page (can be more strict than global admin)
  const hasAccess = canCreateUsers;

  // Optional: reset any local state if needed (future-proofing)
  useEffect(() => {
    // Can be used later for tab-like sub-views or error recovery
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
            You do not have permission to manage users.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Back Button + Title Row */}
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
            Manage Users
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Create, edit, and manage message templates
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Main content area */}
      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          backgroundColor: "background.paper",
        }}
      >
        {/* Existing form - will expand later with list/table */}
        {canCreateUsers ? (
          <CreateUserForm claims={claims} />
        ) : (
          <Alert severity="info">
            You have view access but cannot create new users at this time.
          </Alert>
        )}
      </Paper>

      {/* Future expansion placeholders */}
      <Box sx={{ mt: 5 }}>
        <Typography variant="h5" gutterBottom>
          User List / Overview (Coming Soon)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          • Search and filter users
          <br />• Edit / Delete existing accounts
          <br />• View activity logs
        </Typography>
      </Box>
    </Box>
  );
}
