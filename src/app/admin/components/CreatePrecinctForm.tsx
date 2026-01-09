// src/app/admin/components/CreatePrecinctForm.tsx
import React, { useState, useCallback } from "react";
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

export const CreatePrecinctForm: React.FC = () => {
  const { callFunction } = useCloudFunctions();

  // Localized form state
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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Basic Validation
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
        await callFunction("adminCreatePrecinct", {
          ...form,
          id: form.id.trim(),
        });

        setResult({
          success: true,
          message: `Successfully created Precinct: ${form.id}`,
        });

        // Reset form
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
      } catch (err: any) {
        setResult({
          success: false,
          message: err.message || "Failed to create precinct",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, callFunction]
  );

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Create Individual Precinct
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Core Identity */}
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Document ID *"
            fullWidth
            required
            value={form.id}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, id: e.target.value }))
            }
            helperText="e.g. PA15-P-005"
            disabled={isSubmitting}
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
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label="Precinct Code *"
            fullWidth
            required
            value={form.precinct_code}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, precinct_code: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label="Area District"
            fullWidth
            value={form.area_district}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, area_district: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label="County Code"
            fullWidth
            value={form.county_code}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, county_code: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>

        {/* Legislative Districts */}
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            label="Congressional"
            fullWidth
            value={form.congressional_district}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                congressional_district: e.target.value,
              }))
            }
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            label="State Senate"
            fullWidth
            value={form.senate_district}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, senate_district: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            label="State House"
            fullWidth
            value={form.house_district}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, house_district: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            label="County District"
            fullWidth
            value={form.county_district}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, county_district: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <FormControlLabel
            control={
              <Switch
                checked={form.active}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, active: e.target.checked }))
                }
                disabled={isSubmitting}
              />
            }
            label="Active"
          />
        </Grid>
      </Grid>

      <Button
        type="submit"
        variant="contained"
        size="large"
        sx={{ mt: 4, py: 1.5, fontWeight: "bold" }}
        disabled={isSubmitting}
        startIcon={
          isSubmitting ? <CircularProgress size={20} color="inherit" /> : null
        }
      >
        {isSubmitting ? "Creating..." : "Create Precinct"}
      </Button>

      {result && (
        <Alert severity={result.success ? "success" : "error"} sx={{ mt: 3 }}>
          {result.message}
        </Alert>
      )}
    </Box>
  );
};
