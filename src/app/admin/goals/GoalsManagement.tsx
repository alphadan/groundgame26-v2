// src/app/admin/goals/GoalsManagement.tsx
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
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

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
        width: 150,
        headerAlign: "left",
        align: "left",
        valueGetter: (_, row) => row.precinct_id || "N/A",
      },
      {
        field: "area_id",
        headerName: "Area Name",
        width: 150,
        headerAlign: "left",
        align: "left",
        valueGetter: (_, row) => row.area_id || "N/A",
      },
      {
        field: "precinct_name",
        headerName: "Precinct Name",
        width: 200,
        headerAlign: "left",
        align: "left",
        valueGetter: (_, row) => row.precinct_name || "N/A",
      },
      {
        field: "registrations",
        headerName: "Registrations Target",
        width: 180,
        type: "number",
        headerAlign: "right", // ← crucial for numbers
        align: "right",
        valueGetter: (_, row) => row.targets?.registrations ?? 0,
      },
      {
        field: "mail_in",
        headerName: "Mail-In Target",
        width: 130,
        type: "number",
        headerAlign: "right",
        align: "right",
        valueGetter: (_, row) => row.targets?.mail_in ?? 0,
      },
      {
        field: "volunteers",
        headerName: "Volunteers",
        width: 120,
        type: "number",
        headerAlign: "right",
        align: "right",
        valueGetter: (_, row) => row.targets?.volunteers ?? 0,
      },
      {
        field: "user_activity",
        headerName: "Activity Index",
        width: 130,
        type: "number",
        headerAlign: "right",
        align: "right",
        valueGetter: (_, row) => row.targets?.user_activity ?? 0,
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 100,
        headerAlign: "center", // ← optional, looks better centered
        align: "center",
        renderCell: (params) => (
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => {
              setEditingGoal(params.row);
              setOpenDialog(true);
            }}
          >
            Edit
          </Button>
        ),
      },
    ],
    [],
  );

  const handleClose = () => {
    setOpenDialog(false);
    setEditingGoal(null);
  };

  return (
    <Box sx={{ p: 4 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
          <Tooltip title="Back to Admin">
            <IconButton
              onClick={() => navigate("/admin")}
              color="primary"
              sx={{ mr: 2 }}
            >
              <ArrowBackIcon fontSize="large" />
            </IconButton>
          </Tooltip>
          <Box>
            <Typography variant="h4" fontWeight="bold" color="primary">
              Manage Goals
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Precinct-level performance targets
            </Typography>
          </Box>
        </Box>
      </Stack>

      <Paper elevation={3} sx={{ borderRadius: 3, overflow: "hidden" }}>
        <DataGrid
          rows={goals}
          columns={columns}
          loading={loading}
          autoHeight
          pageSizeOptions={[10, 25]}
        />
      </Paper>

      {/* Integrated Dialog for Create/Edit */}
      <Dialog open={openDialog} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold" }}>
          {editingGoal
            ? `Edit Goal: ${editingGoal.precinct_id}`
            : "Set New Precinct Goal"}
        </DialogTitle>
        <DialogContent dividers>
          <CreateGoals
            initialData={editingGoal || undefined}
            onSuccess={() => {
              handleClose();
              fetchAll();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
