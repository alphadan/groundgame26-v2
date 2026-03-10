import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";
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
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

export const CampaignResourcesManager: React.FC = () => {
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

  // --- 1. Form State ---
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Brochures");
  const [scope, setScope] = useState("county");
  const [selectedCounty, setSelectedCounty] = useState("PA-C-15");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedPrecinct, setSelectedPrecinct] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // --- 2. UI State ---
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  // --- 3. Delete Confirmation State ---
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- 4. Reference Data (Dexie) ---
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

  // --- 5. Handlers ---
  const handleUpload = async () => {
    if (!file || !title) return;
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
      setStatus({ type: "error", msg: "Upload failed." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
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

  // --- 6. DataGrid Columns ---
  const columns: GridColDef[] = [
    { field: "title", headerName: "Title", flex: 1 },
    { field: "category", headerName: "Category", width: 120 },
    { field: "scope", headerName: "Scope", width: 100 },
    {
      field: "location",
      headerName: "Assigned To",
      width: 180,
      renderCell: (params) => {
        const val =
          params.row.precinct_code ||
          params.row.area_code ||
          params.row.county_code;
        return (
          <Typography variant="caption" sx={{ fontWeight: 500 }}>
            {val || "Global"}
          </Typography>
        );
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="View File">
            <IconButton
              size="small"
              onClick={() => window.open(params.row.url, "_blank")}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Remove Resource">
            {/* Trigger modal instead of direct delete */}
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

  return (
    <Stack spacing={4}>
      {/* UPLOAD FORM SECTION */}
      <Paper sx={{ p: 3, border: "1px solid #eee", borderRadius: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">
          Upload Resource
        </Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Title"
              fullWidth
              size="small"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <TextField
              select
              label="Category"
              size="small"
              sx={{ minWidth: 150 }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {["Brochures", "Ballots", "Graphics", "Forms", "Scripts"].map(
                (c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ),
              )}
            </TextField>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              label="Scope"
              size="small"
              fullWidth
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setSelectedArea("");
                setSelectedPrecinct("");
              }}
            >
              <MenuItem value="county">County</MenuItem>
              <MenuItem value="area">Area</MenuItem>
              <MenuItem value="precinct">Precinct</MenuItem>
            </TextField>
            <TextField
              select
              label="County"
              size="small"
              fullWidth
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
              label="Area"
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
              label="Precinct"
              size="small"
              fullWidth
              value={selectedPrecinct}
              onChange={(e) => setSelectedPrecinct(e.target.value)}
            >
              {precincts.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
          )}

          <Button
            variant="outlined"
            component="label"
            startIcon={<CloudUploadIcon />}
            fullWidth
          >
            {file ? file.name : "Select PDF"}
            <input
              type="file"
              hidden
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Button>

          {isUploading && <LinearProgress />}
          {status && <Alert severity={status.type}>{status.msg}</Alert>}

          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={isUploading || !file || !title}
          >
            Publish Resource
          </Button>
        </Stack>
      </Paper>

      {/* ASSET LIST SECTION */}
      <Paper
        sx={{ borderRadius: 3, overflow: "hidden", border: "1px solid #eee" }}
      >
        <Box sx={{ p: 2, bgcolor: "#fcfcfc", borderBottom: "1px solid #eee" }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Published Assets
          </Typography>
        </Box>
        <div style={{ height: 400, width: "100%" }}>
          <DataGrid
            rows={existingResources}
            columns={columns}
            loading={gridLoading}
            pageSizeOptions={[5, 10]}
            initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
            sx={{ border: "none" }}
          />
        </div>
      </Paper>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog
        open={Boolean(deleteId)}
        onClose={() => !isDeleting && setDeleteId(null)}
        aria-labelledby="alert-dialog-title"
      >
        <DialogTitle
          id="alert-dialog-title"
          sx={{ fontWeight: "bold", color: "error.main" }}
        >
          Confirm Permanent Deletion?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove this resource? This will delete the
            document record from the database. (Note: This action cannot be
            undone.)
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setDeleteId(null)}
            disabled={isDeleting}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            autoFocus
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Confirm Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
