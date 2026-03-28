import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { UserProfile } from "../../../types";
import { CreateUserForm } from "../components/CreateUserForm";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import {
  getWelcomeEmailTemplate,
  WelcomeEmailData,
} from "../constants/emailTemplates";

import { useNavigate } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PasswordIcon from "@mui/icons-material/Password";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import Tooltip from "@mui/material/Tooltip";
import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControlLabel,
  Switch,
  Chip,
  Stack,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

export default function UsersManagement() {
  const {
    claims,
    permissions,
    isLoaded: authLoaded,
    userProfile: adminProfile,
  } = useAuth();
  const { callFunction } = useCloudFunctions();
  const navigate = useNavigate();

  // Functional Gating
  const canCreateUsers = !!permissions.can_create_users;
  const canManageTeam = !!permissions.can_manage_team;

  // CRUD hook for users
  const {
    data: users,
    loading,
    error: crudError,
    search,
    update,
    fetchAll,
  } = useAdminCRUD<UserProfile>({
    collectionName: "users",
    defaultOrderBy: "display_name",
    orderDirection: "asc",
  });

  // Local state
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Password Reset State
  const [resetData, setResetData] = useState<WelcomeEmailData | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);

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

  if (!canManageTeam) {
    return (
      <Box p={6} textAlign="center">
        <Alert severity="error" variant="filled">
          <Typography variant="h6">Access Denied</Typography>
          <Typography variant="body1" mt={1}>
            You do not have permission to access User Management.
          </Typography>
        </Alert>
      </Box>
    );
  }

  // --- Handlers ---
  const handleSave = async () => {
    if (!selectedUser) return;
    try {
      await update(selectedUser.uid, editForm);
      setSelectedUser(null);
      setEditForm({});
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  const handleSearch = () => {
    if (searchEmail.trim()) {
      search("email", "==", searchEmail.trim().toLowerCase());
    } else {
      fetchAll();
      setSearchEmail("");
    }
  };

  const initiateReset = (user: UserProfile) => {
    setUserToReset(user);
    setResetConfirmOpen(true);
  };

  const handleConfirmReset = async () => {
    if (!userToReset) return;

    setResetConfirmOpen(false); // Close confirm dialog
    setIsResetting(true);
    try {
      const result = await callFunction<WelcomeEmailData>(
        "adminResetUserPassword",
        {
          uid: userToReset.uid,
          email: userToReset.email,
          display_name: userToReset.display_name,
          phone: userToReset.phone,
        },
      );
      setResetData(result);
    } catch (err: any) {
      alert("Reset failed: " + (err.message || "Unknown error"));
    } finally {
      setIsResetting(false);
      setUserToReset(null);
    }
  };

  const handleCopyResetData = () => {
    if (!resetData) return;
    const template = getWelcomeEmailTemplate(resetData);
    const fullText = `Subject: ${template.subject}\n\n${template.body}`;
    navigator.clipboard.writeText(fullText);
    alert("Full email template copied to clipboard.");
  };

  const handleEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setEditForm({
      display_name: user.display_name || "",
      preferred_name: user.preferred_name || "",
      phone: user.phone || "",
      active: user.active ?? true,
    });
  };

  const handleActiveToggle = () => {
    const newActive = !editForm.active;
    setConfirmMessage(
      newActive
        ? "Activating this user will restore access immediately."
        : "Inactivating this user will suspend all access. Continue?",
    );
    setConfirmOpen(true);
  };

  const confirmToggle = async () => {
    if (!selectedUser) return;
    const newActive = !editForm.active;
    try {
      await update(selectedUser.uid, { active: newActive });
      setEditForm((prev) => ({ ...prev, active: newActive }));
      setConfirmOpen(false);
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  // --- Grid Columns ---
  const columns: GridColDef[] = [
    { field: "display_name", headerName: "Display Name", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    { field: "phone", headerName: "Phone", width: 140 },
    {
      field: "active",
      headerName: "Active",
      width: 90,
      renderCell: (params) => (
        <Chip
          label={params.value ? "Yes" : "No"}
          color={params.value ? "success" : "error"}
          size="small"
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 180,
      sortable: false,
      renderCell: (params) => (
        <Stack
          direction="row"
          spacing={1}
          sx={{ height: "100%", alignItems: "center" }}
        >
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleEdit(params.row)}
          >
            Edit
          </Button>

          {canCreateUsers && (
            <Tooltip title="Reset & Resend Credentials">
              <IconButton
                size="small"
                color="secondary"
                onClick={() => initiateReset(params.row)}
                disabled={isResetting || !params.row.active}
              >
                <VpnKeyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Tooltip title="Back to Admin Dashboard" arrow>
          <IconButton
            onClick={() => navigate("/admin")}
            color="primary"
            size="large"
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
        </Tooltip>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Manage Users
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Provision and update team member accounts
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Stack direction="row" spacing={2} mb={4} flexWrap="wrap">
        <TextField
          label="Search by Email"
          value={searchEmail}
          onChange={(e) => setSearchEmail(e.target.value)}
          variant="outlined"
          size="small"
          sx={{ flexGrow: 1, minWidth: 250 }}
        />
        <Button variant="contained" onClick={handleSearch}>
          Search
        </Button>

        {canCreateUsers && (
          <Button variant="outlined" onClick={() => setCreateDialogOpen(true)}>
            Provision New User
          </Button>
        )}
      </Stack>

      {crudError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {crudError}
        </Alert>
      )}

      <Paper
        elevation={0}
        variant="outlined"
        sx={{ borderRadius: 3, overflow: "hidden" }}
      >
        <DataGrid
          rows={users}
          columns={columns}
          loading={loading}
          autoHeight
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick
          getRowId={(row) => row.uid}
          sx={{ border: "none" }}
        />
      </Paper>

      {/* Provision Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>
          Provision New Field Member
        </DialogTitle>
        <DialogContent dividers>
          <CreateUserForm claims={claims} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Reset Success Dialog */}
      <Dialog
        open={Boolean(resetData)}
        onClose={() => setResetData(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: "bold", color: "secondary.main" }}>
          Credentials Reset Successfully
        </DialogTitle>
        <DialogContent dividers>
          {resetData && (
            <Stack spacing={2}>
              <Alert severity="warning">
                A new temporary password has been set. The user will be forced
                to change it upon login.
              </Alert>
              <Box sx={{ p: 2, bgcolor: "grey.100", borderRadius: 2 }}>
                <Typography variant="body2">
                  <b>Target Email:</b> {resetData.email}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <b>New Temp Password:</b>{" "}
                  <code style={{ fontSize: "1.1rem", color: "#d32f2f" }}>
                    {resetData.tempPassword}
                  </code>
                </Typography>
              </Box>
              <Typography variant="subtitle2" fontWeight="bold">
                New Welcome Template Preview:
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: "#fafafa",
                  maxHeight: 200,
                  overflow: "auto",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}
                >
                  {getWelcomeEmailTemplate(resetData).body}
                </Typography>
              </Paper>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetData(null)}>Close</Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyResetData}
          >
            Copy Email Content
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      {selectedUser && (
        <Dialog
          open
          onClose={() => setSelectedUser(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Update Profile: {selectedUser.email}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                label="Display Name"
                fullWidth
                value={editForm.display_name || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, display_name: e.target.value })
                }
              />
              <TextField
                label="Preferred Name"
                fullWidth
                value={editForm.preferred_name || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, preferred_name: e.target.value })
                }
              />
              <TextField
                label="Phone"
                fullWidth
                value={editForm.phone || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, phone: e.target.value })
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={editForm.active ?? true}
                    onChange={handleActiveToggle}
                  />
                }
                label="Account Active"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setSelectedUser(null)}>Cancel</Button>
            <Button variant="contained" onClick={handleSave}>
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Status Toggle Confirm */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Account Status Change</DialogTitle>
        <DialogContent>
          <Typography>{confirmMessage}</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button color="primary" variant="contained" onClick={confirmToggle}>
            Confirm Change
          </Button>
        </DialogActions>
      </Dialog>
      {/* --- RESET CONFIRMATION DIALOG --- */}
      <Dialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <VpnKeyIcon color="secondary" /> Reset User Credentials?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to generate a new temporary password for{" "}
            <b>{userToReset?.display_name}</b>. Their current password will stop
            working immediately and they will be forced to set a new one.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setResetConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmReset}
            variant="contained"
            color="secondary"
            autoFocus
          >
            Generate New Password
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
