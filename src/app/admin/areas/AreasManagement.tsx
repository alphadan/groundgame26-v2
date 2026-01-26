import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db";
import { UserPermissions, Area } from "../../../types";

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
import SecurityIcon from "@mui/icons-material/Security";

export default function AreasManagement() {
  const { user, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  // 1. Reactive Developer Check from IndexedDB
  const localUser = useLiveQuery(
    async () => (user?.uid ? await indexedDb.users.get(user.uid) : null),
    [user?.uid],
  );

  const isDeveloper = localUser?.role === "developer";

  // 2. Permission logic
  const permissions: UserPermissions = (localUser?.permissions ||
    {}) as UserPermissions;
  // Developers bypass standard permission flags
  const canModify = isDeveloper || !!permissions.can_create_documents;
  const canBulkUpload = isDeveloper || !!permissions.can_upload_collections;

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

  // 3. Conditional Column Definition
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

    // Only inject Actions column if user is a developer
    if (isDeveloper) {
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
            <Tooltip title="Delete Area">
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDelete(params.row.id)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      });
    }

    return baseColumns;
  }, [isDeveloper]);

  if (!authLoaded)
    return (
      <Box display="flex" justifyContent="center" mt={10}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, margin: "auto" }}>
      {/* Header Section */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 4,
        }}
      >
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
              Configure geographic boundaries and districts
            </Typography>
          </Box>
        </Box>

        {isDeveloper && (
          <Chip
            icon={<SecurityIcon />}
            label="Developer Mode"
            color="secondary"
            variant="filled"
            sx={{ fontWeight: "bold" }}
          />
        )}
      </Box>

      {crudError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {typeof crudError === "string"
            ? crudError
            : (crudError as any).message}
        </Alert>
      )}

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
          />
          <Button
            variant="outlined"
            onClick={handleSearch}
            startIcon={<LocationOnIcon />}
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
              sx={{ minWidth: 140, whiteSpace: "nowrap" }}
            >
              Add Area
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Table Section */}
      <Paper elevation={3} sx={{ borderRadius: 2, overflow: "hidden" }}>
        <DataGrid
          rows={areas}
          columns={columns}
          loading={loading}
          autoHeight
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
          sx={{
            border: "none",
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "#f5f5f5",
              fontWeight: "bold",
            },
          }}
        />
      </Paper>

      {/* Bulk Operations - Restricted Section */}
      {canBulkUpload && (
        <Box sx={{ mt: 6 }}>
          <Typography
            variant="h6"
            fontWeight="bold"
            gutterBottom
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
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
              Use the tool below to upload geographic definitions in bulk. This
              will overwrite existing local IDs.
            </Typography>
            <ImportAreasForm />
          </Paper>
        </Box>
      )}

      {/* Modals */}
      <Dialog
        open={areaDialogOpen}
        onClose={() => setAreaDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>
          {selectedArea ? "Edit Area Details" : "Register New Area"}
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
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAreaDialogOpen(false)} color="inherit">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle color="error">Confirm Permanent Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete Area <strong>{areaToDelete}</strong>
            ? This action will sync to the cloud and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Keep Area</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            Confirm Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
