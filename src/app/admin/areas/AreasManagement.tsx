import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
// Removed Dexie imports for permission checks
import { Area } from "../../../types";

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
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SearchIcon from "@mui/icons-material/Search";
import SecurityIcon from "@mui/icons-material/Security";

export default function AreasManagement() {
  // 1. DYNAMIC AUTH: Pull directly from the updated AuthContext
  const { role, permissions, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  // 2. REVISED PERMISSION LOGIC
  const isDeveloper = role === "developer";

  // Use the flags from your Firestore roles_config
  const canModify = isDeveloper || !!permissions.can_create_documents;
  const canBulkUpload = isDeveloper || !!permissions.can_manage_resources;

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

  // 3. UPDATED COLUMN DEFINITION
  const columns: GridColDef[] = useMemo(() => {
    const baseColumns: GridColDef[] = [
      { field: "id", headerName: "Area ID", width: 150 },
      { field: "name", headerName: "Name", flex: 1 },
      { field: "area_district", headerName: "District", width: 120 },
      {
        field: "active",
        headerName: "Status",
        width: 120,
        renderCell: (params) => (
          <Chip
            label={params.value ? "Active" : "Inactive"}
            color={params.value ? "success" : "error"}
            variant="outlined"
            size="small"
          />
        ),
      },
    ];

    // Show Actions if the user is a Developer or has "can_create_documents" perms
    if (canModify) {
      baseColumns.push({
        field: "actions",
        headerName: "Actions",
        width: 120,
        sortable: false,
        headerAlign: "right",
        align: "right",
        renderCell: (params) => (
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title="Edit Area">
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleOpenEdit(params.row)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {/* Hard delete only for developers or top-tier admins */}
            {isDeveloper && (
              <Tooltip title="Delete Area">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(params.row.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        ),
      });
    }

    return baseColumns;
  }, [canModify, isDeveloper]);

  if (!authLoaded)
    return (
      <Box display="flex" justifyContent="center" mt={10}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, margin: "auto" }}>
      {/* Header Section */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton
            onClick={() => navigate("/admin")}
            color="primary"
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
          <Box>
            <Typography variant="h4" fontWeight="900" color="primary">
              Area Management
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Configure geographic boundaries
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Control Bar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Search by Name"
            size="small"
            fullWidth
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            sx={{ bgcolor: "white" }}
          />
          <Button
            variant="outlined"
            onClick={handleSearch}
            startIcon={<SearchIcon />}
            sx={{ minWidth: 120 }}
          >
            Search
          </Button>

          {canModify && (
            <Button
              variant="contained"
              color="success"
              onClick={handleOpenCreate}
              startIcon={<AddIcon />}
              sx={{ whiteSpace: "nowrap", minWidth: 160 }}
            >
              Add Area
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Table Section */}
      <Paper
        elevation={0}
        variant="outlined"
        sx={{ borderRadius: 2, overflow: "hidden" }}
      >
        <DataGrid
          rows={areas}
          columns={columns}
          loading={loading}
          autoHeight
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick
        />
      </Paper>

      {/* Bulk Operations - Restricted Section */}
      {canBulkUpload && (
        <Box sx={{ mt: 6 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Bulk Operations
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 2,
              bgcolor: "rgba(0, 0, 0, 0.02)",
              borderStyle: "dashed",
            }}
          >
            <Typography variant="body2" color="text.secondary" mb={3}>
              Overwrite local definitions by uploading CSV/JSON files. Access
              restricted to resource managers.
            </Typography>
            <ImportAreasForm />
          </Paper>
        </Box>
      )}

      {/* THE DIALOG - Ensure 'open' prop is tied to 'areaDialogOpen' */}
      <Dialog
        open={areaDialogOpen}
        onClose={() => setAreaDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedArea ? "Edit Area" : "Register New Area"}
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
        <DialogTitle color="error">Confirm Permanent Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            {/* FIX: Ensure we check if areaToDelete exists before rendering.
         Also, we use areaToDelete directly since it is a string (the ID).
      */}
            Are you sure you want to delete Area{" "}
            <strong>{areaToDelete || ""}</strong>? This action will sync to the
            cloud and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Keep Area</Button>
          <Button
            color="error"
            variant="contained"
            onClick={confirmDelete}
            disabled={!areaToDelete} // Guard against empty clicks
          >
            Confirm Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
