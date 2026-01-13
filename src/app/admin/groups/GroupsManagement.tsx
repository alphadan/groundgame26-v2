import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";
import { Group } from "../../../types";

// Components & Icons
import { GroupForm } from "../components/GroupForm";
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
  Link,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import WebsiteIcon from "@mui/icons-material/Language";
import PhoneIcon from "@mui/icons-material/Phone";
import FacebookIcon from "@mui/icons-material/Facebook";
import XIcon from "@mui/icons-material/X";
import InstagramIcon from "@mui/icons-material/Instagram";

export default function GroupsManagement() {
  const navigate = useNavigate();
  const { isLoaded: authLoaded } = useAuth();

  // 1. Initialize CRUD Hook
  const {
    data: groups,
    loading,
    error,
    search,
    remove,
    fetchAll,
  } = useAdminCRUD<Group>({
    collectionName: "groups",
    defaultOrderBy: "name",
    orderDirection: "asc",
  });

  // 2. Local State
  const [searchText, setSearchText] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 10,
    page: 0,
  });

  // 3. Handlers
  const handleOpenCreate = () => {
    setSelectedGroup(null);
    setDialogOpen(true);
  };
  const handleOpenEdit = (group: Group) => {
    setSelectedGroup(group);
    setDialogOpen(true);
  };

  const handleSearch = () => {
    if (searchText.trim()) {
      search("name", ">=", searchText.trim());
    } else {
      fetchAll();
    }
  };

  // 4. Grid Column Definitions
  const columns: GridColDef[] = [
    { field: "code", headerName: "Code", width: 90 },
    { field: "name", headerName: "Group Name", flex: 1, minWidth: 200 },
    {
      field: "contact",
      headerName: "Contact & Links",
      width: 220,
      sortable: false,
      renderCell: (params) => {
        const {
          website,
          hq_phone,
          social_facebook,
          social_x,
          social_instagram,
        } = params.row;
        return (
          <Box
            sx={{ display: "flex", flexDirection: "column", gap: 0.5, py: 1.5 }}
          >
            {website && (
              <Link
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                color="primary"
                variant="caption"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  fontWeight: 600,
                }}
              >
                <WebsiteIcon sx={{ fontSize: 16 }} /> Website
              </Link>
            )}
            {hq_phone && (
              <Link
                href={`tel:${hq_phone.replace(/\D/g, "")}`}
                color="text.primary"
                variant="caption"
                underline="none"
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <PhoneIcon sx={{ fontSize: 14 }} color="action" /> {hq_phone}
              </Link>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              {social_facebook && (
                <Link href={social_facebook} target="_blank">
                  <FacebookIcon sx={{ fontSize: 18, color: "#1877F2" }} />
                </Link>
              )}
              {social_x && (
                <Link href={social_x} target="_blank">
                  <XIcon sx={{ fontSize: 16, color: "#000" }} />
                </Link>
              )}
              {social_instagram && (
                <Link href={social_instagram} target="_blank">
                  <InstagramIcon sx={{ fontSize: 18, color: "#E4405F" }} />
                </Link>
              )}
            </Stack>
          </Box>
        );
      },
    },
    {
      field: "active",
      headerName: "Status",
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value ? "Active" : "Inactive"}
          color={params.value ? "success" : "error"}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 110,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleOpenEdit(params.row)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
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
    },
  ];

  if (!authLoaded)
    return <CircularProgress sx={{ display: "block", m: "20% auto" }} />;

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
            Manage Groups
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Database of coalition partners and community groups
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Control Bar */}
      <Stack direction="row" spacing={2} mb={3}>
        <TextField
          label="Filter by Name"
          size="small"
          fullWidth
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSearch()}
          sx={{ bgcolor: "white" }}
        />
        <Button
          variant="contained"
          onClick={handleSearch}
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
          Add Group
        </Button>
      </Stack>

      {/* Main Grid View */}
      <Paper
        elevation={3}
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid #e0e0e0",
        }}
      >
        <DataGrid
          rows={groups}
          columns={columns}
          loading={loading}
          getRowHeight={() => "auto"}
          getEstimatedRowHeight={() => 100}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[5, 10, 25]}
          autoHeight
          disableRowSelectionOnClick
          sx={{
            "& .MuiDataGrid-cell": {
              py: 1,
              display: "flex",
              alignItems: "center",
            },
            border: "none",
          }}
        />
      </Paper>

      {/* Info Section */}
      {groups.length > 0 && (
        <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }}>
          Displaying {groups.length} active group profiles. Use the search bar
          to filter by name.
        </Alert>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>
          {selectedGroup ? `Edit ${selectedGroup.name}` : "Register New Group"}
        </DialogTitle>
        <DialogContent dividers>
          <GroupForm
            initialData={selectedGroup}
            onSuccess={() => {
              setDialogOpen(false);
              fetchAll();
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle color="error">Confirm Permanent Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Warning: This will permanently remove this group from the dashboard.
            This action cannot be undone.
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
            Confirm Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
