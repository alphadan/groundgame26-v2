import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";
import { Goal } from "../../../types";
import CreateGoals from "./CreateGoals";

import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  LinearProgress,
} from "@mui/material";
import { DataGrid, GridColDef, GridToolbarQuickFilter } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

// Helper to style target numbers
const TargetValue = ({ value, color }: { value: number; color: string }) => (
  <Typography
    variant="body2"
    sx={{ fontWeight: "bold", color: value > 0 ? color : "text.disabled" }}
  >
    {value.toLocaleString()}
  </Typography>
);

export default function GoalsManagement() {
  const navigate = useNavigate();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const {
    data: goals,
    loading,
    fetchAll,
  } = useAdminCRUD<Goal>({
    collectionName: "goals",
    defaultOrderBy: "precinct_id",
  });

  const columns: GridColDef<Goal>[] = useMemo(
    () => [
      {
        field: "precinct_id",
        headerName: "Precinct ID",
        width: 130,
        renderCell: (params) => (
          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
            {params.value}
          </Typography>
        ),
      },
      {
        field: "area_id",
        headerName: "Area",
        width: 140,
      },
      {
        field: "precinct_name",
        headerName: "Precinct Name",
        flex: 1,
        minWidth: 180,
      },
      {
        field: "registrations",
        headerName: "Voter Reg",
        width: 120,
        type: "number",
        align: "right",
        renderCell: (params) => (
          <TargetValue
            value={params.row.targets?.registrations ?? 0}
            color="primary.main"
          />
        ),
      },
      {
        field: "mail_in",
        headerName: "Mail-In",
        width: 120,
        type: "number",
        align: "right",
        renderCell: (params) => (
          <TargetValue
            value={params.row.targets?.mail_in ?? 0}
            color="secondary.main"
          />
        ),
      },
      {
        field: "volunteers",
        headerName: "Volunteers",
        width: 120,
        type: "number",
        align: "right",
        renderCell: (params) => (
          <TargetValue
            value={params.row.targets?.volunteers ?? 0}
            color="success.main"
          />
        ),
      },
      {
        field: "actions",
        headerName: "Edit",
        width: 100,
        sortable: false,
        filterable: false,
        align: "center",
        renderCell: (params) => (
          <IconButton
            color="primary"
            size="small"
            onClick={() => {
              setEditingGoal(params.row);
              setOpenDialog(true);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [],
  );

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {/* Header Section */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        mb={4}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Tooltip title="Back to Admin">
            <IconButton onClick={() => navigate("/admin")} color="primary">
              <ArrowBackIcon fontSize="large" />
            </IconButton>
          </Tooltip>
          <Box>
            <Typography variant="h4" fontWeight="bold" color="primary">
              Precinct Goals
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Configure key performance indicators by precinct
            </Typography>
          </Box>
        </Stack>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingGoal(null);
            setOpenDialog(true);
          }}
          sx={{ borderRadius: 2, px: 3 }}
        >
          Set New Goal
        </Button>
      </Stack>

      {/* Main Table Container */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid #e0e0e0",
          overflow: "hidden",
        }}
      >
        <Box sx={{ height: 650, width: "100%" }}>
          <DataGrid
            rows={goals}
            columns={columns}
            loading={loading}
            getRowId={(row) => row.id || row.precinct_id}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbarQuickFilter }} // Adds search bar automatically
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 500 },
                sx: { p: 2, pb: 0 },
              },
            }}
            sx={{
              border: "none",
              "& .MuiDataGrid-cell:focus": { outline: "none" },
            }}
          />
        </Box>
      </Paper>

      {/* Goal Creation/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: "bold", bgcolor: "grey.50" }}>
          {editingGoal
            ? `Edit Targets: ${editingGoal.precinct_name}`
            : "Initialize Precinct Goal"}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <CreateGoals
            initialData={editingGoal || undefined}
            onSuccess={() => {
              setOpenDialog(false);
              setEditingGoal(null);
              fetchAll();
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: "grey.50" }}>
          <Button onClick={() => setOpenDialog(false)} color="inherit">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
