// src/app/admin/components/AreaForm.tsx
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

export const AreaForm: React.FC = () => {
  const { callFunction } = useCloudFunctions();

  // Localized form state
  const [form, setForm] = useState({
    id: "",
    name: "",
    area_district: "",
    org_id: "",
    chair_uid: "",
    chair_email: "",
    vice_chair_uid: "",
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
      if (!form.id || !form.name || !form.area_district) {
        setResult({
          success: false,
          message: "ID, Name, and District are required",
        });
        return;
      }

      setIsSubmitting(true);
      setResult(null);

      try {
        await callFunction("adminCreateArea", {
          ...form,
          // Ensure ID and emails are trimmed
          id: form.id.trim(),
          chair_email: form.chair_email.trim() || null,
        });

        setResult({
          success: true,
          message: `Successfully created Area: ${form.id}`,
        });

        // Reset form
        setForm({
          id: "",
          name: "",
          area_district: "",
          org_id: "",
          chair_uid: "",
          chair_email: "",
          vice_chair_uid: "",
          active: true,
        });
      } catch (err: any) {
        setResult({
          success: false,
          message: err.message || "Failed to create area",
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
        Create Individual Area
      </Typography>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Document ID *"
            fullWidth
            value={form.id}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, id: e.target.value }))
            }
            required
            disabled={isSubmitting}
            helperText="e.g. PA15-A-14"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Name *"
            fullWidth
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            required
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Area District *"
            fullWidth
            value={form.area_district}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, area_district: e.target.value }))
            }
            required
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Org ID"
            fullWidth
            value={form.org_id}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, org_id: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Chair UID"
            fullWidth
            value={form.chair_uid}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, chair_uid: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Chair Email"
            type="email"
            fullWidth
            value={form.chair_email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, chair_email: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Vice Chair UID"
            fullWidth
            value={form.vice_chair_uid}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, vice_chair_uid: e.target.value }))
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
        {isSubmitting ? "Creating..." : "Create Area"}
      </Button>

      {result && (
        <Alert severity={result.success ? "success" : "error"} sx={{ mt: 3 }}>
          {result.message}
        </Alert>
      )}
    </Box>
  );
};
