// src/app/admin/goals/CreateGoals.tsx
import React, { useState, useEffect } from "react";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import { Goal, GoalTargets } from "../../../types";
import {
  Box,
  TextField,
  Button,
  Grid,
  Stack,
  CircularProgress,
  Alert,
} from "@mui/material";

interface CreateGoalsProps {
  initialData?: Goal;
  onSuccess: () => void;
}

export default function CreateGoals({
  initialData,
  onSuccess,
}: CreateGoalsProps) {
  const { callFunction } = useCloudFunctions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    precinct_id: "",
    targets: {
      registrations: 0,
      mail_in: 0,
      volunteers: 0,
      user_activity: 0,
    } as GoalTargets,
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        precinct_id: initialData.precinct_id,
        targets: { ...initialData.targets },
      });
    }
  }, [initialData]);

  const handleSubmit = async () => {
    if (!form.precinct_id) return setError("Precinct ID is required.");
    setIsSubmitting(true);
    try {
      // Use standard Cloud Function for strict server-side timestamping
      await callFunction("adminSetGoal", {
        precinct_id: form.precinct_id,
        targets: form.targets,
        cycle: "2026_GENERAL",
        county_id: "PA-C-15",
        area_id: "PA14-A-15",
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to save goals.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack spacing={3} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label="Precinct ID"
        fullWidth
        disabled={!!initialData}
        value={form.precinct_id}
        onChange={(e) => setForm({ ...form, precinct_id: e.target.value })}
      />
      <Grid container spacing={2}>
        {(
          ["registrations", "mail_in", "volunteers", "user_activity"] as const
        ).map((key) => (
          <Grid size={{ xs: 6 }} key={key}>
            <TextField
              label={key.replace("_", " ").toUpperCase()}
              type="number"
              fullWidth
              value={form.targets[key]}
              onChange={(e) =>
                setForm({
                  ...form,
                  targets: {
                    ...form.targets,
                    [key]: parseInt(e.target.value) || 0,
                  },
                })
              }
            />
          </Grid>
        ))}
      </Grid>
      <Button
        variant="contained"
        size="large"
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <CircularProgress size={24} />
        ) : initialData ? (
          "Update Goal"
        ) : (
          "Save Goal"
        )}
      </Button>
    </Stack>
  );
}
