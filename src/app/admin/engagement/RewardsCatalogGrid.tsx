import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { DataGrid, GridColDef, GridActionsCellItem } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";

import { ireward, RewardStatus, RewardCategory } from "../../../types";
import {
  getAllRewards,
  addReward,
  updateReward,
  deleteReward,
} from "../../../services/rewardsService";

export default function RewardsCatalogGrid() {
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState<ireward[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const initialFormState: Omit<ireward, "id" | "created_at" | "updated_at"> = {
    title: "",
    description: "",
    points_cost: 100,
    stock_quantity: 10,
    is_digital: false,
    image_url: "",
    status: RewardStatus.active,
    category: RewardCategory.swag,
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    loadRewards();
  }, []);

  const loadRewards = async () => {
    setLoading(true);
    try {
      const data = await getAllRewards();
      setRewards(data);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (editMode && currentId) {
      await updateReward(currentId, formData);
    } else {
      await addReward(formData);
    }
    setIsDialogOpen(false);
    loadRewards();
  };

  const columns: GridColDef[] = [
    { field: "title", headerName: "Reward Name", flex: 1 },
    {
      field: "points_cost",
      headerName: "Cost",
      width: 120,
      renderCell: (params) => (
        <Typography color="primary.main" fontWeight="bold">
          {params.value} pts
        </Typography>
      ),
    },
    { field: "stock_quantity", headerName: "Stock", width: 100 },
    {
      field: "is_digital",
      headerName: "Type",
      width: 120,
      renderCell: (params) => (params.value ? "Digital" : "Physical"),
    },
    {
      field: "actions",
      type: "actions",
      headerName: "Actions",
      width: 100,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<EditIcon />}
          label="Edit"
          onClick={() => {
            setEditMode(true);
            setCurrentId(params.id as string);
            setFormData(params.row);
            setIsDialogOpen(true);
          }}
        />,
        <GridActionsCellItem
          icon={<DeleteIcon color="error" />}
          label="Delete"
          onClick={async () => {
            if (window.confirm("Delete this reward?")) {
              await deleteReward(params.id as string);
              loadRewards();
            }
          }}
        />,
      ],
    },
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6">Reward Catalog</Typography>
        <Button
          variant="contained"
          startIcon={<CardGiftcardIcon />}
          onClick={() => {
            setEditMode(false);
            setFormData(initialFormState);
            setIsDialogOpen(true);
          }}
        >
          Add Reward
        </Button>
      </Box>

      <Paper sx={{ height: 400, width: "100%" }}>
        <DataGrid rows={rewards} columns={columns} loading={loading} />
      </Paper>

      <Dialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{editMode ? "Edit Reward" : "New Reward"}</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}
        >
          <TextField
            label="Title"
            fullWidth
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
          />
          <TextField
            label="Description"
            multiline
            rows={2}
            fullWidth
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Points Cost"
              type="number"
              value={formData.points_cost}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  points_cost: Number(e.target.value),
                })
              }
            />
            <TextField
              label="Stock"
              type="number"
              value={formData.stock_quantity}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  stock_quantity: Number(e.target.value),
                })
              }
            />
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_digital}
                onChange={(e) =>
                  setFormData({ ...formData, is_digital: e.target.checked })
                }
              />
            }
            label="Digital Reward (No Shipping Required)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Save Reward
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
