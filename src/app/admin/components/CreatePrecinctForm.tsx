// src/app/admin/components/CreatePrecinctForm.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import {
  Box,
  Button,
  TextField,
  Typography,
  Grid,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
} from "@mui/material";

interface PrecinctFormProps {
  initialData?: any | null;
  onSuccess?: () => void;
}

export const CreatePrecinctForm: React.FC<PrecinctFormProps> = ({
  initialData,
  onSuccess,
}) => {
  const { callFunction } = useCloudFunctions();

  const [form, setForm] = useState({
    id: "",
    name: "",
    precinct_code: "",
    area_district: "",
    county_code: "",
    congressional_district: "",
    senate_district: "",
    house_district: "",
    county_district: "",
    party_rep_district: "",
    active: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Sync initialData for Editing
  useEffect(() => {
    if (initialData) {
      setForm({ ...initialData });
    } else {
      setForm({
        id: "",
        name: "",
        precinct_code: "",
        area_district: "",
        county_code: "",
        congressional_district: "",
        senate_district: "",
        house_district: "",
        county_district: "",
        party_rep_district: "",
        active: true,
      });
    }
  }, [initialData]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.id || !form.name || !form.precinct_code) {
        setResult({
          success: false,
          message: "ID, Name, and Precinct Code are required",
        });
        return;
      }

      setIsSubmitting(true);
      setResult(null);

      try {
        // In your backend, adminCreatePrecinct uses .set(), acting as an upsert (Edit/Create)
        await callFunction("adminCreatePrecinct", {
          ...form,
          id: form.id.trim(),
        });

        setResult({
          success: true,
          message: `Successfully ${
            initialData ? "updated" : "created"
          } Precinct: ${form.id}`,
        });

        if (onSuccess) {
          setTimeout(() => onSuccess(), 1500);
        }
      } catch (err: any) {
        setResult({
          success: false,
          message: err.message || "Failed to process precinct",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, callFunction, initialData, onSuccess]
  );

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Document ID *"
            fullWidth
            required
            disabled={isSubmitting || !!initialData}
            value={form.id}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, id: e.target.value }))
            }
            helperText="e.g. PA15-P-005"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Name *"
            fullWidth
            required
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            disabled={isSubmitting}
            helperText="Use official name e.g. Atglen"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <TextField
            label="Precinct Code *"
            fullWidth
            required
            value={form.precinct_code}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, precinct_code: e.target.value }))
            }
            disabled={isSubmitting}
            helperText="Use official code e.g. 005"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <TextField
            label="Area District"
            fullWidth
            value={form.area_district}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, area_district: e.target.value }))
            }
            disabled={isSubmitting}
            helperText="Use two digit number e.g. 01"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <TextField
            label="County Code"
            fullWidth
            value={form.county_code}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, county_code: e.target.value }))
            }
            disabled={isSubmitting}
            helperText="Use two digit number e.g. 15"
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Typography variant="caption" color="text.secondary">
            Legislative Districts
          </Typography>
        </Grid>

        <Grid size={{ xs: 6, md: 4 }}>
          <TextField
            label="Congressional"
            fullWidth
            value={form.congressional_district}
            onChange={(e) =>
              setForm((p) => ({ ...p, congressional_district: e.target.value }))
            }
            helperText="Use official state number e.g. 6"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <TextField
            label="Senate"
            fullWidth
            value={form.senate_district}
            onChange={(e) =>
              setForm((p) => ({ ...p, senate_district: e.target.value }))
            }
            helperText="Use official state number e.g.44"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <TextField
            label="House"
            fullWidth
            value={form.house_district}
            onChange={(e) =>
              setForm((p) => ({ ...p, house_district: e.target.value }))
            }
            helperText="Use official state number e.g. 74"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <TextField
            label="County"
            fullWidth
            value={form.county_district}
            onChange={(e) =>
              setForm((p) => ({ ...p, county_district: e.target.value }))
            }
            helperText="Use official state number e.g. 15"
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <FormControlLabel
            control={
              <Switch
                checked={form.active}
                onChange={(e) =>
                  setForm((p) => ({ ...p, active: e.target.checked }))
                }
              />
            }
            label="Active"
          />
        </Grid>
      </Grid>

      <Button
        type="submit"
        variant="contained"
        fullWidth
        sx={{ mt: 3, fontWeight: "bold" }}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <CircularProgress size={24} />
        ) : initialData ? (
          "Update Precinct"
        ) : (
          "Create Precinct"
        )}
      </Button>

      {result && (
        <Alert severity={result.success ? "success" : "error"} sx={{ mt: 2 }}>
          {result.message}
        </Alert>
      )}
    </Box>
  );
};
