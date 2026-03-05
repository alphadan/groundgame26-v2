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
    },
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

  // PHASE 2 FEATURE: Pull from the BigQuery Bridge
  const handleFetchAIRecommendation = async () => {
    if (!form.precinct_id) return setError("Enter a Precinct ID first.");
    setIsFetchingAI(true);
    try {
      // This calls a separate function that reads your BigQuery 'precinct_field_plan_2026'
      const response = await callFunction("getAIRecommendation", {
        precinct_id: form.precinct_id,
      });

      if (response.data) {
        setForm((prev) => ({
          ...prev,
          targets: response.data.targets,
          ai_narratives: response.data.ai_narratives,
        }));
      }
    } catch (err: any) {
      setError(
        "Could not find AI data for this precinct. You may need to run the BigQuery Sync.",
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
      <Grid container spacing={2}>
        {(
          ["registrations", "mail_in", "volunteers", "user_activity"] as const
        ).map((key) => (
          <Grid item xs={6} key={key}>
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
          <TextField
            label="Strategic Summary"
            multiline
            rows={2}
            fullWidth
            value={form.ai_narratives.summary}
            onChange={(e) =>
              setForm({
                ...form,
                ai_narratives: {
                  ...form.ai_narratives,
                  summary: e.target.value,
                },
              })
            }
          />
          <TextField
            label="Positive Trends"
            multiline
            rows={2}
            fullWidth
            value={form.ai_narratives.positive}
            onChange={(e) =>
              setForm({
                ...form,
                ai_narratives: {
                  ...form.ai_narratives,
                  positive: e.target.value,
                },
              })
            }
          />
          <TextField
            label="Immediate Attention"
            multiline
            rows={2}
            fullWidth
            value={form.ai_narratives.immediate}
            onChange={(e) =>
              setForm({
                ...form,
                ai_narratives: {
                  ...form.ai_narratives,
                  immediate: e.target.value,
                },
              })
            }
          />
          <TextField
            label="Actionable Steps"
            multiline
            rows={2}
            fullWidth
            value={form.ai_narratives.actionable}
            onChange={(e) =>
              setForm({
                ...form,
                ai_narratives: {
                  ...form.ai_narratives,
                  actionable: e.target.value,
                },
              })
            }
          />
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
