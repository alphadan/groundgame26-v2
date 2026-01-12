// src/app/admin/users/UsersManagement.tsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db";
import { UserPermissions, UserProfile } from "../../../types";
import { CreateUserForm } from "../components/CreateUserForm";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";

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
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Chip,
  Stack,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

export default function UsersManagement() {
  const { user, claims, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  // Permissions from IndexedDB
  const localUser = useLiveQuery(
    async () => (user?.uid ? await indexedDb.users.get(user.uid) : null),
    [user?.uid]
  );

  const permissions: UserPermissions = (localUser?.permissions || {
    can_manage_resources: false,
    can_create_users: false,
    // ... other perms
  }) as UserPermissions;

  const canCreateUsers = !!permissions.can_create_users;
  const hasAccess = canCreateUsers; // Can be extended for view-only

  // CRUD hook for users
  const {
    data: users,
    loading,
    error: crudError,
    search,
    update,
    fetchAll, // ← ADD THIS LINE
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

  // Focus blur fix
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

  if (!hasAccess) {
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

  const handleSave = async () => {
    if (!selectedUser) return;
    try {
      await update(selectedUser.uid, editForm);
      setSelectedUser(null);
      setEditForm({});
    } catch (err) {
      console.error("Update failed:", err);
      // Optional: show alert or toast
    }
  };

  const handleSearch = () => {
    if (searchEmail.trim()) {
      search("email", "==", searchEmail.trim().toLowerCase());
    } else {
      fetchAll(); // Reset to all users
      setSearchEmail("");
    }
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

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    try {
      await update(selectedUser.uid, editForm);
      setSelectedUser(null);
      setEditForm({});
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  const handleActiveToggle = () => {
    const newActive = !editForm.active;
    setConfirmMessage(
      newActive
        ? "Activating this user will restore access..."
        : "Inactivating this user will also deactivate all their roles in org_roles. Continue?"
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

  const columns: GridColDef[] = [
    { field: "display_name", headerName: "Display Name", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    { field: "phone", headerName: "Phone", width: 140 },
    {
      field: "active",
      headerName: "Active",
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? "Yes" : "No"}
          color={params.value ? "success" : "error"}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 180,
      sortable: false,
      renderCell: (params) => (
        <Button
          size="small"
          variant="outlined"
          onClick={() => handleEdit(params.row)}
        >
          Edit
        </Button>
      ),
    },
  ];

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
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
        </Tooltip>

        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Manage Users
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Create, search, edit, and manage user accounts
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Search & Create Controls */}
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
        <Button variant="outlined" onClick={() => setCreateDialogOpen(true)}>
          Create New User
        </Button>
      </Stack>

      {/* Error from CRUD */}
      {crudError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {crudError}
        </Alert>
      )}

      {users.length === 0 && !loading && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No users found. Try creating one!
        </Alert>
      )}

      {/* User List */}
      <Paper elevation={3} sx={{ borderRadius: 3, overflow: "hidden" }}>
        <DataGrid
          rows={users}
          columns={columns}
          loading={loading}
          // getRowId={(row) => row.uid} // <-- You can remove this now
          autoHeight
          pageSizeOptions={[10, 25, 50, 100]}
          disableRowSelectionOnClick
        />
      </Paper>

      {/* Create User Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          <CreateUserForm claims={claims} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Close</Button>
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
          <DialogTitle>Edit User: {selectedUser.email}</DialogTitle>
          <DialogContent>
            <TextField
              label="Display Name"
              fullWidth
              margin="normal"
              value={editForm.display_name || ""}
              onChange={(e) =>
                setEditForm({ ...editForm, display_name: e.target.value })
              }
            />
            <TextField
              label="Preferred Name"
              fullWidth
              margin="normal"
              value={editForm.preferred_name || ""}
              onChange={(e) =>
                setEditForm({ ...editForm, preferred_name: e.target.value })
              }
            />
            <TextField
              label="Phone"
              fullWidth
              margin="normal"
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
              label="Active"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedUser(null)}>Cancel</Button>
            <Button variant="contained" onClick={handleSave}>
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Active Toggle Confirmation */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Status Change</DialogTitle>
        <DialogContent>
          <Typography>{confirmMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button color="primary" variant="contained" onClick={confirmToggle}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
