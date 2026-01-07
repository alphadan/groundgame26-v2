// src/app/admin/FirebaseManagementPage.tsx
import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCloudFunctions } from "../../hooks/useCloudFunctions";
import { useLiveQuery } from "dexie-react-hooks";
import { db as firestore } from "../../lib/firebase";
import { db as indexedDb } from "../../lib/db";
import { CampaignResource, UserPermissions } from "../../types";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Grid,
  Stack,
  Tabs,
  Tab,
  Divider,
  useTheme,
  useMediaQuery,
  FormControlLabel,
  Switch,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  Snackbar,
} from "@mui/material";
import {
  UploadFile,
  CloudUpload,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  addDoc,
} from "firebase/firestore";

// Validation
const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export default function FirebaseManagementPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const { user, claims, isLoaded: authLoaded } = useAuth();
  const { callFunction } = useCloudFunctions();

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
    { label: "Create Area", show: canCreateDocuments },
    { label: "Import Areas", show: canUploadCollections },
    { label: "Create Precinct", show: canCreateDocuments },
    { label: "Import Precincts", show: canUploadCollections },
    { label: "Create User", show: canCreateUsers }, // Changed to canCreateUsers
    { label: "Create Org Role", show: canCreateDocuments },
    { label: "Import Org Roles", show: canUploadCollections },
    { label: "Message Templates", show: canManageResources }, // Match this label below
  ].filter((t) => t.show);

  // Defensive: if tabValue is out of range after filtering, reset to 0
  useEffect(() => {
    if (tabValue >= availableTabs.length) {
      setTabValue(0);
    }
  }, [availableTabs.length, tabValue]);

  // === Campaign Resources Management ===
  const [resources, setResources] = useState<CampaignResource[]>([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const [newResource, setNewResource] = useState({
    title: "",
    description: "",
    category: "Brochures" as CampaignResource["category"],
    file: null as File | null,
  });

  // === Areas ===
  const [areaForm, setAreaForm] = useState({
    id: "",
    name: "",
    area_district: "",
    org_id: "",
    chair_uid: "",
    chair_email: "",
    vice_chair_uid: "",
    active: true,
  });
  const [creatingArea, setCreatingArea] = useState(false);
  const [areaResult, setAreaResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [areasJson, setAreasJson] = useState("");
  const [areasPreview, setAreasPreview] = useState<any[]>([]);
  const [importingAreas, setImportingAreas] = useState(false);
  const [areasImportResult, setAreasImportResult] = useState<string | null>(
    null
  );

  // === Message Template ===
  const [messageTemplateForm, setMessageTemplateForm] = useState({
    id: "",
    subject_line: "",
    body: "",
    category: "",
    tone: "",
    age_group: "",
    modeled_party: "",
    turnout_score_general: "",
    has_mail_ballot: "",
    tags: "",
    active: true,
  });
  const [creatingMessageTemplate, setCreatingMessageTemplate] = useState(false);
  const [messageTemplateResult, setMessageTemplateResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // === Precincts ===
  const [precinctForm, setPrecinctForm] = useState({
    id: "",
    name: "",
    precinct_code: "",
    area_district: "",
    county_code: "",
    congressional_district: "",
    senate_district: "",
    house_district: "",
    county_district: "",
    party_rep_district: "",
    active: true,
  });
  const [creatingPrecinct, setCreatingPrecinct] = useState(false);
  const [precinctResult, setPrecinctResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [precinctsJson, setPrecinctsJson] = useState("");
  const [precinctsPreview, setPrecinctsPreview] = useState<any[]>([]);
  const [importingPrecincts, setImportingPrecincts] = useState(false);
  const [precinctsImportResult, setPrecinctsImportResult] = useState<
    string | null
  >(null);

  const [orgRolesJson, setOrgRolesJson] = useState("");
  const [orgRolesPreview, setOrgRolesPreview] = useState<any[]>([]);
  const [importingOrgRoles, setImportingOrgRoles] = useState(false);
  const [orgRolesImportResult, setOrgRolesImportResult] = useState<
    string | null
  >(null);

  const [orgRoleForm, setOrgRoleForm] = useState({
    id: "", // Document ID, e.g. PA15-R-committeeperson-220
    uid: "",
    role: "committeeperson",
    org_id: "",
    county_code: "",
    area_district: "",
    precinct_code: "",
    is_vacant: false,
    active: true,
  });
  const [creatingOrgRole, setCreatingOrgRole] = useState(false);
  const [orgRoleResult, setOrgRoleResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // === Single User ===
  const [userForm, setUserForm] = useState({
    email: "",
    display_name: "",
    preferred_name: "",
    phone: "",
    photo_url: "",
    org_id: "",
    primary_county: "",
    primary_precinct: "",
    role: "",
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [userResult, setUserResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Handle JSON input
  const handleJsonInput = (
    value: string,
    setter: (v: string) => void,
    previewSetter: (v: any[]) => void
  ) => {
    setter(value);
    try {
      const parsed = JSON.parse(value);
      previewSetter(Array.isArray(parsed) ? parsed : []);
    } catch {
      previewSetter([]);
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void,
    previewSetter: (v: any[]) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleJsonInput(text, setter, previewSetter);
    };
    reader.readAsText(file);
  };

  // Create Area
  const handleCreateArea = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!areaForm.id || !areaForm.name || !areaForm.area_district) {
        setAreaResult({
          success: false,
          message: "ID, Name, and District are required",
        });
        return;
      }

      setCreatingArea(true);
      setAreaResult(null);

      try {
        await callFunction("adminCreateArea", {
          ...areaForm,
          active: areaForm.active,
        });
        setAreaResult({ success: true, message: "Area created successfully" });
        setAreaForm({
          id: "",
          name: "",
          area_district: "",
          org_id: "",
          chair_uid: "",
          chair_email: "",
          vice_chair_uid: "",
          active: true,
        });
      } catch (err: any) {
        setAreaResult({
          success: false,
          message: err.message || "Failed to create area",
        });
      } finally {
        setCreatingArea(false);
      }
    },
    [areaForm, callFunction]
  );

  // Import Areas
  const handleImportAreas = useCallback(async () => {
    if (!canUploadCollections || areasPreview.length === 0) return;

    setImportingAreas(true);
    setAreasImportResult(null);

    try {
      const result = await callFunction<{ success: number; total: number }>(
        "adminImportAreas",
        {
          data: areasPreview,
        }
      );

      setAreasImportResult(
        `Successfully imported ${result.success}/${result.total} areas`
      );
    } catch (err: any) {
      setAreasImportResult(`Error: ${err.message || "Import failed"}`);
    } finally {
      setImportingAreas(false);
    }
  }, [canUploadCollections, areasPreview, callFunction]);

  // Create Precinct
  const handleCreatePrecinct = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (
        !precinctForm.id ||
        !precinctForm.name ||
        !precinctForm.precinct_code
      ) {
        setPrecinctResult({
          success: false,
          message: "ID, Name, and Precinct Code are required",
        });
        return;
      }

      setCreatingPrecinct(true);
      setPrecinctResult(null);

      try {
        await callFunction("adminCreatePrecinct", {
          ...precinctForm,
          active: precinctForm.active,
        });
        setPrecinctResult({
          success: true,
          message: "Precinct created successfully",
        });
        setPrecinctForm({
          id: "",
          name: "",
          precinct_code: "",
          area_district: "",
          county_code: "",
          congressional_district: "",
          senate_district: "",
          house_district: "",
          county_district: "",
          party_rep_district: "",
          active: true,
        });
      } catch (err: any) {
        setPrecinctResult({
          success: false,
          message: err.message || "Failed to create precinct",
        });
      } finally {
        setCreatingPrecinct(false);
      }
    },
    [precinctForm, callFunction]
  );

  // Import Precincts
  const handleImportPrecincts = useCallback(async () => {
    if (!hasAccess || precinctsPreview.length === 0) return;

    setImportingPrecincts(true);
    setPrecinctsImportResult(null);

    try {
      const result = await callFunction<{ success: number; total: number }>(
        "adminImportPrecincts",
        {
          data: precinctsPreview,
        }
      );

      setPrecinctsImportResult(
        `Successfully imported ${result.success}/${result.total} precincts`
      );
    } catch (err: any) {
      setPrecinctsImportResult(`Error: ${err.message || "Import failed"}`);
    } finally {
      setImportingPrecincts(false);
    }
  }, [hasAccess, precinctsPreview, callFunction]);

  // Create User
  const handleCreateUser = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isValidEmail(userForm.email)) {
        setUserResult({ success: false, message: "Valid email required" });
        return;
      }

      setCreatingUser(true);
      setUserResult(null);

      try {
        const result = await callFunction<string>("adminCreateUser", {
          email: userForm.email.trim(),
          display_name: userForm.display_name.trim(),
          preferred_name: userForm.preferred_name.trim() || null,
          phone: userForm.phone.trim() || null,
          photo_url: userForm.photo_url.trim() || null,
          org_id: userForm.org_id.trim() || null,
          primary_county: userForm.primary_county.trim() || null,
          primary_precinct: userForm.primary_precinct.trim() || null,
          role: userForm.role.trim() || null,
        });

        setUserResult({
          success: true,
          message: result || "User created successfully",
        });
        setUserForm({
          email: "",
          display_name: "",
          preferred_name: "",
          phone: "",
          photo_url: "",
          org_id: "",
          primary_county: "",
          primary_precinct: "",
          role: "",
        });
      } catch (err: any) {
        setUserResult({
          success: false,
          message: err.message || "Failed to create user",
        });
      } finally {
        setCreatingUser(false);
      }
    },
    [userForm, callFunction]
  );

  //handle Create Org Role
  const handleCreateOrgRole = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!orgRoleForm.id || !orgRoleForm.org_id || !orgRoleForm.role) {
        setOrgRoleResult({
          success: false,
          message: "Document ID, Org ID, and Role are required",
        });
        return;
      }

      if (!orgRoleForm.is_vacant && !orgRoleForm.uid) {
        setOrgRoleResult({
          success: false,
          message: "UID is required when the role is not vacant",
        });
        return;
      }

      setCreatingOrgRole(true);
      setOrgRoleResult(null);

      try {
        await callFunction("adminCreateOrgRole", {
          id: orgRoleForm.id.trim(),
          uid: orgRoleForm.is_vacant ? null : orgRoleForm.uid.trim() || null,
          role: orgRoleForm.role,
          org_id: orgRoleForm.org_id,
          county_code: orgRoleForm.county_code || null,
          area_district: orgRoleForm.area_district || null,
          precinct_code: orgRoleForm.precinct_code,
          is_vacant: orgRoleForm.is_vacant,
          active: true,
        });

        setOrgRoleResult({
          success: true,
          message: "Org role created successfully",
        });

        // Reset form
        setOrgRoleForm({
          id: "",
          uid: "",
          role: "committeeperson",
          org_id: "",
          county_code: "",
          area_district: "",
          precinct_code: "",
          is_vacant: false,
          active: true,
        });
      } catch (err: any) {
        setOrgRoleResult({
          success: false,
          message: err.message || "Failed to create org role",
        });
      } finally {
        setCreatingOrgRole(false);
      }
    },
    [orgRoleForm, callFunction]
  );

  const handleImportOrgRoles = useCallback(async () => {
    if (!hasAccess || orgRolesPreview.length === 0) return;

    setImportingOrgRoles(true);
    setOrgRolesImportResult(null);

    try {
      const result = await callFunction<{ success: number; total: number }>(
        "adminImportOrgRoles",
        {
          roles: orgRolesPreview,
        }
      );

      setOrgRolesImportResult(
        `Successfully imported ${result.success}/${result.total} org roles`
      );
    } catch (err: any) {
      setOrgRolesImportResult(`Error: ${err.message || "Import failed"}`);
    } finally {
      setImportingOrgRoles(false);
    }
  }, [hasAccess, orgRolesPreview, callFunction]);

  const handleCreateMessageTemplate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (
        !messageTemplateForm.id ||
        !messageTemplateForm.subject_line ||
        !messageTemplateForm.body
      ) {
        setMessageTemplateResult({
          success: false,
          message: "Document ID, Subject, and Body are required",
        });
        return;
      }

      setCreatingMessageTemplate(true);
      setMessageTemplateResult(null);

      try {
        await callFunction("adminCreateMessageTemplate", {
          id: messageTemplateForm.id.trim(),
          subject_line: messageTemplateForm.subject_line.trim() || null,
          body: messageTemplateForm.body.trim(),
          category: messageTemplateForm.category,
          tone: messageTemplateForm.tone,
          age_group: messageTemplateForm.age_group.trim() || null,
          modeled_party: messageTemplateForm.modeled_party || null,
          turnout_score_general:
            messageTemplateForm.turnout_score_general || null,
          has_mail_ballot: messageTemplateForm.has_mail_ballot || null,
          tags: messageTemplateForm.tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t),
          active: messageTemplateForm.active,
        });

        setMessageTemplateResult({
          success: true,
          message: "Message template created successfully",
        });

        // Reset form
        setMessageTemplateForm({
          id: "",
          subject_line: "",
          body: "",
          category: "",
          tone: "",
          age_group: "",
          modeled_party: "",
          has_mail_ballot: "",
          turnout_score_general: "",
          tags: "",
          active: true,
        });
      } catch (err: any) {
        setMessageTemplateResult({
          success: false,
          message: err.message || "Failed to create message template",
        });
      } finally {
        setCreatingMessageTemplate(false);
      }
    },
    [messageTemplateForm, callFunction]
  );
  // Load resources on mount
  useEffect(() => {
    const load = async () => {
      setLoadingResources(true);
      try {
        const snapshot = await getDocs(
          query(
            collection(firestore, "campaign_resources"),
            orderBy("created_at", "desc")
          )
        );
        setResources(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as CampaignResource)
          )
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingResources(false);
      }
    };
    load();
  }, []);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setNewResource((prev) => ({ ...prev, file: e.target.files![0] }));
    }
  };

  // Upload using Cloud Function
  const handleUploadResource = async () => {
    if (!newResource.file || !newResource.title.trim()) {
      alert("Please provide a title and select a PDF file");
      return;
    }

    setUploadingResource(true);

    try {
      // Step 1: Get signed upload URL
      const result = await callFunction<{ uploadUrl: string }>(
        "adminGenerateResourceUploadUrl",
        {
          title: newResource.title.trim(),
          description: newResource.description.trim(),
          category: newResource.category,
          fileName: newResource.file.name,
        }
      );

      const { uploadUrl } = result;

      // Step 2: Upload file directly to Storage
      await fetch(uploadUrl, {
        method: "PUT",
        body: newResource.file,
        headers: {
          "Content-Type": "application/pdf",
        },
      });

      // Step 3: Save metadata to Firestore
      const downloadUrl = uploadUrl.split("?")[0] + "?alt=media";

      await addDoc(collection(firestore, "campaign_resources"), {
        title: newResource.title.trim(),
        description: newResource.description.trim(),
        category: newResource.category,
        fileName: newResource.file.name,
        url: downloadUrl,
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      alert("Resource uploaded successfully!");

      // Reset form
      setNewResource({
        title: "",
        description: "",
        category: "Brochures",
        file: null,
      });

      // Refresh list
      const snapshot = await getDocs(
        query(
          collection(firestore, "campaign_resources"),
          orderBy("created_at", "desc")
        )
      );
      setResources(
        snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as CampaignResource)
        )
      );
    } catch (err: any) {
      console.error("Upload failed:", err);
      alert(err.message || "Upload failed — please try again");
    } finally {
      setUploadingResource(false);
    }
  };

  // Delete resource
  const handleDeleteResource = async (id: string) => {
    setResourceToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!resourceToDelete) return;

    try {
      await deleteDoc(doc(firestore, "campaign_resources", resourceToDelete));
      setResources((prev) => prev.filter((r) => r.id !== resourceToDelete));
      setSnackbarMessage("Resource deleted successfully");
      setSnackbarOpen(true);
    } catch (err) {
      console.error("Delete failed:", err);
      setSnackbarMessage("Failed to delete resource");
      setSnackbarOpen(true);
    } finally {
      setDeleteConfirmOpen(false);
      setResourceToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmOpen(false);
    setResourceToDelete(null);
  };

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
          {availableTabs[tabValue]?.label === "Create Area" && (
            <Box>
              {
                <Paper sx={{ p: 4, borderRadius: 3 }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Create Individual Area
                  </Typography>

                  <Box
                    component="form"
                    onSubmit={handleCreateArea}
                    sx={{ mt: 3 }}
                  >
                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Document ID *"
                          fullWidth
                          value={areaForm.id}
                          onChange={(e) =>
                            setAreaForm((prev) => ({
                              ...prev,
                              id: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingArea}
                          helperText="e.g. PA15-A-14"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Name *"
                          fullWidth
                          value={areaForm.name}
                          onChange={(e) =>
                            setAreaForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingArea}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Area District *"
                          fullWidth
                          value={areaForm.area_district}
                          onChange={(e) =>
                            setAreaForm((prev) => ({
                              ...prev,
                              area_district: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingArea}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Org ID"
                          fullWidth
                          value={areaForm.org_id}
                          onChange={(e) =>
                            setAreaForm((prev) => ({
                              ...prev,
                              org_id: e.target.value,
                            }))
                          }
                          disabled={creatingArea}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Chair UID"
                          fullWidth
                          value={areaForm.chair_uid}
                          onChange={(e) =>
                            setAreaForm((prev) => ({
                              ...prev,
                              chair_uid: e.target.value,
                            }))
                          }
                          disabled={creatingArea}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Chair Email"
                          type="email"
                          fullWidth
                          value={areaForm.chair_email}
                          onChange={(e) =>
                            setAreaForm((prev) => ({
                              ...prev,
                              chair_email: e.target.value,
                            }))
                          }
                          disabled={creatingArea}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Vice Chair UID"
                          fullWidth
                          value={areaForm.vice_chair_uid}
                          onChange={(e) =>
                            setAreaForm((prev) => ({
                              ...prev,
                              vice_chair_uid: e.target.value,
                            }))
                          }
                          disabled={creatingArea}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={areaForm.active}
                              onChange={(e) =>
                                setAreaForm((prev) => ({
                                  ...prev,
                                  active: e.target.checked,
                                }))
                              }
                              disabled={creatingArea}
                            />
                          }
                          label="Active"
                        />
                      </Grid>
                    </Grid>

                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      sx={{ mt: 4, py: 1.5, fontWeight: "bold" }}
                      disabled={creatingArea}
                    >
                      {creatingArea ? "Creating..." : "Create Area"}
                    </Button>

                    {areaResult && (
                      <Alert
                        severity={areaResult.success ? "success" : "error"}
                        sx={{ mt: 3 }}
                      >
                        {areaResult.message}
                      </Alert>
                    )}
                  </Box>
                </Paper>
              }
            </Box>
          )}
          {/* Render the content based on the label of the active tab */}
          {availableTabs[tabValue]?.label === "Import Areas" && (
            <Box>
              {
                <Paper sx={{ p: 4, borderRadius: 3 }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Bulk Import Areas
                  </Typography>

                  <Stack spacing={3}>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<UploadFile />}
                    >
                      Upload Areas JSON
                      <input
                        type="file"
                        hidden
                        accept=".json"
                        onChange={(e) =>
                          handleFileUpload(e, setAreasJson, setAreasPreview)
                        }
                      />
                    </Button>

                    <TextField
                      multiline
                      rows={10}
                      fullWidth
                      label="Paste Areas JSON"
                      value={areasJson}
                      onChange={(e) =>
                        handleJsonInput(
                          e.target.value,
                          setAreasJson,
                          setAreasPreview
                        )
                      }
                      placeholder='[{"id": "PA15-A-14", "name": "Area 14", "area_district": "14", ...}]'
                    />

                    {areasPreview.length > 0 && (
                      <>
                        <Typography>
                          Preview: {areasPreview.length} areas
                        </Typography>

                        <Button
                          variant="contained"
                          onClick={handleImportAreas}
                          disabled={importingAreas}
                          startIcon={
                            importingAreas ? (
                              <CircularProgress size={20} />
                            ) : (
                              <CloudUpload />
                            )
                          }
                        >
                          {importingAreas ? "Importing..." : "Import Areas"}
                        </Button>

                        {areasImportResult && (
                          <Alert
                            severity={
                              areasImportResult.includes("Error")
                                ? "error"
                                : "success"
                            }
                          >
                            {areasImportResult}
                          </Alert>
                        )}
                      </>
                    )}
                  </Stack>
                </Paper>
              }
            </Box>
          )}
          {/* Render the content based on the label of the active tab */}
          {availableTabs[tabValue]?.label === "Create Precinct" && (
            <Box>
              {
                <Paper sx={{ p: 4, borderRadius: 3 }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Create Individual Precinct
                  </Typography>

                  <Box
                    component="form"
                    onSubmit={handleCreatePrecinct}
                    sx={{ mt: 3 }}
                  >
                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Document ID *"
                          fullWidth
                          value={precinctForm.id}
                          onChange={(e) =>
                            setPrecinctForm((prev) => ({
                              ...prev,
                              id: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingPrecinct}
                          helperText="e.g. PA15-P-005"
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Name *"
                          fullWidth
                          value={precinctForm.name}
                          onChange={(e) =>
                            setPrecinctForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingPrecinct}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Precinct Code *"
                          fullWidth
                          value={precinctForm.precinct_code}
                          onChange={(e) =>
                            setPrecinctForm((prev) => ({
                              ...prev,
                              precinct_code: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingPrecinct}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Area District"
                          fullWidth
                          value={precinctForm.area_district}
                          onChange={(e) =>
                            setPrecinctForm((prev) => ({
                              ...prev,
                              area_district: e.target.value,
                            }))
                          }
                          disabled={creatingPrecinct}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="County Code"
                          fullWidth
                          value={precinctForm.county_code}
                          onChange={(e) =>
                            setPrecinctForm((prev) => ({
                              ...prev,
                              county_code: e.target.value,
                            }))
                          }
                          disabled={creatingPrecinct}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Congressional District"
                          fullWidth
                          value={precinctForm.congressional_district}
                          onChange={(e) =>
                            setPrecinctForm((prev) => ({
                              ...prev,
                              congressional_district: e.target.value,
                            }))
                          }
                          disabled={creatingPrecinct}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Senate District"
                          fullWidth
                          value={precinctForm.senate_district}
                          onChange={(e) =>
                            setPrecinctForm((prev) => ({
                              ...prev,
                              senate_district: e.target.value,
                            }))
                          }
                          disabled={creatingPrecinct}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="House District"
                          fullWidth
                          value={precinctForm.house_district}
                          onChange={(e) =>
                            setPrecinctForm((prev) => ({
                              ...prev,
                              house_district: e.target.value,
                            }))
                          }
                          disabled={creatingPrecinct}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="County District"
                          fullWidth
                          value={precinctForm.county_district}
                          onChange={(e) =>
                            setPrecinctForm((prev) => ({
                              ...prev,
                              county_district: e.target.value,
                            }))
                          }
                          disabled={creatingPrecinct}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Party Rep District"
                          fullWidth
                          value={precinctForm.party_rep_district}
                          onChange={(e) =>
                            setPrecinctForm((prev) => ({
                              ...prev,
                              party_rep_district: e.target.value,
                            }))
                          }
                          disabled={creatingPrecinct}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={precinctForm.active}
                              onChange={(e) =>
                                setPrecinctForm((prev) => ({
                                  ...prev,
                                  active: e.target.checked,
                                }))
                              }
                              disabled={creatingPrecinct}
                            />
                          }
                          label="Active"
                        />
                      </Grid>
                    </Grid>

                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      sx={{ mt: 4, py: 1.5, fontWeight: "bold" }}
                      disabled={creatingPrecinct}
                    >
                      {creatingPrecinct ? "Creating..." : "Create Precinct"}
                    </Button>

                    {precinctResult && (
                      <Alert
                        severity={precinctResult.success ? "success" : "error"}
                        sx={{ mt: 3 }}
                      >
                        {precinctResult.message}
                      </Alert>
                    )}
                  </Box>
                </Paper>
              }
            </Box>
          )}
          {/* Render the content based on the label of the active tab */}
          {availableTabs[tabValue]?.label === "Import Precincts" && (
            <Box>
              {
                <Paper sx={{ p: 4, borderRadius: 3 }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Bulk Import Precincts
                  </Typography>

                  <Stack spacing={3}>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<UploadFile />}
                    >
                      Upload Precincts JSON
                      <input
                        type="file"
                        hidden
                        accept=".json"
                        onChange={(e) =>
                          handleFileUpload(
                            e,
                            setPrecinctsJson,
                            setPrecinctsPreview
                          )
                        }
                      />
                    </Button>

                    <TextField
                      multiline
                      rows={10}
                      fullWidth
                      label="Paste Precincts JSON"
                      value={precinctsJson}
                      onChange={(e) =>
                        handleJsonInput(
                          e.target.value,
                          setPrecinctsJson,
                          setPrecinctsPreview
                        )
                      }
                      placeholder='[{"id": "PA15-P-005", "name": "Atglen", "precinct_code": "005", ...}]'
                    />

                    {precinctsPreview.length > 0 && (
                      <>
                        <Typography>
                          Preview: {precinctsPreview.length} precincts
                        </Typography>

                        <Button
                          variant="contained"
                          onClick={handleImportPrecincts}
                          disabled={importingPrecincts}
                          startIcon={
                            importingPrecincts ? (
                              <CircularProgress size={20} />
                            ) : (
                              <CloudUpload />
                            )
                          }
                        >
                          {importingPrecincts
                            ? "Importing..."
                            : "Import Precincts"}
                        </Button>

                        {precinctsImportResult && (
                          <Alert
                            severity={
                              precinctsImportResult.includes("Error")
                                ? "error"
                                : "success"
                            }
                          >
                            {precinctsImportResult}
                          </Alert>
                        )}
                      </>
                    )}
                  </Stack>
                </Paper>
              }
            </Box>
          )}
          {/* Render the content based on the label of the active tab */}
          {availableTabs[tabValue]?.label === "Create User" && (
            <Box>
              {
                <Paper sx={{ p: 4, borderRadius: 3 }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Create Individual User
                  </Typography>

                  <Box
                    component="form"
                    onSubmit={handleCreateUser}
                    sx={{ mt: 3 }}
                  >
                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Email *"
                          type="email"
                          fullWidth
                          value={userForm.email}
                          onChange={(e) =>
                            setUserForm((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingUser}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Display Name *"
                          fullWidth
                          value={userForm.display_name}
                          onChange={(e) =>
                            setUserForm((prev) => ({
                              ...prev,
                              display_name: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingUser}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Preferred Name"
                          fullWidth
                          value={userForm.preferred_name}
                          onChange={(e) =>
                            setUserForm((prev) => ({
                              ...prev,
                              preferred_name: e.target.value,
                            }))
                          }
                          disabled={creatingUser}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Phone"
                          fullWidth
                          value={userForm.phone}
                          onChange={(e) =>
                            setUserForm((prev) => ({
                              ...prev,
                              phone: e.target.value,
                            }))
                          }
                          disabled={creatingUser}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Photo URL"
                          fullWidth
                          value={userForm.photo_url}
                          onChange={(e) =>
                            setUserForm((prev) => ({
                              ...prev,
                              photo_url: e.target.value,
                            }))
                          }
                          disabled={creatingUser}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Org ID"
                          fullWidth
                          value={userForm.org_id}
                          onChange={(e) =>
                            setUserForm((prev) => ({
                              ...prev,
                              org_id: e.target.value,
                            }))
                          }
                          disabled={creatingUser}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Primary County"
                          fullWidth
                          value={userForm.primary_county}
                          onChange={(e) =>
                            setUserForm((prev) => ({
                              ...prev,
                              primary_county: e.target.value,
                            }))
                          }
                          disabled={creatingUser}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Primary Precinct"
                          fullWidth
                          value={userForm.primary_precinct}
                          onChange={(e) =>
                            setUserForm((prev) => ({
                              ...prev,
                              primary_precinct: e.target.value,
                            }))
                          }
                          disabled={creatingUser}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Role"
                          fullWidth
                          value={userForm.role}
                          onChange={(e) =>
                            setUserForm((prev) => ({
                              ...prev,
                              role: e.target.value,
                            }))
                          }
                          disabled={creatingUser}
                        />
                      </Grid>
                    </Grid>

                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      sx={{ mt: 4, py: 1.5, fontWeight: "bold" }}
                      disabled={creatingUser}
                    >
                      {creatingUser ? "Creating..." : "Create User"}
                    </Button>

                    {userResult && (
                      <Alert
                        severity={userResult.success ? "success" : "error"}
                        sx={{ mt: 3 }}
                      >
                        {userResult.message}
                      </Alert>
                    )}
                  </Box>
                </Paper>
              }
            </Box>
          )}
          {/* Render the content based on the label of the active tab */}
          {availableTabs[tabValue]?.label === "Create Org Role" && (
            <Box>
              {
                <Paper sx={{ p: 4, borderRadius: 3 }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Create Individual Org Role
                  </Typography>

                  <Box
                    component="form"
                    onSubmit={handleCreateOrgRole}
                    sx={{ mt: 3 }}
                  >
                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Document ID *"
                          fullWidth
                          value={orgRoleForm.id}
                          onChange={(e) =>
                            setOrgRoleForm((prev) => ({
                              ...prev,
                              id: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingOrgRole}
                          helperText="e.g. PA15-R-committeeperson-220"
                        />
                      </Grid>

                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="User UID"
                          fullWidth
                          value={orgRoleForm.uid}
                          onChange={(e) =>
                            setOrgRoleForm((prev) => ({
                              ...prev,
                              uid: e.target.value.trim(),
                            }))
                          }
                          disabled={creatingOrgRole || orgRoleForm.is_vacant}
                          helperText="Firebase Auth UID (required unless vacant)"
                        />
                      </Grid>

                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Role *"
                          fullWidth
                          select
                          SelectProps={{ native: true }}
                          value={orgRoleForm.role}
                          onChange={(e) =>
                            setOrgRoleForm((prev) => ({
                              ...prev,
                              role: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingOrgRole}
                        >
                          <option value="committeeperson">
                            committeeperson
                          </option>
                          <option value="area_chair">area_chair</option>
                          <option value="area_vice_chair">
                            area_vice_chair
                          </option>
                          <option value="county_chair">county_chair</option>
                          <option value="state_admin">state_admin</option>
                          {/* Add more as needed */}
                        </TextField>
                      </Grid>

                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Org ID *"
                          fullWidth
                          value={orgRoleForm.org_id}
                          onChange={(e) =>
                            setOrgRoleForm((prev) => ({
                              ...prev,
                              org_id: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingOrgRole}
                          helperText="e.g. PA15-O-01"
                        />
                      </Grid>

                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="County Code"
                          fullWidth
                          value={orgRoleForm.county_code}
                          onChange={(e) =>
                            setOrgRoleForm((prev) => ({
                              ...prev,
                              county_code: e.target.value,
                            }))
                          }
                          disabled={creatingOrgRole}
                          helperText="e.g. PA-C-15"
                        />
                      </Grid>

                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Area District"
                          fullWidth
                          value={orgRoleForm.area_district}
                          onChange={(e) =>
                            setOrgRoleForm((prev) => ({
                              ...prev,
                              area_district: e.target.value,
                            }))
                          }
                          disabled={creatingOrgRole}
                          helperText="e.g. PA15-A-01"
                        />
                      </Grid>

                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Precinct Code *"
                          fullWidth
                          value={orgRoleForm.precinct_code}
                          onChange={(e) =>
                            setOrgRoleForm((prev) => ({
                              ...prev,
                              precinct_code: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingOrgRole}
                          helperText="e.g. PA15-P-220"
                        />
                      </Grid>

                      <Grid size={12}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={orgRoleForm.is_vacant}
                              onChange={(e) =>
                                setOrgRoleForm((prev) => ({
                                  ...prev,
                                  is_vacant: e.target.checked,
                                  uid: e.target.checked ? "" : prev.uid, // clear UID if vacant
                                }))
                              }
                              disabled={creatingOrgRole}
                            />
                          }
                          label="Is Vacant (no user assigned)"
                        />
                      </Grid>
                      <Grid size={12}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={orgRoleForm.active}
                              onChange={(e) =>
                                setOrgRoleForm((prev) => ({
                                  ...prev,
                                  active: e.target.checked,
                                }))
                              }
                              disabled={creatingOrgRole}
                            />
                          }
                          label="Active"
                        />
                      </Grid>
                    </Grid>

                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      sx={{ mt: 4, py: 1.5, fontWeight: "bold" }}
                      disabled={creatingOrgRole}
                    >
                      {creatingOrgRole ? "Creating..." : "Create Org Role"}
                    </Button>

                    {orgRoleResult && (
                      <Alert
                        severity={orgRoleResult.success ? "success" : "error"}
                        sx={{ mt: 3 }}
                      >
                        {orgRoleResult.message}
                      </Alert>
                    )}
                  </Box>
                </Paper>
              }
            </Box>
          )}
          {/* Render the content based on the label of the active tab */}
          {availableTabs[tabValue]?.label === "Import Org Roles" && (
            <Box>
              {
                <Paper sx={{ p: 4, borderRadius: 3 }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Bulk Import Org Roles
                  </Typography>

                  <Stack spacing={3}>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<UploadFile />}
                    >
                      Upload Org Roles JSON
                      <input
                        type="file"
                        hidden
                        accept=".json"
                        onChange={(e) =>
                          handleFileUpload(
                            e,
                            setOrgRolesJson,
                            setOrgRolesPreview
                          )
                        }
                      />
                    </Button>

                    <TextField
                      multiline
                      rows={10}
                      fullWidth
                      label="Paste Org Roles JSON"
                      value={orgRolesJson}
                      onChange={(e) =>
                        handleJsonInput(
                          e.target.value,
                          setOrgRolesJson,
                          setOrgRolesPreview
                        )
                      }
                      placeholder={[
                        "[",
                        "  {",
                        '    "id": "PA15-R-committeeperson-220",',
                        '    "uid": "userFirebaseUID123",',
                        '    "role": "committeeperson",',
                        '    "org_id": "PA15-O-01",',
                        '    "county_code": "PA-C-15",',
                        '    "area_district": "PA15-A-01",',
                        '    "precinct_code": "PA15-P-220",',
                        '    "is_vacant": false,',
                        '    "active": true',
                        "  }",
                        "  // ... more roles",
                        "]",
                      ].join("\n")}
                    />

                    {orgRolesPreview.length > 0 && (
                      <>
                        <Typography>
                          Preview: {orgRolesPreview.length} org roles
                        </Typography>

                        <Button
                          variant="contained"
                          onClick={handleImportOrgRoles}
                          disabled={importingOrgRoles}
                          startIcon={
                            importingOrgRoles ? (
                              <CircularProgress size={20} />
                            ) : (
                              <CloudUpload />
                            )
                          }
                        >
                          {importingOrgRoles
                            ? "Importing..."
                            : "Import Org Roles"}
                        </Button>

                        {orgRolesImportResult && (
                          <Alert
                            severity={
                              orgRolesImportResult.includes("Error")
                                ? "error"
                                : "success"
                            }
                          >
                            {orgRolesImportResult}
                          </Alert>
                        )}
                      </>
                    )}
                  </Stack>
                </Paper>
              }
            </Box>
          )}
          {/* Render the content based on the label of the active tab */}
          {availableTabs[tabValue]?.label === "Message Templates" && (
            <Box>
              {
                <Paper sx={{ p: 4, borderRadius: 3 }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Create Individual Message Template
                  </Typography>

                  <Box
                    component="form"
                    onSubmit={handleCreateMessageTemplate}
                    sx={{ mt: 3 }}
                  >
                    <Grid container spacing={3}>
                      {/* Document ID */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Document ID *"
                          fullWidth
                          value={messageTemplateForm.id}
                          onChange={(e) =>
                            setMessageTemplateForm((prev) => ({
                              ...prev,
                              id: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingMessageTemplate}
                          helperText="Unique ID, e.g. afford-crime-friendly-r-high-mail"
                        />
                      </Grid>

                      {/* Subject Line */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Subject Line"
                          fullWidth
                          value={messageTemplateForm.subject_line}
                          onChange={(e) =>
                            setMessageTemplateForm((prev) => ({
                              ...prev,
                              subject_line: e.target.value,
                            }))
                          }
                          disabled={creatingMessageTemplate}
                          helperText="Optional email subject line"
                        />
                      </Grid>

                      {/* Body */}
                      <Grid size={12}>
                        <TextField
                          label="Body *"
                          fullWidth
                          multiline
                          rows={8}
                          value={messageTemplateForm.body}
                          onChange={(e) =>
                            setMessageTemplateForm((prev) => ({
                              ...prev,
                              body: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingMessageTemplate}
                          helperText="Main message content"
                        />
                      </Grid>

                      {/* Category - Select with fixed values */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          select
                          label="Category *"
                          fullWidth
                          value={messageTemplateForm.category}
                          onChange={(e) =>
                            setMessageTemplateForm((prev) => ({
                              ...prev,
                              category: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingMessageTemplate}
                          SelectProps={{ native: true }}
                        >
                          <option value=""></option>
                          <option value="Affordability">Affordability</option>
                          <option value="Crime & Drugs">Crime & Drugs</option>
                          <option value="Energy & Utilities">
                            Energy & Utilities
                          </option>
                          <option value="Healthcare">Healthcare</option>
                          <option value="Housing">Housing</option>
                          <option value="Local">Local</option>
                        </TextField>
                      </Grid>

                      {/* Tone - Select */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          select
                          label="Tone *"
                          fullWidth
                          value={messageTemplateForm.tone}
                          onChange={(e) =>
                            setMessageTemplateForm((prev) => ({
                              ...prev,
                              tone: e.target.value,
                            }))
                          }
                          required
                          disabled={creatingMessageTemplate}
                          SelectProps={{ native: true }}
                        >
                          <option value=""></option>
                          <option value="warm">Warm</option>
                          <option value="compassionate">Compassionate</option>
                          <option value="direct">Direct</option>
                          <option value="excited">Excited</option>
                          <option value="friendly">Friendly</option>
                          <option value="optimistic">Optimistic</option>
                          <option value="pessimistic">Pessimistic</option>
                          <option value="pleading">Pleading</option>
                          <option value="respectful">Respectful</option>
                        </TextField>
                      </Grid>

                      {/* Age Group */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          select
                          label="Age Group"
                          fullWidth
                          value={messageTemplateForm.age_group}
                          onChange={(e) =>
                            setMessageTemplateForm((prev) => ({
                              ...prev,
                              age_group: e.target.value,
                            }))
                          }
                          disabled={creatingMessageTemplate}
                          SelectProps={{ native: true }}
                        >
                          <option value=""></option>
                          <option value="18-25">18-25</option>
                          <option value="26-40">26-40</option>
                          <option value="41-70">41-70</option>
                          <option value="71+">71+</option>
                        </TextField>
                      </Grid>

                      {/* Modeled Party */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          select
                          label="Modeled Party"
                          fullWidth
                          value={messageTemplateForm.modeled_party}
                          onChange={(e) =>
                            setMessageTemplateForm((prev) => ({
                              ...prev,
                              modeled_party: e.target.value,
                            }))
                          }
                          disabled={creatingMessageTemplate}
                          SelectProps={{ native: true }}
                        >
                          <option value=""></option>
                          <option value="Republican">Republican</option>
                          <option value="Democrat">Democrat</option>
                          <option value="Independent">Independent</option>
                        </TextField>
                      </Grid>

                      {/* Turnout Score */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          select
                          label="Turnout Score General"
                          fullWidth
                          value={messageTemplateForm.turnout_score_general}
                          onChange={(e) =>
                            setMessageTemplateForm((prev) => ({
                              ...prev,
                              turnout_score_general: e.target.value,
                            }))
                          }
                          disabled={creatingMessageTemplate}
                          SelectProps={{ native: true }}
                        >
                          <option value=""></option>
                          <option value="4 - Very High (Most Active)">
                            4 - Very High (Most Active)
                          </option>
                          <option value="3 - Frequent Voter">
                            3 - Frequent Voter
                          </option>
                          <option value="2 - Moderate Voter">
                            2 - Moderate Voter
                          </option>
                          <option value="1 - Low Turnout">
                            1 - Low Turnout
                          </option>
                          <option value="0 - Inactive">0 - Inactive</option>
                        </TextField>
                      </Grid>

                      {/* Has Mail Ballot */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          select
                          label="Has Mail Ballot"
                          fullWidth
                          value={messageTemplateForm.has_mail_ballot}
                          onChange={(e) =>
                            setMessageTemplateForm((prev) => ({
                              ...prev,
                              has_mail_ballot: e.target.value,
                            }))
                          }
                          disabled={creatingMessageTemplate}
                          SelectProps={{ native: true }}
                        >
                          <option value=""></option>
                          <option value="Has Mail Ballot">
                            Has Mail Ballot
                          </option>
                          <option value="Does Not Have Mail Ballot">
                            Does Not Have Mail Ballot
                          </option>
                        </TextField>
                      </Grid>

                      {/* Tags */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          label="Tags"
                          fullWidth
                          value={messageTemplateForm.tags}
                          onChange={(e) =>
                            setMessageTemplateForm((prev) => ({
                              ...prev,
                              tags: e.target.value,
                            }))
                          }
                          disabled={creatingMessageTemplate}
                          helperText="Comma-separated, e.g. affordability, crime, 2026"
                        />
                      </Grid>

                      {/* Active Switch */}
                      <Grid size={12}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={messageTemplateForm.active}
                              onChange={(e) =>
                                setMessageTemplateForm((prev) => ({
                                  ...prev,
                                  active: e.target.checked,
                                }))
                              }
                              disabled={creatingMessageTemplate}
                            />
                          }
                          label="Active"
                        />
                      </Grid>
                    </Grid>

                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      sx={{ mt: 4, py: 1.5, fontWeight: "bold" }}
                      disabled={creatingMessageTemplate}
                    >
                      {creatingMessageTemplate
                        ? "Creating..."
                        : "Create Message Template"}
                    </Button>

                    {messageTemplateResult && (
                      <Alert
                        severity={
                          messageTemplateResult.success ? "success" : "error"
                        }
                        sx={{ mt: 3 }}
                      >
                        {messageTemplateResult.message}
                      </Alert>
                    )}
                  </Box>
                </Paper>
              }
            </Box>
          )}
        </>
      )}
      {/* === Campaign Resources Management === */}
      {canManageResources ? (
        <Paper sx={{ p: 4, mt: 8, borderRadius: 3 }}>
          <Typography
            variant="h5"
            gutterBottom
            fontWeight="bold"
            color="primary"
          >
            Campaign Resources Management
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={4}>
            Upload and manage downloadable campaign materials (brochures,
            ballots, forms, etc.)
          </Typography>

          {/* Upload Form */}
          <Grid container spacing={3} alignItems="end">
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Title *"
                fullWidth
                value={newResource.title}
                onChange={(e) =>
                  setNewResource((prev) => ({ ...prev, title: e.target.value }))
                }
                disabled={uploadingResource}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                select
                label="Category *"
                fullWidth
                value={newResource.category}
                onChange={(e) =>
                  setNewResource((prev) => ({
                    ...prev,
                    category: e.target.value as CampaignResource["category"],
                  }))
                }
                SelectProps={{ native: true }}
                disabled={uploadingResource}
              >
                <option value="Brochures">Brochures</option>
                <option value="Ballots">Ballots</option>
                <option value="Forms">Forms</option>
                <option value="Graphics">Graphics</option>
                <option value="Scripts">Scripts</option>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <TextField
                label="Description (optional)"
                fullWidth
                value={newResource.description}
                onChange={(e) =>
                  setNewResource((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                disabled={uploadingResource}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
                disabled={uploadingResource}
              >
                Select PDF File
                <input
                  type="file"
                  hidden
                  accept=".pdf"
                  onChange={handleFileSelect}
                />
              </Button>
              {newResource.file && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Selected: {newResource.file.name}
                </Typography>
              )}
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <Button
                variant="contained"
                onClick={handleUploadResource}
                disabled={
                  uploadingResource || !newResource.file || !newResource.title
                }
                fullWidth
                startIcon={
                  uploadingResource ? (
                    <CircularProgress size={20} />
                  ) : (
                    <UploadIcon />
                  )
                }
              >
                {uploadingResource ? "Uploading..." : "Upload Resource"}
              </Button>
            </Grid>
          </Grid>

          {/* Resources List */}
          <Box sx={{ mt: 6 }}>
            <Typography variant="h6" gutterBottom>
              Current Resources ({resources.length})
            </Typography>

            {loadingResources ? (
              <LinearProgress sx={{ mt: 2 }} />
            ) : resources.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                No resources uploaded yet.
              </Alert>
            ) : (
              <List>
                {resources.map((resource) => (
                  <ListItem key={resource.id} divider>
                    <ListItemText
                      primary={resource.title}
                      secondary={`${resource.category} • ${
                        resource.description || "No description"
                      }`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        onClick={() => window.open(resource.url, "_blank")}
                        color="primary"
                      >
                        <DownloadIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => handleDeleteResource(resource.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Paper>
      ) : (
        <Box mt={4}>
          <Alert severity="info">
            You do not have permission to manage campaign resources.
          </Alert>
        </Box>
      )}
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={cancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this resource? This only removes the
            database entry — the file will remain in Storage.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      {/* Global Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
