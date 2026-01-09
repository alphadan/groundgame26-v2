// src/app/admin/components/ImportPrecinctsForm.tsx
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
} from "@mui/material";
import { UploadFile, CloudUpload } from "@mui/icons-material";

export const ImportPrecinctsForm: React.FC = () => {
  const { callFunction } = useCloudFunctions();

  const [jsonInput, setJsonInput] = useState("");
  const [preview, setPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleProcessJson = (value: string) => {
    setJsonInput(value);
    try {
      const parsed = JSON.parse(value);
      setPreview(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPreview([]);
    }
  };

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
      const result = await callFunction<{ success: number; total: number }>(
        "adminImportPrecincts",
        { data: preview }
      );

      setResultMessage(
        `Successfully imported ${result.success}/${result.total} precincts.`
      );
      setJsonInput("");
      setPreview([]);
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
        Bulk Import Precincts
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Upload a JSON file or paste an array of precinct objects. Required
        fields: <code>id</code>, <code>name</code>, <code>precinct_code</code>,
        and <code>area_district</code>.
      </Typography>

      <Stack spacing={3}>
        <Button
          variant="outlined"
          component="label"
          startIcon={<UploadFile />}
          disabled={isImporting}
          sx={{ alignSelf: "flex-start" }}
        >
          Upload Precincts JSON
          <input
            type="file"
            hidden
            accept=".json"
            onChange={handleFileUpload}
          />
        </Button>

        <TextField
          multiline
          rows={10}
          fullWidth
          label="Paste Precincts JSON"
          variant="outlined"
          value={jsonInput}
          onChange={(e) => handleProcessJson(e.target.value)}
          placeholder='[{"id": "PA15-P-005", "name": "Atglen", "precinct_code": "005", "area_district": "14"}]'
          disabled={isImporting}
        />

        {preview.length > 0 && (
          <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
            <Typography variant="subtitle2" color="primary">
              Preview: {preview.length} Precincts detected.
            </Typography>
          </Box>
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
          {isImporting ? "Importing..." : "Import Precincts"}
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
