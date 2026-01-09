// src/app/admin/FirebaseManagementPage.tsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../lib/db";
import { CampaignResource, UserPermissions } from "../../types";
import { MessageTemplateForm } from "./components/MessageTemplateForm";
import { AreaForm } from "./components/AreaForm";
import { ImportAreasForm } from "./components/ImportAreasForm";
import { CreatePrecinctForm } from "./components/CreatePrecinctForm";
import { ImportPrecinctsForm } from "./components/ImportPrecinctsForm";
import { CreateUserForm } from "./components/CreateUserForm";
import { CampaignResourcesManager } from "./components/CampaignResourcesManager";
import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  useTheme,
  useMediaQuery,
} from "@mui/material";

export default function FirebaseManagementPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const { user, claims, isLoaded: authLoaded } = useAuth();

  const localUser = useLiveQuery(async () => {
    if (!user?.uid) return null;
    return await indexedDb.users.get(user.uid);
  }, [user?.uid]);

  // 2. Derive specific permission flags
  const permissions: UserPermissions = (localUser?.permissions || {
    can_manage_resources: false,
    can_upload_collections: false,
    can_create_collections: false,
    can_create_documents: false,
  }) as UserPermissions;

  // Dynamic Permission Checks

  const canCreateCollections = !!permissions.can_create_collections;
  const canCreateUsers = !!permissions.can_create_users;
  const canManageResources = !!permissions.can_manage_resources;
  const canUploadCollections = !!permissions.can_upload_collections;
  const canCreateDocuments = !!permissions.can_create_documents;

  // Global access check: Does the user have ANY admin permission?
  const hasAccess =
    canManageResources || canUploadCollections || canCreateDocuments;

  const [tabValue, setTabValue] = useState(0);

  // === Tab Configuration ===
  // We define which tabs correspond to which permissions
  const availableTabs = [
    { label: "Message Templates", show: canManageResources },
    { label: "Create Area", show: canCreateDocuments },
    { label: "Import Areas", show: canUploadCollections },
    { label: "Create Precinct", show: canCreateDocuments },
    { label: "Import Precincts", show: canUploadCollections },
    { label: "Create User", show: canCreateUsers },
    // Match this label below
  ].filter((t) => t.show);

  // Defensive: if tabValue is out of range after filtering, reset to 0
  useEffect(() => {
    if (tabValue >= availableTabs.length) {
      setTabValue(0);
    }
  }, [availableTabs.length, tabValue]);

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
            You do not have the necessary permissions to manage Firebase
            resources.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        Admin Import Center
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom mb={4}>
        Securely create and import areas, precincts, and users
      </Typography>

      {/* Conditionally Render Tabs */}
      {availableTabs.length > 0 && (
        <>
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            sx={{ mb: 4 }}
            variant="scrollable"
            scrollButtons="auto"
          >
            {availableTabs.map((tab, index) => (
              <Tab key={index} label={tab.label} />
            ))}
          </Tabs>

          <Divider sx={{ mb: 4 }} />
          {/* Render the content based on the label of the active tab */}
          {availableTabs[tabValue]?.label === "Message Templates" && (
            <Paper sx={{ p: 4, borderRadius: 3 }}>
              <MessageTemplateForm />
            </Paper>
          )}
          {/* Render the content based on the label of the active tab */}
          {availableTabs[tabValue]?.label === "Create Area" && (
            <Paper sx={{ p: 4, borderRadius: 3 }}>
              <AreaForm />
            </Paper>
          )}
          {/* Render the content based on the label of the active tab */}
          {availableTabs[tabValue]?.label === "Import Areas" && (
            <Paper sx={{ p: 4, borderRadius: 3 }}>
              <ImportAreasForm />
            </Paper>
          )}
          {/* Render the content based on the label of the active tab */}
          {availableTabs[tabValue]?.label === "Create Precinct" && (
            <Paper sx={{ p: 4, borderRadius: 3 }}>
              <CreatePrecinctForm />
            </Paper>
          )}
          {/* Render the content based on the label of the active tab */}
          {availableTabs[tabValue]?.label === "Import Precincts" && (
            <Paper sx={{ p: 4, borderRadius: 3 }}>
              <ImportPrecinctsForm />
            </Paper>
          )}
          {/* Render the content based on the label of the active tab */}
          {availableTabs[tabValue]?.label === "Create User" && (
            <Paper sx={{ p: 4, borderRadius: 3 }}>
              <CreateUserForm />
            </Paper>
          )}
        </>
      )}
      {/* === Campaign Resources Management === */}
      {canManageResources ? (
        <Box sx={{ mt: 4 }}>
          <CampaignResourcesManager />
        </Box>
      ) : (
        <Box mt={4}>
          <Alert severity="info">
            You do not have permission to manage campaign resources.
          </Alert>
        </Box>
      )}
    </Box>
  );
}
