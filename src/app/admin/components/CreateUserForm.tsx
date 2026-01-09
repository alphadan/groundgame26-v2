// src/app/admin/components/CreateUserForm.tsx
import React, { useState, useCallback } from "react";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import {
  Box,
  Button,
  TextField,
  Typography,
  Grid,
  Alert,
  CircularProgress,
} from "@mui/material";

// Validation helper
const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const CreateUserForm: React.FC = () => {
  const { callFunction } = useCloudFunctions();

  const [form, setForm] = useState({
    email: "",
    display_name: "",
    preferred_name: "",
    phone: "",
    photo_url: "",
    org_id: "",
    primary_county: "",
    primary_precinct: "",
    role: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isValidEmail(form.email)) {
        setResult({
          success: false,
          message: "A valid email address is required.",
        });
        return;
      }

      setIsSubmitting(true);
      setResult(null);

      try {
        const resultText = await callFunction<string>("adminCreateUser", {
          ...form,
          email: form.email.trim(),
          display_name: form.display_name.trim(),
        });

        setResult({
          success: true,
          message:
            resultText || "User created successfully. They can now log in.",
        });

        // Reset form on success
        setForm({
          email: "",
          display_name: "",
          preferred_name: "",
          phone: "",
          photo_url: "",
          org_id: "",
          primary_county: "",
          primary_precinct: "",
          role: "",
        });
      } catch (err: any) {
        setResult({
          success: false,
          message: err.message || "Failed to create user",
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
        Create Individual User
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        This will provision a new user in Firebase Auth and create their initial
        profile.
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Email Address *"
            type="email"
            fullWidth
            required
            value={form.email}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Display Name *"
            fullWidth
            required
            value={form.display_name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, display_name: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Preferred Name"
            fullWidth
            value={form.preferred_name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, preferred_name: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Phone Number"
            fullWidth
            value={form.phone}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, phone: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label="Primary County"
            fullWidth
            value={form.primary_county}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, primary_county: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label="Primary Precinct"
            fullWidth
            value={form.primary_precinct}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, primary_precinct: e.target.value }))
            }
            disabled={isSubmitting}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label="Initial Role"
            fullWidth
            value={form.role}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, role: e.target.value }))
            }
            disabled={isSubmitting}
            placeholder="e.g. volunteer"
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
        {isSubmitting ? "Creating User..." : "Create User"}
      </Button>

      {result && (
        <Alert severity={result.success ? "success" : "error"} sx={{ mt: 3 }}>
          {result.message}
        </Alert>
      )}
    </Box>
  );
};
