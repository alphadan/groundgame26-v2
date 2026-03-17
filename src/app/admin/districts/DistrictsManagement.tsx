import React, { useState, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import { State_Rep_District } from "../../../types";
import { DistrictForm } from "./DistrictForm";
import AssignDistrictLeaderDialog from "./AssignDistrictLeaderDialog";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import SecurityIcon from "@mui/icons-material/Security";

export default function DistrictsManagement() {
  // 1. DYNAMIC AUTH: Standardized across the app
  const { role, permissions, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  // Logic: Use Firestore-driven flags
  const isDeveloper = role === "developer";
  const canModify = isDeveloper || !!permissions?.can_create_documents;

  const {
    data: districts,
    loading,
    error: crudError,
    remove,
    fetchAll,
  } = useAdminCRUD<State_Rep_District>({
    collectionName: "state_rep_districts",
    defaultOrderBy: "district_number",
    orderDirection: "asc",
  });

  const [searchText, setSearchText] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [districtToDelete, setDistrictToDelete] = useState<string | null>(null);
  const [districtDialogOpen, setDistrictDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(
    null,
  );

  // 2. UPDATED COLUMN DEFINITION
  const columns: GridColDef[] = useMemo(
    () => [
      { field: "district_number", headerName: "#", width: 70 },
      {
        field: "active",
        headerName: "Active",
        width: 80,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => {
          return params.value ? (
            <CheckCircleIcon sx={{ color: "success.main", fontSize: 20 }} />
          ) : (
            <CancelIcon sx={{ color: "error.main", fontSize: 20 }} />
          );
        },
      },
      { field: "name", headerName: "Name", flex: 1 },
      {
        field: "district_leaders",
        headerName: "District Leaders",
        width: 350,
        renderCell: (params) => (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              gap: 1,
            }}
          >
            <Stack direction="row" spacing={1}>
              {(params.value || []).map((l: any) => (
                <Chip
                  key={l.uid}
                  label={l.name}
                  size="small"
                  variant="outlined"
                />
              ))}
              {(!params.value || params.value.length === 0) && (
                <Typography variant="caption" color="text.secondary">
                  Unassigned
                </Typography>
              )}
            </Stack>
            {/* Lead Assignment restricted by canModify */}
            {canModify && (
              <IconButton
                size="small"
                onClick={() => {
                  setSelectedDistrictId(params.row.id);
                  setAssignDialogOpen(true);
                }}
              >
                <EditIcon fontSize="inherit" />
              </IconButton>
            )}
          </Box>
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 80,
        sortable: false,
        renderCell: (params) =>
          isDeveloper && (
            <IconButton
              color="error"
              size="small"
              onClick={() => {
                setDistrictToDelete(params.row.id);
                setDeleteConfirmOpen(true);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          ),
      },
    ],
    [isDeveloper, canModify],
  );

  if (!authLoaded)
    return <CircularProgress sx={{ display: "block", m: "auto", mt: 10 }} />;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, margin: "auto" }}>
      {/* Header Section */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={() => navigate("/admin")} color="primary">
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" fontWeight="900" color="primary">
              District Management
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Strategic mapping for state legislative boundaries
            </Typography>
          </Box>
        </Stack>
      </Box>

      {crudError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {typeof crudError === "string"
            ? crudError
            : "Error loading districts."}
        </Alert>
      )}

      {/* Control Bar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Filter List"
            size="small"
            fullWidth
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          {canModify && (
            <Button
              variant="contained"
              color="success"
              startIcon={<AddIcon />}
              sx={{ minWidth: 140, whiteSpace: "nowrap" }}
              onClick={() => setDistrictDialogOpen(true)}
            >
              Add District
            </Button>
          )}
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        variant="outlined"
        sx={{ borderRadius: 2, overflow: "hidden" }}
      >
        <DataGrid
          rows={districts}
          columns={columns}
          loading={loading}
          autoHeight
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </Paper>

      {/* LEADERSHIP DIALOG */}
      <AssignDistrictLeaderDialog
        open={assignDialogOpen}
        onClose={() => {
          setAssignDialogOpen(false);
          setSelectedDistrictId(null);
        }}
        districtId={selectedDistrictId}
        initialLeaders={
          districts.find((d) => d.id === selectedDistrictId)
            ?.district_leaders || []
        }
        onSuccess={() => {
          setAssignDialogOpen(false);
          setSelectedDistrictId(null);
          fetchAll();
        }}
      />

      {/* CREATE DIALOG */}
      <Dialog
        open={districtDialogOpen}
        onClose={() => setDistrictDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>
          Register New District
        </DialogTitle>
        <DialogContent dividers>
          <DistrictForm
            onSuccess={() => {
              setDistrictDialogOpen(false);
              fetchAll();
            }}
            onCancel={() => setDistrictDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle color="error">Confirm Permanent Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete District{" "}
            <strong>{districtToDelete || ""}</strong>? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>
            Keep District
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (districtToDelete) await remove(districtToDelete);
              setDeleteConfirmOpen(false);
            }}
          >
            Confirm Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
