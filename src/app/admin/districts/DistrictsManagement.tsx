// src/app/admin/districts/DistrictsManagement.tsx
import React, { useState, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db";
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
import LocationOnIcon from "@mui/icons-material/LocationOn";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

export default function DistrictsManagement() {
  const { user, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();
  const localUser = useLiveQuery(
    async () => (user?.uid ? await indexedDb.users.get(user.uid) : null),
    [user?.uid],
  );
  const isDeveloper = localUser?.role === "developer";

  const {
    data: districts,
    loading,
    error: crudError,
    search,
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
            {isDeveloper && (
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
    [isDeveloper],
  );

  if (!authLoaded)
    return <CircularProgress sx={{ display: "block", m: "auto", mt: 10 }} />;

  return (
    <Box sx={{ p: 4, maxWidth: 1200, margin: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={2} mb={4}>
        <IconButton onClick={() => navigate("/admin")} color="primary">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" fontWeight="900">
          District Management
        </Typography>
      </Stack>

      {/* Control Bar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Search #"
            size="small"
            fullWidth
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Button
            variant="contained"
            color="success"
            startIcon={<AddIcon />}
            sx={{ minWidth: 140, whiteSpace: "nowrap" }}
            onClick={() => setDistrictDialogOpen(true)}
          >
            Add District
          </Button>
        </Stack>
      </Paper>

      <DataGrid
        rows={districts}
        columns={columns}
        loading={loading}
        autoHeight
        disableRowSelectionOnClick
      />

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
        <DialogTitle>Register New District</DialogTitle>
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
            <strong>{districtToDelete}</strong>? This action will sync to the
            cloud and cannot be undone.
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
