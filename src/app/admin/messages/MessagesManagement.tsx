// src/app/admin/messages/MessagesManagement.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db";
import { UserPermissions } from "../../../types";
import { MessageTemplateForm } from "../components/MessageTemplateForm";

// Material UI
import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Button,
  Stack,
  Chip,
} from "@mui/material";
import { DataGrid, GridColDef, GridActionsCellItem } from "@mui/x-data-grid";
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from "@mui/icons-material";

export default function MessagesManagement() {
  const { user, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  // Hook Integration (Aligned with your hook's actual return values)
  const {
    data: messages,
    loading: dataLoading,
    remove,
    fetchAll,
  } = useAdminCRUD({
    collectionName: "message_templates",
    defaultOrderBy: "last_updated",
    orderDirection: "desc",
  });

  // View State
  const [showForm, setShowForm] = useState(false);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);

  // This triggers the data load as soon as the page opens
  useEffect(() => {
    if (authLoaded) {
      fetchAll();
    }
  }, [authLoaded]);

  const localUser = useLiveQuery(async () => {
    if (!user?.uid) return null;
    return await indexedDb.users.get(user.uid);
  }, [user?.uid]);

  const permissions = (localUser?.permissions || {}) as UserPermissions;
  const canManageResources = !!permissions.can_manage_resources;

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this template?")) {
      try {
        await remove(id);
        await fetchAll();
      } catch (err) {
        console.error("Delete failed:", err);
      }
    }
  };

  const columns: GridColDef[] = [
    {
      field: "category",
      headerName: "Category",
      width: 150,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          variant="outlined"
          color="primary"
        />
      ),
    },
    {
      field: "subject_line",
      headerName: "Subject Line",
      flex: 1,
      minWidth: 200,
    },
    {
      field: "party",
      headerName: "Party",
      width: 120,
      valueGetter: (_, row) => row.party || "All",
    },
    {
      field: "age_group",
      headerName: "Age Group",
      width: 110,
      valueGetter: (_, row) => row.age_group || "All",
    },
    {
      field: "gender",
      headerName: "Gender",
      width: 110,
      valueGetter: (_, row) => row.gender || "All",
    },
    {
      field: "has_mail_ballot",
      headerName: "Mail Ballot",
      width: 110,
      valueGetter: (_, row) => row.has_mail_ballot || "All",
    },
    { field: "active", headerName: "Status", width: 100, type: "boolean" },
    {
      field: "actions",
      type: "actions",
      headerName: "Actions",
      width: 100,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<EditIcon color="primary" />}
          label="Edit"
          onClick={() => {
            setEditingMessage(params.row);
            setShowForm(true);
          }}
        />,
        <GridActionsCellItem
          icon={<DeleteIcon color="error" />}
          label="Delete"
          onClick={() => handleDelete(params.id as string)}
        />,
      ],
    },
  ];

  if (!authLoaded) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (!canManageResources) {
    return (
      <Box p={4}>
        <Alert severity="error">
          Access Denied: You do not have permission.
        </Alert>
      </Box>
    );
  }

  console.log("Current Messages State:", {
    count: messages?.length,
    data: messages,
    loading: dataLoading,
  });

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Top Bar */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton onClick={() => navigate("/admin")} color="primary">
            <ArrowBackIcon fontSize="large" />
          </IconButton>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              Manage Messages
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {showForm
                ? "Customize your message template below"
                : "View and manage all active scripts"}
            </Typography>
          </Box>
        </Stack>

        {!showForm && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingMessage(null);
              setShowForm(true);
            }}
            sx={{ borderRadius: 2 }}
          >
            Create New
          </Button>
        )}
      </Box>

      <Divider sx={{ mb: 4 }} />

      {showForm ? (
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" mb={3}>
            <Typography variant="h6" fontWeight="bold">
              {editingMessage ? "Edit Template" : "New Template"}
            </Typography>
            <Button color="inherit" onClick={() => setShowForm(false)}>
              Cancel & Back
            </Button>
          </Stack>
          <MessageTemplateForm
            initialData={editingMessage}
            onSuccess={() => {
              setShowForm(false);
              fetchAll();
            }}
          />
        </Paper>
      ) : (
        <Paper
          elevation={3}
          sx={{ borderRadius: 3, height: 650, width: "100%" }}
        >
          <DataGrid
            rows={messages || []}
            columns={columns}
            loading={dataLoading}
            getRowId={(row) => row.id}
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            disableRowSelectionOnClick
            sx={{ border: 0 }}
          />
        </Paper>
      )}
    </Box>
  );
}
