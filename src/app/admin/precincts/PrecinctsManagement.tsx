import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db";
import { UserPermissions, Precinct } from "../../../types";
import { useNavigate } from "react-router-dom";

import { CreatePrecinctForm } from "../components/CreatePrecinctForm";
import { ImportPrecinctsForm } from "../components/ImportPrecinctsForm";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";

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
  IconButton,
  Tooltip,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import SecurityIcon from "@mui/icons-material/Security";

export default function PrecinctsManagement() {
  const { user, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  // 1. Reactive Developer Check from IndexedDB
  const localUser = useLiveQuery(
    async () => (user?.uid ? await indexedDb.users.get(user.uid) : null),
    [user?.uid],
  );

  const isDeveloper = localUser?.role === "developer";
  const permissions = (localUser?.permissions || {}) as UserPermissions;

  // Standardize permission flags
  const canModify = isDeveloper || !!permissions.can_create_documents;
  const canBulkUpload = isDeveloper || !!permissions.can_upload_collections;

  const {
    data: precincts,
    loading,
    error: crudError,
    search,
    remove,
    fetchAll,
  } = useAdminCRUD<Precinct>({
    collectionName: "precincts",
    defaultOrderBy: "name",
    orderDirection: "asc",
  });

  const [searchText, setSearchText] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPrecinct, setSelectedPrecinct] = useState<Precinct | null>(
    null,
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 12,
    page: 0,
  });

  const handleSearch = () => {
    if (searchText.trim()) {
      search("name", ">=", searchText.trim());
    } else {
      fetchAll();
    }
  };

  const handleOpenCreate = () => {
    setSelectedPrecinct(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (p: Precinct) => {
    setSelectedPrecinct(p);
    setDialogOpen(true);
  };

  // 2. Memoized Columns with Conditional Actions
  const columns: GridColDef[] = useMemo(() => {
    const baseColumns: GridColDef[] = [
      { field: "precinct_code", headerName: "Code", width: 90 },
      { field: "name", headerName: "Precinct Name", flex: 1 },
      { field: "area_id", headerName: "Area ID", width: 120 },
      { field: "senate_district", headerName: "Senate", width: 90 },
      { field: "house_district", headerName: "House", width: 90 },
      {
        field: "active",
        headerName: "Status",
        width: 100,
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
            <Tooltip title="Edit Precinct">
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleOpenEdit(params.row)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Precinct">
              <IconButton
                size="small"
                color="error"
                onClick={() => setDeleteId(params.row.id)}
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
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, margin: "auto" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
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
            <Typography variant="h4" fontWeight="bold" color="primary">
              Precinct Management
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Strategic boundary control and district mapping
            </Typography>
          </Box>
        </Box>

        {isDeveloper && (
          <Chip
            icon={<SecurityIcon />}
            label="Developer Access"
            color="secondary"
            variant="filled"
          />
        )}
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Fix: Standardized Error Handling */}
      {crudError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {typeof crudError === "string"
            ? crudError
            : (crudError as any).message || "An error occurred"}
        </Alert>
      )}

      {/* Search and Add Bar */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={3}>
        <TextField
          label="Search by Precinct Name"
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
            Add Precinct
          </Button>
        )}
      </Stack>

      {/* Main Grid */}
      <Paper elevation={3} sx={{ borderRadius: 2, overflow: "hidden", mb: 5 }}>
        <DataGrid
          rows={precincts}
          columns={columns}
          loading={loading}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50, 100]}
          autoHeight
          disableRowSelectionOnClick
          sx={{
            border: "none",
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "#f8f9fa",
            },
          }}
        />
      </Paper>

      {/* Bulk Operations - Restricted Section */}
      {canBulkUpload && (
        <Box>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Bulk Operations
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 4,
              borderRadius: 2,
              bgcolor: "white",
              border: "1px solid #e0e0e0",
              borderStyle: "dashed",
            }}
          >
            <Typography variant="body2" color="text.secondary" mb={2}>
              Download or upload precinct mapping templates. Uploading will
              update existing records matching by ID.
            </Typography>
            <ImportPrecinctsForm />
          </Paper>
        </Box>
      )}

      {/* Dialogs */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>
          {selectedPrecinct ? "Edit Precinct Data" : "Register New Precinct"}
        </DialogTitle>
        <DialogContent dividers>
          <CreatePrecinctForm
            initialData={selectedPrecinct}
            onSuccess={() => {
              setDialogOpen(false);
              fetchAll();
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle color="error">Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to permanently remove this precinct? This will
            sync to the cloud database.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (deleteId) await remove(deleteId);
              setDeleteId(null);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
