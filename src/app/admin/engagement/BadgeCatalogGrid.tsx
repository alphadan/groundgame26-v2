import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Autocomplete,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  MenuItem,
  Paper,
} from "@mui/material";
import { DataGrid, GridColDef, GridActionsCellItem } from "@mui/x-data-grid";
import AwardBadgeDialog from "./AwardBadgeDialog";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import PersonAddIcon from "@mui/icons-material/PersonAdd";

// Types & Services
import { ibadge } from "../../../types";
import {
  getAllBadges,
  addBadge,
  updateBadge,
  deleteBadge,
  awardBadgeToUser,
} from "../../../services/badgeService";

export default function BadgeCatalogGrid() {
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<ibadge[]>([]);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isAwardOpen, setIsAwardOpen] = useState(false);
  const [targetBadge, setTargetBadge] = useState<ibadge | null>(null);

  const initialFormState: Omit<ibadge, "id" | "created_at"> = {
    title: "",
    description: "",
    unicode: "🏆",
    status: "active",
    sponsor: "",
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    setLoading(true);
    try {
      const data = await getAllBadges();
      setBadges(data);
    } catch (error) {
      console.error("Failed to load badges:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setFormData(initialFormState);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (badge: ibadge) => {
    setIsEditMode(true);
    setCurrentId(badge.id || null);
    setFormData({
      title: badge.title,
      description: badge.description,
      unicode: badge.unicode,
      status: badge.status,
      sponsor: badge.sponsor || "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (isEditMode && currentId) {
        await updateBadge(currentId, formData);
      } else {
        await addBadge(formData);
      }
      setIsDialogOpen(false);
      loadBadges();
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      window.confirm("Are you sure you want to delete this badge definition?")
    ) {
      await deleteBadge(id);
      loadBadges();
    }
  };

  const columns: GridColDef[] = [
    {
      field: "unicode",
      headerName: "Icon",
      width: 80,
      renderCell: (params) => (
        <Box
          sx={{
            fontSize: "1.5rem",
            display: "flex",
            alignItems: "center",
            height: "100%",
          }}
        >
          {params.value}
        </Box>
      ),
    },
    {
      field: "title",
      headerName: "Badge Details",
      flex: 1,
      renderCell: (params) => (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            height: "100%",
          }}
        >
          <Typography variant="body2" fontWeight="bold">
            {params.row.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {params.row.description}
          </Typography>
        </Box>
      ),
    },
    {
      field: "sponsor",
      headerName: "Sponsor",
      width: 150,
      valueFormatter: (value) => value || "None",
    },
    {
      field: "status",
      headerName: "Status",
      width: 120,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              display: "inline-block",
              lineHeight: 1,
              bgcolor: params.value === "active" ? "success.light" : "grey.300",
              color:
                params.value === "active"
                  ? "success.contrastText"
                  : "text.primary",
              fontSize: "0.65rem",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {params.value}
          </Box>
        </Box>
      ),
    },
    {
      field: "award",
      type: "actions",
      headerName: "Award",
      width: 80,
      getActions: (params) => [
        <GridActionsCellItem
          key="award-action"
          icon={<PersonAddIcon />}
          label="Award Badge" // FIX: label is REQUIRED for GridActionsCellItem
          onClick={() => {
            setTargetBadge(params.row as ibadge); // FIX: setTargetBadge is now defined
            setIsAwardOpen(true); // FIX: setIsAwardOpen is now defined
          }}
        />,
      ],
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
          onClick={() => handleOpenEdit(params.row as ibadge)}
        />,
        <GridActionsCellItem
          icon={<DeleteIcon color="error" />}
          label="Delete"
          onClick={() => handleDelete(params.id as string)}
        />,
      ],
    },
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6">Definitions</Typography>
        <Button
          variant="contained"
          startIcon={<EmojiEventsIcon />}
          onClick={handleOpenAdd}
        >
          New Badge
        </Button>
      </Box>

      <Paper sx={{ height: 400, width: "100%", mb: 4 }}>
        <DataGrid
          rows={badges}
          columns={columns}
          loading={loading}
          rowHeight={70}
          disableRowSelectionOnClick
        />
      </Paper>
      {/* Award Badge To User Dialog */}
      <AwardBadgeDialog
        open={isAwardOpen}
        onClose={() => setIsAwardOpen(false)}
        selectedBadge={targetBadge}
        onSuccess={() => {
          loadBadges();
          window.dispatchEvent(new CustomEvent("refreshAchievementLog"));
        }}
      />

      {/* Unified Add/Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{isEditMode ? "Edit Badge" : "Create Badge"}</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}
        >
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Icon"
              placeholder="🎯"
              sx={{ width: 100 }}
              value={formData.unicode}
              onChange={(e) =>
                setFormData({ ...formData, unicode: e.target.value })
              }
            />
            <TextField
              label="Title"
              fullWidth
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </Box>
          <TextField
            label="How to earn"
            multiline
            rows={2}
            fullWidth
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
          <TextField
            label="Sponsor"
            fullWidth
            value={formData.sponsor}
            onChange={(e) =>
              setFormData({ ...formData, sponsor: e.target.value })
            }
          />
          <TextField
            select
            label="Status"
            fullWidth
            value={formData.status}
            onChange={(e) =>
              setFormData({ ...formData, status: e.target.value as any })
            }
          >
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
