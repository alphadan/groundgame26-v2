// src/app/admin/surveys/components/SurveyForm.tsx
import React, { useState, useEffect } from "react";
import { useCloudFunctions } from "../../../../hooks/useCloudFunctions";
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
  MenuItem,
} from "@mui/material";
import { Survey, AgeGroup, PartyAffiliation, Sex } from "../../../../types";

// Helper to safely cast string to union type (or undefined)
const toAgeGroup = (value: string): AgeGroup | undefined => {
  const valid = ["18-24", "25-40", "41-70", "71+"] as const;
  return valid.includes(value as any) ? (value as AgeGroup) : undefined;
};

const toParty = (value: string): PartyAffiliation | undefined => {
  const valid = ["Republican", "Democratic", "Independent"] as const;
  return valid.includes(value as any) ? (value as PartyAffiliation) : undefined;
};

const toSex = (value: string): Sex | undefined => {
  const valid = ["M", "F", "Other"] as const;
  return valid.includes(value as any) ? (value as Sex) : undefined;
};

interface SurveyFormProps {
  initialData?: Survey | null;
  onSuccess: () => void;
}

export const SurveyForm: React.FC<SurveyFormProps> = ({
  initialData,
  onSuccess,
}) => {
  const { callFunction } = useCloudFunctions();

  const isEdit = !!initialData;

  const [form, setForm] = useState<Partial<Survey>>({
    survey_id: "",
    name: "",
    description: "",
    embed_id: "",
    active: true,
    demographics: {
      age_group: undefined,
      area_id: undefined,
      party_affiliation: undefined,
      sex: undefined,
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Populate form if editing
  useEffect(() => {
    if (initialData) {
      setForm({
        survey_id: initialData.survey_id || "",
        name: initialData.name || "",
        description: initialData.description || "",
        embed_id: initialData.embed_id || "",
        active: initialData.active ?? true,
        demographics: {
          age_group: initialData.demographics?.age_group,
          area_id: initialData.demographics?.area_id,
          party_affiliation: initialData.demographics?.party_affiliation,
          sex: initialData.demographics?.sex,
        },
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.survey_id?.trim() ||
      !form.name?.trim() ||
      !form.embed_id?.trim()
    ) {
      setResult({
        success: false,
        message: "Survey ID, Name, and Embed ID are required",
      });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const payload = {
        survey_id: form.survey_id.trim(),
        name: form.name.trim(),
        description: form.description?.trim() || null,
        embed_id: form.embed_id.trim(),
        active: form.active ?? true,
        demographics: form.demographics || {},
        updated_at: new Date().toISOString(),
      };

      if (isEdit) {
        await callFunction("adminUpdateSurvey", {
          id: initialData!.id,
          updates: payload,
        });
        setResult({
          success: true,
          message: `Survey ${form.survey_id} updated successfully`,
        });
      } else {
        await callFunction("adminCreateSurvey", payload);
        setResult({
          success: true,
          message: `Survey ${form.survey_id} created successfully`,
        });
      }

      onSuccess();
    } catch (err: any) {
      setResult({ success: false, message: err.message || "Operation failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Survey ID *"
            fullWidth
            required
            value={form.survey_id || ""}
            onChange={(e) => setForm({ ...form, survey_id: e.target.value })}
            disabled={isSubmitting || isEdit}
            helperText="Unique identifier (e.g., '1', 'youth-2025')"
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Embed ID *"
            fullWidth
            required
            value={form.embed_id || ""}
            onChange={(e) => setForm({ ...form, embed_id: e.target.value })}
            disabled={isSubmitting}
            helperText="Google Forms embed ID (from form URL)"
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TextField
            label="Name *"
            fullWidth
            required
            value={form.name || ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={isSubmitting}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={form.description || ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            disabled={isSubmitting}
          />
        </Grid>

        {/* Demographics */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle2" gutterBottom>
            Target Demographics (Optional)
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Age Group"
                fullWidth
                select
                value={form.demographics?.age_group || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    demographics: {
                      ...form.demographics,
                      age_group: toAgeGroup(e.target.value), // ← Use safe cast
                    },
                  })
                }
                disabled={isSubmitting}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="18-24">18-24</MenuItem>
                <MenuItem value="25-34">25-34</MenuItem>
                <MenuItem value="35-44">35-44</MenuItem>
                <MenuItem value="45-54">45-54</MenuItem>
                <MenuItem value="55-64">55-64</MenuItem>
                <MenuItem value="65+">65+</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Area ID"
                fullWidth
                value={form.demographics?.area_id || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    demographics: {
                      ...form.demographics,
                      area_id: e.target.value || undefined,
                    },
                  })
                }
                disabled={isSubmitting}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Sex"
                fullWidth
                select
                value={form.demographics?.sex || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    demographics: {
                      ...form.demographics,
                      sex: toSex(e.target.value),
                    },
                  })
                }
                disabled={isSubmitting}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="M">M</MenuItem>
                <MenuItem value="F">F</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
                <MenuItem value="Prefer not to say">Prefer not to say</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Party Affiliation"
                fullWidth
                select
                value={form.demographics?.party_affiliation || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    demographics: {
                      ...form.demographics,
                      party_affiliation: toParty(e.target.value),
                    },
                  })
                }
                disabled={isSubmitting}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="Republican">Republican</MenuItem>
                <MenuItem value="Democratic">Democratic</MenuItem>
                <MenuItem value="Independent">Independent</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
                <MenuItem value="Nonpartisan">Nonpartisan</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <FormControlLabel
            control={
              <Switch
                checked={form.active ?? true}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                disabled={isSubmitting}
              />
            }
            label="Active (visible to users)"
          />
        </Grid>
      </Grid>

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        sx={{ mt: 4, py: 1.5 }}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <CircularProgress size={24} color="inherit" />
        ) : isEdit ? (
          "Save Changes"
        ) : (
          "Create Survey"
        )}
      </Button>

      {result && (
        <Alert severity={result.success ? "success" : "error"} sx={{ mt: 3 }}>
          {result.message}
        </Alert>
      )}
    </Box>
  );
};
