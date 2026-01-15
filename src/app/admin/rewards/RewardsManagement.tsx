import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Tooltip,
} from "@mui/material";
import {
  getAllRewards,
  addReward,
  deleteReward,
} from "../../../services/rewardsService";
import { ireward, RewardStatus } from "../../../types";
import DeleteIcon from "@mui/icons-material/Delete";
import IconButton from "@mui/material/IconButton";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export default function RewardsManagement() {
  const navigate = useNavigate();
  const [rewards, setRewards] = useState<ireward[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    points_cost: 0,
    status: RewardStatus.active,
  });

  const loadData = async () => {
    setLoading(true);
    const data = await getAllRewards();
    setRewards(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string) => {
    // Good practice: Ask for confirmation before deleting
    if (window.confirm("Are you sure you want to delete this reward?")) {
      try {
        await deleteReward(id);

        // Update local state so the item disappears immediately without a full reload
        setRewards((prevRewards) => prevRewards.filter((r) => r.id !== id));
      } catch (error) {
        console.error("Failed to delete reward:", error);
        alert("Error deleting reward. Please try again.");
      }
    }
  };

  const handleSubmit = async () => {
    await addReward(formData);
    setOpen(false);
    loadData(); // Refresh list after adding
  };

  // Define Columns for the DataGrid
  const columns: GridColDef[] = [
    { field: "title", headerName: "Reward Name", flex: 1 },
    { field: "points_cost", headerName: "Points", width: 120, type: "number" },
    { field: "status", headerName: "Status", width: 130 },
    {
      field: "created_at",
      headerName: "Date Added",
      width: 180,
      valueFormatter: (value: number) =>
        value ? new Date(value).toLocaleDateString() : "",
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <IconButton color="error" onClick={() => handleDelete(params.row.id)}>
          <DeleteIcon />
        </IconButton>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {/* Header Section */}
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
            Manage Rewards
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Database of users and rewards and redemptions
          </Typography>
        </Box>
      </Box>
      <Box p={4}>
        <Box display="flex" justifyContent="space-between">
          <Button variant="contained" onClick={() => setOpen(true)}>
            Add New Reward
          </Button>
        </Box>

        {loading ? (
          <CircularProgress />
        ) : (
          <DataGrid
            rows={rewards}
            columns={columns}
            loading={loading}
            pageSizeOptions={[5, 10, 25]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            disableRowSelectionOnClick
          />
        )}

        {/* Add Reward Modal */}
        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>Create New Reward</DialogTitle>
          <DialogContent
            sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}
          >
            <TextField
              label="Title"
              fullWidth
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
            <TextField
              label="Description"
              multiline
              rows={3}
              fullWidth
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
            <TextField
              label="Points Cost"
              type="number"
              fullWidth
              onChange={(e) =>
                setFormData({
                  ...formData,
                  points_cost: Number(e.target.value),
                })
              }
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained">
              Save Reward
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}
