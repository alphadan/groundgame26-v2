// src/app/admin/precincts/PrecinctsManagement.tsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db";
import { UserPermissions } from "../../../types";
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

export default function PrecinctsManagement() {
  const { user, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  const localUser = useLiveQuery(
    async () => (user?.uid ? await indexedDb.users.get(user.uid) : null),
    [user?.uid]
  );
  const permissions = (localUser?.permissions || {}) as UserPermissions;

  const {
    data: precincts,
    loading,
    error,
    search,
    remove,
    fetchAll,
  } = useAdminCRUD<any>({
    collectionName: "precincts",
    defaultOrderBy: "name",
    orderDirection: "asc",
  });

  const [searchText, setSearchText] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPrecinct, setSelectedPrecinct] = useState(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 12,
    page: 0,
  });

  const handleOpenCreate = () => {
    setSelectedPrecinct(null);
    setDialogOpen(true);
  };
  const handleOpenEdit = (p: any) => {
    setSelectedPrecinct(p);
    setDialogOpen(true);
  };

  const columns: GridColDef[] = [
    { field: "precinct_code", headerName: "Code", width: 90 },
    { field: "name", headerName: "Precinct Name", flex: 1 },
    { field: "area_district", headerName: "Area", width: 100 },
    { field: "senate_district", headerName: "Senate", width: 100 },
    { field: "house_district", headerName: "House", width: 100 },
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
            onClick={() => setDeleteId(params.row.id)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  if (!authLoaded)
    return <CircularProgress sx={{ display: "block", m: "auto", mt: 10 }} />;

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
            Manage Precincts
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Precinct assignments and district mapping
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Search and Add Action */}
      <Stack direction="row" spacing={2} mb={3}>
        <TextField
          label="Search by Name"
          size="small"
          fullWidth
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ bgcolor: "white" }}
        />
        <Button
          variant="contained"
          onClick={() => search("name", ">=", searchText)}
          startIcon={<SearchIcon />}
        >
          Search
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleOpenCreate}
          startIcon={<AddIcon />}
          sx={{ whiteSpace: "nowrap" }}
        >
          Add Precinct
        </Button>
      </Stack>

      {/* Main Grid */}
      <Paper elevation={2} sx={{ borderRadius: 3, mb: 5, overflow: "hidden" }}>
        <DataGrid
          rows={precincts}
          columns={columns}
          loading={loading}
          // --- Pagination Config ---
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50, 100]}
          // -------------------------
          autoHeight
          disableRowSelectionOnClick
          sx={{
            border: "none",
            "& .MuiDataGrid-footerContainer": {
              borderTop: "1px solid #e0e0e0",
            },
          }}
        />
      </Paper>

      {/* Bulk Import - White Paper Background */}
      {permissions.can_upload_collections && (
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
            <ImportPrecinctsForm />
          </Paper>
        </Box>
      )}

      {/* Edit/Create Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedPrecinct ? "Edit Precinct" : "Create New Precinct"}
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
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove this precinct?
          </Typography>
        </DialogContent>
        <DialogActions>
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
