import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";
import { useAuth } from "../../../context/AuthContext"; // Dynamic Auth Hook
import { CampaignResource } from "../../../types";
import {
  Box,
  Typography,
  Paper,
  Stack,
  TextField,
  MenuItem,
  Button,
  LinearProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  CircularProgress,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

export const CampaignResourcesManager: React.FC = () => {
  // 1. DYNAMIC PERMISSIONS & CLAIMS
  const { permissions, claims } = useAuth();
  const canModify = !!permissions.can_manage_resources;

  const functions = getFunctions();
  const adminGenerateResourceUploadUrl = httpsCallable(
    functions,
    "adminGenerateResourceUploadUrl",
  );

  const {
    data: existingResources,
    loading: gridLoading,
    remove,
    fetchAll,
  } = useAdminCRUD<CampaignResource>({
    collectionName: "campaign_resources",
    defaultOrderBy: "created_at",
    orderDirection: "desc",
  });

  // --- 2. Form State ---
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Brochures");
  const [scope, setScope] = useState("county");

  // Use Claims to auto-set the admin's primary county
  const [selectedCounty, setSelectedCounty] = useState(
    claims?.counties?.[0] || "PA-C-15",
  );
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedPrecinct, setSelectedPrecinct] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // --- 3. UI State ---
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  // --- 4. Delete Confirmation State ---
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- 5. Reference Data (Dexie) ---
  const counties = useLiveQuery(() => indexedDb.counties.toArray()) ?? [];
  const areas =
    useLiveQuery(async () => {
      if (!selectedCounty) return [];
      return await indexedDb.areas
        .where("county_id")
        .equals(selectedCounty)
        .toArray();
    }, [selectedCounty]) ?? [];

  const precincts =
    useLiveQuery(async () => {
      if (!selectedArea) return [];
      return await indexedDb.precincts
        .where("area_id")
        .equals(selectedArea)
        .toArray();
    }, [selectedArea]) ?? [];

  // --- 6. Handlers ---
  const handleUpload = async () => {
    if (!file || !title || !canModify) return;
    setIsUploading(true);
    setStatus(null);
    try {
      const result = await adminGenerateResourceUploadUrl({
        title,
        category,
        fileName: file.name,
        scope,
        county_code: selectedCounty,
        area_code: selectedArea,
        precinct_code: selectedPrecinct,
      });

      const { uploadUrl } = result.data as any;
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });

      setStatus({ type: "success", msg: "Upload complete! Updating list..." });
      setTitle("");
      setFile(null);
      setTimeout(fetchAll, 2500);
    } catch (err: any) {
      setStatus({ type: "error", msg: "Upload failed. Verify permissions." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId || !canModify) return;
    setIsDeleting(true);
    try {
      await remove(deleteId);
      await fetchAll();
      setDeleteId(null);
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // --- 7. DataGrid Columns ---
  const columns: GridColDef[] = [
    { field: "title", headerName: "Title", flex: 1 },
    { field: "category", headerName: "Category", width: 130 },
    {
      field: "scope",
      headerName: "Scope",
      width: 100,
      sx: { textTransform: "capitalize" },
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Stack
          direction="row"
          spacing={1}
          sx={{ height: "100%", alignItems: "center" }}
        >
          <Tooltip title="View File">
            <IconButton
              size="small"
              onClick={() => window.open(params.row.url, "_blank")}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Only show delete option if user has modification permissions */}
          {canModify && (
            <Tooltip title="Remove Resource">
              <IconButton
                size="small"
                color="error"
                onClick={() => setDeleteId(params.row.id)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Stack spacing={4}>
      {/* 8. CONDITIONAL UPLOAD FORM */}
      {canModify ? (
        <Paper
          sx={{
            p: 3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
          }}
        >
          <Typography
            variant="h6"
            gutterBottom
            fontWeight="bold"
            color="primary"
          >
            Upload Campaign Resource
          </Typography>
          <Stack spacing={2.5} mt={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Document Title"
                fullWidth
                size="small"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., 2026 Sample Ballot"
              />
              <TextField
                select
                label="Category"
                size="small"
                sx={{ minWidth: 180 }}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {[
                  "Brochures",
                  "Ballots",
                  "Graphics",
                  "Forms",
                  "Scripts",
                  "Legal",
                ].map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                label="Geographic Scope"
                size="small"
                fullWidth
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  setSelectedArea("");
                  setSelectedPrecinct("");
                }}
              >
                <MenuItem value="county">Countywide</MenuItem>
                <MenuItem value="area">Specific Area</MenuItem>
                <MenuItem value="precinct">Specific Precinct</MenuItem>
              </TextField>
              <TextField
                select
                label="County"
                size="small"
                fullWidth
                disabled={claims?.role !== "developer"} // Only developers can switch counties
                value={selectedCounty}
                onChange={(e) => setSelectedCounty(e.target.value)}
              >
                {counties.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            {scope !== "county" && (
              <TextField
                select
                label="Target Area"
                size="small"
                fullWidth
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
              >
                {areas.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {scope === "precinct" && (
              <TextField
                select
                label="Target Precinct"
                size="small"
                fullWidth
                value={selectedPrecinct}
                onChange={(e) => setSelectedPrecinct(e.target.value)}
              >
                {precincts.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name} ({p.id})
                  </MenuItem>
                ))}
              </TextField>
            )}

            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              fullWidth
              sx={{ py: 1.5, borderStyle: "dashed" }}
            >
              {file ? file.name : "Choose PDF Document"}
              <input
                type="file"
                hidden
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Button>

            {isUploading && (
              <LinearProgress sx={{ borderRadius: 1, height: 6 }} />
            )}
            {status && (
              <Alert severity={status.type} variant="outlined">
                {status.msg}
              </Alert>
            )}

            <Button
              variant="contained"
              onClick={handleUpload}
              size="large"
              disabled={isUploading || !file || !title}
              sx={{ fontWeight: "bold" }}
            >
              {isUploading
                ? "Uploading to Storage..."
                : "Publish to Field Team"}
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Alert severity="warning" variant="outlined">
          <strong>Read-Only Access:</strong> You can view and open published
          assets, but your role does not have permission to upload or delete
          resources.
        </Alert>
      )}

      {/* 9. ASSET LIST SECTION */}
      <Paper
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            p: 2,
            bgcolor: "rgba(0,0,0,0.02)",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold">
            Live Field Assets
          </Typography>
        </Box>
        <Box sx={{ height: 500, width: "100%" }}>
          <DataGrid
            rows={existingResources}
            columns={columns}
            loading={gridLoading}
            pageSizeOptions={[10, 25]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{ border: "none" }}
          />
        </Box>
      </Paper>

      {/* 10. DELETE CONFIRMATION */}
      <Dialog
        open={Boolean(deleteId)}
        onClose={() => !isDeleting && setDeleteId(null)}
      >
        <DialogTitle sx={{ fontWeight: "bold", color: "error.main" }}>
          Remove Resource?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently remove the document record. The file will no
            longer be accessible to the field team.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteId(null)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={isDeleting}
          >
            {isDeleting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Confirm Removal"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
