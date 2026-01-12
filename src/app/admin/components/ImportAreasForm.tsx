// src/app/admin/components/ImportAreasForm.tsx
import React, { useState, useCallback } from "react";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import {
  Box,
  Button,
  TextField,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { UploadFile, CloudUpload } from "@mui/icons-material";

export const ImportAreasForm: React.FC = () => {
  const { callFunction } = useCloudFunctions();

  const [jsonInput, setJsonInput] = useState("");
  const [preview, setPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleProcessJson = useCallback((value: string) => {
    setJsonInput(value);
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        // Basic client-side validation
        const validated = parsed.filter(item => 
          item.id?.trim() && item.name?.trim() && item.area_district?.trim()
        );
        setPreview(validated);
      } else {
        setPreview([]);
      }
    } catch {
      setPreview([]);
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleProcessJson(text);
    };
    reader.readAsText(file);
  };

  const handleImport = useCallback(async () => {
    if (preview.length === 0) return;

    setIsImporting(true);
    setResultMessage(null);
    setIsError(false);

    try {
      const result = await callFunction<{ success: number; total: number; errors?: string[] }>(
        "adminImportAreas",
        { data: preview }
      );

      if (result.errors?.length) {
        setIsError(true);
        setResultMessage(
          `Imported ${result.success}/${result.total} areas. Errors: ${result.errors.join('; ')}`
        );
      } else {
        setResultMessage(`Successfully imported ${result.success} areas.`);
        setJsonInput("");
        setPreview([]);
      }
    } catch (err: any) {
      setIsError(true);
      setResultMessage(`Import failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsImporting(false);
    }
  }, [preview, callFunction]);

  return (
    <Box>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Bulk Import Areas
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Upload a JSON file or paste an array of area objects. Required fields:
        <br />• <code>id</code> (unique, e.g. PA15-A-14)
        <br />• <code>name</code> (e.g. "Area 14")
        <br />• <code>area_district</code> (e.g. "14")
        <br />• <code>county_id</code> (e.g. "PA-C-15")
        <br />• <code>active</code> (boolean, optional – defaults to true)
      </Typography>

      <Stack spacing={3}>
        <Button
          variant="outlined"
          component="label"
          startIcon={<UploadFile />}
          disabled={isImporting}
          sx={{ alignSelf: "flex-start" }}
        >
          Upload Areas JSON
          <input type="file" hidden accept=".json" onChange={handleFileUpload} />
        </Button>

        <TextField
          multiline
          rows={10}
          fullWidth
          label="Paste Areas JSON"
          variant="outlined"
          value={jsonInput}
          onChange={(e) => handleProcessJson(e.target.value)}
          placeholder='[{"id": "PA15-A-14", "name": "Area 14", "area_district": "14", "county_id": "PA-C-15", "active": true}]'
          disabled={isImporting}
        />

        {preview.length > 0 && (
          <>
            <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
              <Typography variant="subtitle2" color="primary">
                Ready to Import: {preview.length} valid areas detected.
              </Typography>
            </Box>

            {/* Preview Table – Very helpful for bulk */}
            <TableContainer component={Paper} sx={{ maxHeight: 300, overflow: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>District</TableCell>
                    <TableCell>County ID</TableCell>
                    <TableCell>Active</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.slice(0, 10).map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.id || '—'}</TableCell>
                      <TableCell>{item.name || '—'}</TableCell>
                      <TableCell>{item.area_district || '—'}</TableCell>
                      <TableCell>{item.county_id || '—'}</TableCell>
                      <TableCell>{item.active ?? 'true'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.length > 10 && (
                <Typography variant="caption" sx={{ p: 2, display: 'block' }}>
                  Showing first 10 of {preview.length}...
                </Typography>
              )}
            </TableContainer>
          </>
        )}

        <Button
          variant="contained"
          onClick={handleImport}
          disabled={isImporting || preview.length === 0}
          startIcon={
            isImporting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <CloudUpload />
            )
          }
          size="large"
          sx={{ py: 1.5, fontWeight: "bold" }}
        >
          {isImporting ? "Importing..." : "Start Import"}
        </Button>

        {resultMessage && (
          <Alert severity={isError ? "error" : "success"} sx={{ mt: 2 }}>
            {resultMessage}
          </Alert>
        )}
      </Stack>
    </Box>
  );
};