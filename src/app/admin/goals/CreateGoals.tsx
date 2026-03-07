import React, { useState, useEffect } from "react";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import { Goal, GoalTargets, AINarratives } from "../../../types";
import {
  Box,
  TextField,
  Button,
  Grid,
  Stack,
  CircularProgress,
  Alert,
  Typography,
  Divider,
  Paper,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";

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
  const [isFetchingAI, setIsFetchingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    precinct_id: "",
    precinct_name: "",
    targets: {
      registrations: 0,
      mail_in: 0,
      volunteers: 0,
      user_activity: 0,
    } as GoalTargets,
    ai_narratives: {
      summary: "",
      positive: "",
      immediate: "",
      actionable: "",
    } as AINarratives,
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        precinct_id: initialData.precinct_id,
        precinct_name: initialData.precinct_name || "",
        targets: { ...initialData.targets },
        ai_narratives: initialData.ai_narratives || {
          summary: "",
          positive: "",
          immediate: "",
          actionable: "",
        },
      });
    }
  }, [initialData]);

  const handleFetchAIRecommendation = async () => {
    if (!form.precinct_id) return setError("Enter a Precinct ID first.");
    setIsFetchingAI(true);
    setError(null);

    try {
      // FIX: Cast the response to the Goal type to solve TS18046 'unknown' error
      const response = (await callFunction("getAIRecommendation", {
        precinct_id: form.precinct_id,
      })) as { data: Goal };

      if (response.data) {
        setForm((prev) => ({
          ...prev,
          // Safely map the returned BQ data into the form state
          targets: response.data.targets || prev.targets,
          ai_narratives: response.data.ai_narratives || prev.ai_narratives,
        }));
      }
    } catch (err: any) {
      setError(
        "Could not find AI data for this precinct. Ensure the BigQuery Sync has run.",
      );
    } finally {
      setIsFetchingAI(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.precinct_id) return setError("Precinct ID is required.");
    setIsSubmitting(true);
    try {
      await callFunction("adminSetGoal", {
        ...form,
        cycle: "2026_GENERAL",
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
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={2} alignItems="center">
        <TextField
          label="Precinct ID"
          sx={{ flexGrow: 1 }}
          disabled={!!initialData}
          value={form.precinct_id}
          onChange={(e) => setForm({ ...form, precinct_id: e.target.value })}
        />
        {!initialData && (
          <Button
            variant="outlined"
            startIcon={
              isFetchingAI ? (
                <CircularProgress size={20} />
              ) : (
                <AutoFixHighIcon />
              )
            }
            onClick={handleFetchAIRecommendation}
            disabled={isFetchingAI}
          >
            Load AI
          </Button>
        )}
      </Stack>

      <TextField
        label="Precinct Name"
        fullWidth
        value={form.precinct_name}
        onChange={(e) => setForm({ ...form, precinct_name: e.target.value })}
      />

      <Typography variant="subtitle2" color="primary" fontWeight="bold">
        Numerical Targets
      </Typography>

      {/* FIX: Use MUI v6 size prop system to solve TS2769 Grid errors */}
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

      <Divider />

      <Typography variant="subtitle2" color="primary" fontWeight="bold">
        AI Strategy Briefing
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: "#fcfcfc" }}>
        <Stack spacing={2}>
          {(["summary", "positive", "immediate", "actionable"] as const).map(
            (field) => (
              <TextField
                key={field}
                label={field.charAt(0).toUpperCase() + field.slice(1)}
                multiline
                rows={2}
                fullWidth
                value={form.ai_narratives[field]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    ai_narratives: {
                      ...form.ai_narratives,
                      [field]: e.target.value,
                    },
                  })
                }
              />
            ),
          )}
        </Stack>
      </Paper>

      <Button
        variant="contained"
        size="large"
        onClick={handleSubmit}
        disabled={isSubmitting}
        fullWidth
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
