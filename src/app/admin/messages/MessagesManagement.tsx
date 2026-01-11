// src/app/admin/messages/MessagesManagement.tsx
import React, { useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db";
import { UserPermissions } from "../../../types";
import { MessageTemplateForm } from "../components/MessageTemplateForm";

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

export default function MessagesManagement() {
  const { user, claims, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  const localUser = useLiveQuery(async () => {
    if (!user?.uid) return null;
    return await indexedDb.users.get(user.uid);
  }, [user?.uid]);

  const permissions: UserPermissions = (localUser?.permissions || {
    can_manage_resources: false,
    // ... other flags
  }) as UserPermissions;

  const canManageResources = !!permissions.can_manage_resources;
  const hasAccess = canManageResources;

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
            You do not have permission to manage message templates.
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
            Manage Messages
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Create, edit, and manage message templates
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          backgroundColor: "background.paper",
        }}
      >
        {canManageResources ? (
          <MessageTemplateForm />
        ) : (
          <Alert severity="info">
            You currently do not have permission to create or modify message
            templates.
          </Alert>
        )}
      </Paper>

      {/* Future features section remains the same */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          Additional Features (Planned)
        </Typography>
        {/* ... */}
      </Box>
    </Box>
  );
}
