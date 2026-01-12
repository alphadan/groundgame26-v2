import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db";
import { UserPermissions } from "../../../types";

import { AreaForm } from "../components/AreaForm";
import { ImportAreasForm } from "../components/ImportAreasForm";
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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Chip,
  Grid,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LocationOnIcon from "@mui/icons-material/LocationOn";

interface Area {
  id: string;
  name: string;
  area_district: string;
  county_id: string;
  active: boolean;
  created_at: any;
}

export default function AreasManagement() {
  const { user, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  const localUser = useLiveQuery(
    async () => (user?.uid ? await indexedDb.users.get(user.uid) : null),
    [user?.uid]
  );

  const permissions: UserPermissions = (localUser?.permissions ||
    {}) as UserPermissions;
  const canCreateDocs = !!permissions.can_create_documents;
  const canUploadColl = !!permissions.can_upload_collections;

  const {
    data: areas,
    loading,
    error: crudError,
    search,
    remove,
    fetchAll,
  } = useAdminCRUD<Area>({
    collectionName: "areas",
    defaultOrderBy: "name",
    orderDirection: "asc",
  });

  const [searchText, setSearchText] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [areaToDelete, setAreaToDelete] = useState<string | null>(null);

  // Dialog States
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  const handleSearch = () => {
    if (searchText.trim()) {
      search("name", ">=", searchText.trim());
    } else {
      fetchAll();
    }
  };

  const handleOpenCreate = () => {
    setSelectedArea(null);
    setAreaDialogOpen(true);
  };

  const handleOpenEdit = (area: Area) => {
    setSelectedArea(area);
    setAreaDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setAreaToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!areaToDelete) return;
    try {
      await remove(areaToDelete);
      setDeleteConfirmOpen(false);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const columns: GridColDef[] = [
    { field: "id", headerName: "Area ID", width: 130 },
    { field: "name", headerName: "Name", flex: 1 },
    { field: "area_district", headerName: "District", width: 120 },
    {
      field: "active",
      headerName: "Status",
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value ? "Active" : "Inactive"}
          color={params.value ? "success" : "error"}
          size="small"
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleOpenEdit(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDelete(params.row.id)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  if (!authLoaded)
    return <CircularProgress sx={{ m: "20% auto", display: "block" }} />;

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <IconButton
          onClick={() => navigate("/admin")}
          color="primary"
          sx={{ mr: 2 }}
        >
          <ArrowBackIcon fontSize="large" />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Manage Areas
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Geographic boundary control
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Search & Add Bar */}
      <Stack direction="row" spacing={2} mb={3}>
        <TextField
          label="Search Areas"
          size="small"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ flexGrow: 1, bgcolor: "white" }}
        />
        <Button
          variant="contained"
          onClick={handleSearch}
          startIcon={<LocationOnIcon />}
        >
          Search
        </Button>
        {canCreateDocs && (
          <Button
            variant="contained"
            color="success"
            onClick={handleOpenCreate}
            startIcon={<AddIcon />}
          >
            Add Area
          </Button>
        )}
      </Stack>

      {/* Main DataGrid */}
      <Paper elevation={2} sx={{ borderRadius: 3, mb: 5, overflow: "hidden" }}>
        <DataGrid
          rows={areas}
          columns={columns}
          loading={loading}
          autoHeight
          pageSizeOptions={[10, 25]}
          disableRowSelectionOnClick
        />
      </Paper>

      {/* Bulk Import Section */}
      {canUploadColl && (
        <Box>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Bulk Operations
          </Typography>
          <Paper
            elevation={1}
            sx={{
              p: 4,
              borderRadius: 3,
              bgcolor: "white",
              border: "1px solid #e0e0e0",
            }}
          >
            <Typography variant="body2" color="text.secondary" mb={2}>
              Upload a CSV or JSON file to update multiple geographic areas at
              once.
            </Typography>
            <ImportAreasForm />
          </Paper>
        </Box>
      )}

      {/* Add/Edit Area Dialog */}
      <Dialog
        open={areaDialogOpen}
        onClose={() => setAreaDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedArea ? "Edit Area" : "Create New Area"}
        </DialogTitle>
        <DialogContent dividers>
          <AreaForm
            initialData={selectedArea}
            onSuccess={() => {
              setAreaDialogOpen(false);
              fetchAll();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAreaDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Delete Area {areaToDelete}? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
