// src/app/admin/surveys/SurveysManagement.tsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { Survey } from "../../../types";
import { SurveyForm } from "./components/SurveyForm";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";
import { useNavigate } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BarChartIcon from "@mui/icons-material/BarChart";
import Tooltip from "@mui/material/Tooltip";
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
  Stack,
  Chip,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";

export default function SurveysManagement() {
  const { permissions, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  const canModify = !!permissions.can_create_documents;

  const {
    data: surveys,
    loading,
    error: crudError,
    fetchAll,
  } = useAdminCRUD<Survey>({
    collectionName: "surveys",
    defaultOrderBy: "name",
    orderDirection: "asc",
  });

  const [surveyDialogOpen, setSurveyDialogOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);

  // Focus blur fix
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  // Refresh list on mount
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleOpenCreate = () => {
    setSelectedSurvey(null);
    setSurveyDialogOpen(true);
  };

  const handleOpenEdit = (survey: Survey) => {
    setSelectedSurvey(survey);
    setSurveyDialogOpen(true);
  };

  const columns: GridColDef<Survey>[] = [
    { field: "survey_id", headerName: "Survey ID", width: 130 },
    { field: "name", headerName: "Name", flex: 1, minWidth: 180 },
    { field: "description", headerName: "Description", flex: 2, minWidth: 250 },
    {
      field: "active",
      headerName: "Status",
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.row.active ? "Active" : "Inactive"}
          color={params.row.active ? "success" : "error"}
          size="small"
        />
      ),
    },
    {
      field: "demographics.age_group",
      headerName: "Age Group",
      width: 130,
      valueFormatter: (value, row) => row.demographics?.age_group || "—",
    },
    {
      field: "demographics.area_id",
      headerName: "Area ID",
      width: 130,
      valueFormatter: (value, row) => row.demographics?.area_id || "—",
    },
    {
      field: "demographics.sex",
      headerName: "Sex",
      width: 100,
      valueFormatter: (value, row) => row.demographics?.sex || "—",
    },
    {
      field: "demographics.party_affiliation",
      headerName: "Party",
      width: 140,
      valueFormatter: (value, row) =>
        row.demographics?.party_affiliation || "—",
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 280,
      sortable: false,
      renderCell: (params) => (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ height: "100%" }}
        >
          {/* EDIT: Guarded by permission */}
          {canModify && (
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={() => handleOpenEdit(params.row)}
            >
              Edit
            </Button>
          )}
          <Button
            size="small"
            startIcon={<VisibilityIcon />}
            onClick={() =>
              window.open(`/surveys/${params.row.survey_id}`, "_blank")
            }
          >
            Preview
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<BarChartIcon />}
            onClick={() =>
              navigate(`/admin/surveys/${params.row.survey_id}/results`)
            }
            color="secondary"
          >
            Results
          </Button>
        </Stack>
      ),
    },
  ];

  if (!authLoaded) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "70vh",
        }}
      >
        <CircularProgress color="primary" size={60} />
      </Box>
    );
  }

  if (!permissions.can_manage_team && !canModify) {
    return (
      <Box p={6} textAlign="center">
        <Alert severity="error" variant="filled">
          <Typography variant="h6">Access Denied</Typography>
          <Typography variant="body1" mt={1}>
            You do not have permission to manage community surveys.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Back Button + Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Tooltip title="Back to Admin Dashboard" arrow>
          <IconButton
            onClick={() => navigate("/admin")}
            color="primary"
            size="large"
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
        </Tooltip>

        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Manage Surveys
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Configure community feedback and canvas scripts
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* CREATE BUTTON: Guarded by permission */}
      {canModify && (
        <Box sx={{ mb: 4 }}>
          <Button
            variant="contained"
            onClick={handleOpenCreate}
            startIcon={<AddIcon />}
            size="large"
          >
            Create New Survey
          </Button>
        </Box>
      )}

      {/* Survey List */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          Survey List
        </Typography>

        {crudError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {crudError}
          </Alert>
        )}

        <Paper
          elevation={0}
          variant="outlined"
          sx={{ borderRadius: 3, overflow: "hidden" }}
        >
          <DataGrid
            rows={surveys}
            columns={columns}
            loading={loading}
            getRowId={(row) => row.survey_id}
            autoHeight
            pageSizeOptions={[10, 25, 50]}
            disableRowSelectionOnClick
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          />
        </Paper>
      </Box>
      {/* Create/Edit Dialog */}
      <Dialog
        open={surveyDialogOpen}
        onClose={() => setSurveyDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>
          {selectedSurvey ? "Update Survey Parameters" : "Register New Survey"}
        </DialogTitle>
        <DialogContent dividers>
          <SurveyForm
            initialData={selectedSurvey}
            onSuccess={() => {
              setSurveyDialogOpen(false);
              fetchAll();
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSurveyDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
