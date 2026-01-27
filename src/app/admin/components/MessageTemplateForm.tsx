// src/app/admin/components/MessageTemplateForm.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import { MessageCategory } from "../../../types";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Grid,
  Stack,
  MenuItem,
  Chip,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import {
  CloudUpload as UploadIcon,
  Save as SaveIcon,
} from "@mui/icons-material";

// --- Types & Interfaces ---
interface MessageTemplateFormProps {
  initialData?: any; // The message object passed when editing
  onSuccess: () => void; // Callback to refresh the list and close form
}

// --- Utilities ---
const generateSlug = (category: string, subject: string): string => {
  const base = `${category}-${subject}`.toLowerCase();
  return base.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
};

const getWordCount = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;
const SPAM_WORDS = [
  "free",
  "urgent",
  "act now",
  "winner",
  "cash",
  "guaranteed",
];

export const MessageTemplateForm: React.FC<MessageTemplateFormProps> = ({
  initialData,
  onSuccess,
}) => {
  const { callFunction } = useCloudFunctions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Initial Form State
  const defaultState = {
    subject_line: "",
    body: "",
    category: "" as MessageCategory | "",
    party: "all",
    age_group: "all",
    gender: "all",
    turnout_score_general: "all",
    has_mail_ballot: "all",
    tags: "",
    active: true,
  };

  const [form, setForm] = useState(defaultState);

  // --- Effect: Sync Form with initialData (Crucial for Edit Mode) ---
  useEffect(() => {
    if (initialData) {
      setForm({
        subject_line: initialData.subject_line || "",
        body: initialData.body || "",
        category: initialData.category || "",
        party: initialData.party || "all",
        age_group: initialData.age_group || "all",
        gender: "all",
        turnout_score_general: initialData.turnout_score_general || "all",
        has_mail_ballot: initialData.has_mail_ballot || "all",
        tags: Array.isArray(initialData.tags)
          ? initialData.tags.join(", ")
          : initialData.tags || "",
        active: initialData.active ?? true,
      });
    } else {
      setForm(defaultState);
    }
  }, [initialData]);

  // --- Derived Analytics ---
  const wordCount = useMemo(() => getWordCount(form.body), [form.body]);
  const spamRisk = useMemo(() => {
    const lowerBody = form.body.toLowerCase();
    return SPAM_WORDS.filter((word) => lowerBody.includes(word));
  }, [form.body]);

  const wordCountColor =
    wordCount > 125
      ? "error.main"
      : wordCount > 100
        ? "warning.main"
        : "success.main";

  // --- Submission Handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      // Use existing ID if editing, otherwise generate a new one
      const slugId =
        initialData?.id || generateSlug(form.category, form.subject_line);

      const payload = {
        ...form,
        id: slugId,
        party: form.party === "all" ? null : form.party,
        age_group: form.age_group === "all" ? null : form.age_group,
        turnout_score_general:
          form.turnout_score_general === "all"
            ? null
            : form.turnout_score_general,
        has_mail_ballot:
          form.has_mail_ballot === "all" ? null : form.has_mail_ballot,
        // Convert tags string back to array for Firestore
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t !== ""),
      };

      await callFunction("adminCreateMessageTemplate", payload);

      setResult({
        success: true,
        message: initialData
          ? `Updated template: ${slugId}`
          : `Published new template: ${slugId}`,
      });

      // Give the user a moment to see the success message before closing
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || "Submission failed",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            select
            label="Category *"
            fullWidth
            required
            value={form.category}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                category: e.target.value as MessageCategory,
              }))
            }
          >
            {[
              "Affordability",
              "Crime & Drugs",
              "Energy & Utilities",
              "Healthcare",
              "Housing",
              "Local",
            ].map((cat) => (
              <MenuItem key={cat} value={cat}>
                {cat}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Subject Line *"
            fullWidth
            required
            inputProps={{ maxLength: 60 }}
            helperText={`${form.subject_line.length}/60 characters`}
            value={form.subject_line}
            onChange={(e) =>
              setForm((p) => ({ ...p, subject_line: e.target.value }))
            }
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TextField
            label="Script Content *"
            fullWidth
            multiline
            rows={6}
            required
            value={form.body}
            onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
          />
          <Stack direction="row" justifyContent="space-between" mt={1}>
            <Typography
              variant="caption"
              sx={{ color: wordCountColor, fontWeight: "bold" }}
            >
              Word Count: {wordCount} (Target: 50-125)
            </Typography>
            {spamRisk.length > 0 && (
              <Tooltip title={`Avoid keywords: ${spamRisk.join(", ")}`}>
                <Chip label="Spam Warning" size="small" color="warning" />
              </Tooltip>
            )}
          </Stack>
        </Grid>

        {/* Targeting Options */}
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            select
            label="Voter Party"
            fullWidth
            value={form.party}
            onChange={(e) => setForm((p) => ({ ...p, party: e.target.value }))}
          >
            <MenuItem value="all">Any Party</MenuItem>
            <MenuItem value="Republican">Republican</MenuItem>
            <MenuItem value="Democrat">Democrat</MenuItem>
            <MenuItem value="Independent">Independent</MenuItem>
          </TextField>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            select
            label="Age Group"
            fullWidth
            value={form.age_group}
            onChange={(e) =>
              setForm((p) => ({ ...p, age_group: e.target.value }))
            }
          >
            <MenuItem value="all">Any Age</MenuItem>
            <MenuItem value="18-25">18-25</MenuItem>
            <MenuItem value="26-40">26-40</MenuItem>
            <MenuItem value="41-70">41-70</MenuItem>
            <MenuItem value="71+">71+</MenuItem>
          </TextField>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            select
            label="Turnout"
            fullWidth
            value={form.turnout_score_general}
            onChange={(e) =>
              setForm((p) => ({ ...p, turnout_score_general: e.target.value }))
            }
          >
            <MenuItem value="all">Any Score</MenuItem>
            <MenuItem value="4 - Very High">4 - Very High</MenuItem>
            <MenuItem value="3 - Frequent">3 - Frequent</MenuItem>
            <MenuItem value="2 - Moderate">2 - Moderate</MenuItem>
            <MenuItem value="1 - Low">1 - Low</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            select
            label="Gender"
            fullWidth
            value={form.gender || "all"}
            onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
          >
            <MenuItem value="all">Any Gender</MenuItem>
            <MenuItem value="M">Male</MenuItem>
            <MenuItem value="F">Female</MenuItem>
          </TextField>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TextField
            label="Search Tags"
            fullWidth
            placeholder="economy, 2026, mailbox"
            value={form.tags}
            onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
            helperText="Separate tags with commas"
          />
        </Grid>
      </Grid>

      <Button
        type="submit"
        variant="contained"
        size="large"
        fullWidth
        disabled={isSubmitting}
        startIcon={
          isSubmitting ? (
            <CircularProgress size={20} color="inherit" />
          ) : initialData ? (
            <SaveIcon />
          ) : (
            <UploadIcon />
          )
        }
        sx={{ mt: 4, py: 1.5, fontWeight: "bold" }}
      >
        {initialData ? "Update Template" : "Publish Template"}
      </Button>

      {result && (
        <Alert severity={result.success ? "success" : "error"} sx={{ mt: 3 }}>
          {result.message}
        </Alert>
      )}
    </Box>
  );
};
