// src/app/admin/components/MessageTemplateForm.tsx
import React, { useState, useMemo } from "react";
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
import { CloudUpload as UploadIcon } from "@mui/icons-material";

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

export const MessageTemplateForm: React.FC = () => {
  const { callFunction } = useCloudFunctions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [form, setForm] = useState({
    subject_line: "",
    body: "",
    category: "" as MessageCategory | "",
    party: "all",
    age_group: "all",
    turnout_score_general: "all",
    has_mail_ballot: "all",
    tags: "",
    active: true,
  });

  // Derived Analytics
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const slugId = generateSlug(form.category, form.subject_line);
      await callFunction("adminCreateMessageTemplate", {
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
      });

      setResult({
        success: true,
        message: `Successfully published script: ${slugId}`,
      });
      setForm({
        subject_line: "",
        body: "",
        category: "",
        party: "all",
        age_group: "all",
        turnout_score_general: "all",
        has_mail_ballot: "all",
        tags: "",
        active: true,
      });
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
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Create Outreach Script
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Scripts are automatically optimized for mobile delivery standards.
      </Typography>

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
            placeholder="Links like https://groundgame26.com are supported."
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
              <Tooltip title={`Avoid: ${spamRisk.join(", ")}`}>
                <Chip label="Spam Warning" size="small" color="warning" />
              </Tooltip>
            )}
          </Stack>
        </Grid>

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
          ) : (
            <UploadIcon />
          )
        }
        sx={{ mt: 4, py: 1.5, fontWeight: "bold" }}
      >
        Publish Template
      </Button>

      {result && (
        <Alert severity={result.success ? "success" : "error"} sx={{ mt: 3 }}>
          {result.message}
        </Alert>
      )}
    </Box>
  );
};
