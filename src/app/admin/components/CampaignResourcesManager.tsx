// src/app/admin/components/CampaignResourcesManager.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import { db as firestore } from "../../../lib/firebase";
import { CampaignResource } from "../../../types";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Grid,
  Stack,
  Divider,
  IconButton,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  MenuItem,
  Tooltip,
  Chip,  
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  OpenInNew as OpenIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import confetti from "canvas-confetti";
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getPrecinctsByArea } from "../../../lib/db";

export const CampaignResourcesManager: React.FC = () => {
  const { callFunction } = useCloudFunctions();

  // --- State ---
  const [resources, setResources] = useState<CampaignResource[]>([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<string | null>(null);
  const [availablePrecincts, setAvailablePrecincts] = useState<any[]>([]);

  const [newResource, setNewResource] = useState({
    title: "",
    description: "",
    category: "Brochures" as CampaignResource["category"],
    scope: "area" as "county" | "area" | "precinct",
    geoId: "",
    file: null as File | null,
  });

  // Length trackers
  const titleLength = newResource.title.length;
  const descriptionLength = newResource.description.length;

  // --- Load Data ---
  const loadResources = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(
        query(
          collection(firestore, "campaign_resources"),
          orderBy("created_at", "desc")
        )
      );
      setResources(
        snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as CampaignResource)
        )
      );
    } catch (err) {
      console.error("Load failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResources();
    getPrecinctsByArea("PA15-A-15").then(setAvailablePrecincts);
  }, [loadResources]);

  // --- Filter Logic for Scope ---
  const scopeOptions = useMemo(() => {
    if (newResource.category === "Ballots") return ["precinct"];
    if (["Brochures", "Graphics"].includes(newResource.category))
      return ["area", "county"];
    return ["county"];
  }, [newResource.category]);

  useEffect(() => {
    if (!scopeOptions.includes(newResource.scope)) {
      setNewResource((prev) => ({ ...prev, scope: scopeOptions[0] as any }));
    }
  }, [scopeOptions, newResource.scope]);

  // --- Search Filtering ---
  const filteredResources = useMemo(() => {
    return resources.filter(
      (r) =>
        r.title.toLowerCase().includes(searchText.toLowerCase()) ||
        (r.description || "").toLowerCase().includes(searchText.toLowerCase())
    );
  }, [resources, searchText]);

  // --- Handlers ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setError("File size exceeds 15MB.");
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Only PDFs are accepted.");
      return;
    }
    setError(null);
    setNewResource((prev) => ({ ...prev, file }));
  };

  const handleUpload = async () => {
    if (!newResource.file || !newResource.title.trim()) return;

    // Extra validation for limits
    if (newResource.title.length > 60) {
      setError("Title cannot exceed 60 characters.");
      return;
    }
    if (newResource.description.length > 120) {
      setError("Description cannot exceed 120 characters.");
      return;
    }

    setIsUploading(true);
    try {
      const { uploadUrl } = await callFunction<{ uploadUrl: string }>(
        "adminGenerateResourceUploadUrl",
        {
          category: newResource.category,
          fileName: newResource.file.name,
        }
      );

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", "application/pdf");

        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) resolve(true);
          else reject(new Error(xhr.responseText));
        };
        xhr.onerror = () => reject(new Error("Network Error"));
        xhr.send(newResource.file);
      });

      const downloadUrl = uploadUrl.split("?")[0] + "?alt=media";

      await addDoc(collection(firestore, "campaign_resources"), {
        title: newResource.title.trim(),
        description: newResource.description.trim(),
        category: newResource.category,
        scope: newResource.scope,
        county_code: newResource.scope === "county" ? "15" : "",
        area_code: newResource.scope === "area" ? "15" : "",
        precinct_code:
          newResource.scope === "precinct"
            ? newResource.geoId.split("-").pop()
            : "",
        url: downloadUrl,
        created_at: serverTimestamp(),
      });

      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      loadResources();
      setNewResource({
        title: "",
        description: "",
        category: "Brochures",
        scope: "area",
        geoId: "",
        file: null,
      });
    } catch (err: any) {
      console.error("Upload Error:", err);
      setError("Upload failed. Please check console for details.");
    } finally {
      setIsUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!resourceToDelete) return;
    try {
      await deleteDoc(doc(firestore, "campaign_resources", resourceToDelete));
      setResources((prev) => prev.filter((r) => r.id !== resourceToDelete));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteConfirmOpen(false);
      setResourceToDelete(null);
    }
  };

  // --- DataGrid Columns (unchanged) ---
  const columns: GridColDef[] = [
    { field: "title", headerName: "Title", flex: 1, minWidth: 200 },
    { field: "category", headerName: "Category", width: 120 },
    {
      field: "description",
      headerName: "Description",
      flex: 1.5,
      renderCell: (params: GridRenderCellParams) => (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ height: "100%" }}
        >
          <Typography variant="body2" noWrap>
            {params.value || "—"}
          </Typography>
          {params.value && (
            <Tooltip title={params.value} arrow>
              <InfoIcon
                fontSize="small"
                color="disabled"
                sx={{ cursor: "help" }}
              />
            </Tooltip>
          )}
        </Stack>
      ),
    },
    {
      field: "scope",
      headerName: "Scope",
      width: 110,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          variant="outlined"
          sx={{ textTransform: "capitalize" }}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 110,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={1}>
          <IconButton
            size="small"
            onClick={() => window.open(params.row.url, "_blank")}
            color="primary"
          >
            <OpenIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              setResourceToDelete(params.row.id as string);
              setDeleteConfirmOpen(true);
            }}
            color="error"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  return (
    <Paper sx={{ p: { xs: 2, md: 4 }, mt: 4, borderRadius: 3 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom color="primary">
        Campaign Resource Manager
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Upload and assign localized campaign materials across the organization.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            select
            label="Category"
            fullWidth
            value={newResource.category}
            onChange={(e) =>
              setNewResource((p) => ({ ...p, category: e.target.value as any }))
            }
          >
            {["Brochures", "Ballots", "Forms", "Graphics", "Scripts"].map(
              (c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              )
            )}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            select
            label="Assignment Scope"
            fullWidth
            value={newResource.scope}
            onChange={(e) =>
              setNewResource((p) => ({ ...p, scope: e.target.value as any }))
            }
          >
            {scopeOptions.map((s) => (
              <MenuItem key={s} value={s} sx={{ textTransform: "capitalize" }}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        {newResource.scope === "precinct" && (
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              label="Assign to Precinct"
              fullWidth
              value={newResource.geoId}
              onChange={(e) =>
                setNewResource((p) => ({ ...p, geoId: e.target.value }))
              }
            >
              {availablePrecincts.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        )}

        {/* Title with 60 char limit + counter */}
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Title"
            fullWidth
            value={newResource.title}
            onChange={(e) =>
              setNewResource((p) => ({
                ...p,
                title: e.target.value.slice(0, 60),
              }))
            }
            inputProps={{ maxLength: 60 }}
            error={titleLength > 50}
            helperText={
              <Box component="span">
                {titleLength}/60 characters
                {titleLength > 40 && titleLength <= 50 && (
                  <Box component="span" sx={{ color: "warning.main", ml: 1 }}>
                    ⚠️ May truncate on mobile
                  </Box>
                )}
                {titleLength > 50 && (
                  <Box component="span" sx={{ color: "error.main", ml: 1 }}>
                    Too long!
                  </Box>
                )}
              </Box>
            }
          />
        </Grid>

        {/* Description with 120 char limit + counter */}
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={newResource.description}
            onChange={(e) =>
              setNewResource((p) => ({
                ...p,
                description: e.target.value.slice(0, 120),
              }))
            }
            inputProps={{ maxLength: 120 }}
            error={descriptionLength > 100}
            helperText={
              <Box component="span">
                {descriptionLength}/120 characters
                {descriptionLength > 80 && descriptionLength <= 100 && (
                  <Box component="span" sx={{ color: "warning.main", ml: 1 }}>
                    Consider shortening
                  </Box>
                )}
                {descriptionLength > 100 && (
                  <Box component="span" sx={{ color: "error.main", ml: 1 }}>
                    Too long!
                  </Box>
                )}
              </Box>
            }
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Button
            variant="outlined"
            component="label"
            fullWidth
            startIcon={
              newResource.file ? (
                <CheckCircleIcon color="success" />
              ) : (
                <UploadIcon />
              )
            }
            sx={{ height: 56, borderStyle: "dashed" }}
          >
            {newResource.file ? newResource.file.name : "Select PDF Document"}
            <input
              type="file"
              hidden
              accept=".pdf"
              onChange={handleFileSelect}
            />
          </Button>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleUpload}
            disabled={
              isUploading || !newResource.file || !newResource.title.trim()
            }
            sx={{ height: 56, fontWeight: "bold" }}
          >
            {isUploading
              ? `Uploading ${uploadProgress}%`
              : "Publish to Library"}
          </Button>
        </Grid>
      </Grid>

      {isUploading && (
        <LinearProgress
          variant="determinate"
          value={uploadProgress}
          sx={{ mt: 2, height: 8, borderRadius: 4 }}
        />
      )}

      <Divider sx={{ my: 6 }} />

      {/* Rest of your component (search + DataGrid + Delete Dialog) remains unchanged */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems="center"
        spacing={2}
        mb={3}
      >
        <Typography variant="h6" fontWeight="bold">
          Live Resource Library
        </Typography>
        <TextField
          size="small"
          placeholder="Search resources..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <SearchIcon
                fontSize="small"
                sx={{ mr: 1, color: "text.secondary" }}
              />
            ),
          }}
          sx={{ width: { xs: "100%", sm: 300 } }}
        />
      </Stack>

      <Box sx={{ height: 600, width: "100%" }}>
        <DataGrid
          rows={filteredResources}
          columns={columns}
          loading={loading}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          sx={{ "& .font-weight-bold": { fontWeight: "bold" }, border: "none" }}
        />
      </Box>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>Delete Resource?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will permanently remove this asset from the volunteer Download
            Center. The file will be unlinked from the system immediately.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Confirm Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
