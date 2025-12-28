// src/app/planning/PlanningPage.tsx
import React, { useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";
import { FilterSelector } from "../../components/FilterSelector";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Snackbar,
  IconButton,
  Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { saveAs } from "file-saver";

// Import shared types
import { FilterValues, MessageTemplate } from "../../types";

export default function PlanningPage() {
  const { user, isLoaded } = useAuth();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Messages
  const [suggestedMessages, setSuggestedMessages] = useState<MessageTemplate[]>(
    []
  );
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState("");

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // === Cloud Function: getMessageIdeas ===
  const getMessageIdeas = httpsCallable<
    {
      ageGroup?: string;
      modeledParty?: string;
      turnout?: string;
      mailBallot?: string;
    },
    { templates: MessageTemplate[] }
  >(functions, "getMessageIdeas");

  // === Submit handler ===
  const handleSubmit = useCallback(
    async (submittedFilters: FilterValues) => {
      setFilters(submittedFilters);
      setIsSubmitting(true);
      setLoadingMessages(true);
      setMessageError("");

      try {
        const result = await getMessageIdeas({
          ageGroup: submittedFilters.ageGroup || undefined,
          modeledParty: submittedFilters.modeledParty || undefined,
          turnout: submittedFilters.turnout || undefined,
          mailBallot: submittedFilters.mailBallot || undefined,
        });

        const templates = result.data?.templates || [];

        setSuggestedMessages(templates);

        if (templates.length === 0) {
          setMessageError("No messages match your selected audience.");
        }
      } catch (err: any) {
        console.error("Failed to load messages:", err);
        setMessageError(
          err?.message || "Failed to load messages. Please try again."
        );
      } finally {
        setLoadingMessages(false);
        setIsSubmitting(false);
      }
    },
    [getMessageIdeas]
  );

  // === Copy to Clipboard ===
  const copyToClipboard = useCallback(async (text: string, title: string) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setSnackbarMessage(`"${title}" copied to clipboard!`);
      setSnackbarOpen(true);
    } catch {
      setSnackbarMessage("Copy failed — please select and copy manually");
      setSnackbarOpen(true);
    }
  }, []);

  // === Export Chase List (Placeholder) ===
  const exportOutstanding = useCallback(() => {
    const csv = [
      ["Name", "Address", "Phone", "Precinct"],
      ["John Doe", "123 Main St", "555-0123", "001"],
      ["Jane Smith", "456 Oak Ave", "555-0456", "002"],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(
      blob,
      `Mail_Ballot_Chase_${new Date().toISOString().slice(0, 10)}.csv`
    );
  }, []);

  if (!isLoaded) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="70vh"
      >
        <CircularProgress sx={{ color: "#B22234" }} />
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Planning — Target & Message
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Define your audience and get personalized message templates for
        outreach.
      </Typography>

      {/* === Filter Selector === */}
      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
        unrestrictedFilters={[
          "modeledParty",
          "ageGroup",
          "mailBallot",
          "turnout",
        ]}
      />

      {/* === Suggested Messages === */}
      <Paper sx={{ p: 4, mt: 5, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">
          Suggested Messages ({suggestedMessages.length})
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Personalized templates based on your target audience
        </Typography>

        {loadingMessages ? (
          <Box textAlign="center" py={6}>
            <CircularProgress />
            <Typography variant="body2" mt={2}>
              Loading messages...
            </Typography>
          </Box>
        ) : messageError ? (
          <Alert severity="warning">{messageError}</Alert>
        ) : suggestedMessages.length === 0 ? (
          <Alert severity="info">
            Submit filters above to see suggested messages.
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {suggestedMessages.map((msg) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={msg.id}>
                <Card
                  variant="outlined"
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    transition: "0.2s",
                    "&:hover": { boxShadow: 6 },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      {msg.title || "Untitled Message"}
                    </Typography>

                    {msg.tags && msg.tags.length > 0 && (
                      <Box mb={2}>
                        {msg.tags.map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    )}

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      paragraph
                    >
                      {msg.body}
                    </Typography>
                  </CardContent>

                  <CardActions sx={{ justifyContent: "space-between", pt: 0 }}>
                    <Button
                      size="small"
                      startIcon={<ContentCopyIcon />}
                      onClick={() =>
                        copyToClipboard(msg.body, msg.title || "Message")
                      }
                      color="primary"
                    >
                      Copy Message
                    </Button>

                    <Tooltip title="Click card to copy full message">
                      <IconButton
                        size="small"
                        onClick={() =>
                          copyToClipboard(msg.body, msg.title || "Message")
                        }
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* === Mail Ballot Chase Section === */}
      <Paper sx={{ p: 4, mt: 5, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">
          Mail Ballot Chase
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Voters who requested mail ballots but have not yet returned them
        </Typography>

        <Grid container spacing={4} justifyContent="center">
          <Grid size={{ xs: 12, sm: 4 }}>
            <Paper sx={{ p: 4, textAlign: "center", bgcolor: "#ffebee" }}>
              <Typography variant="h3" color="error">
                1,240
              </Typography>
              <Typography variant="h6">Outstanding</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Paper sx={{ p: 4, textAlign: "center", bgcolor: "#e8f5e8" }}>
              <Typography variant="h3" color="success">
                68%
              </Typography>
              <Typography variant="h6">Return Rate</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Paper sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="h3">3,880</Typography>
              <Typography variant="h6">Requested</Typography>
            </Paper>
          </Grid>
        </Grid>

        <Box textAlign="center" mt={4}>
          <Button
            variant="contained"
            size="large"
            onClick={exportOutstanding}
            sx={{ bgcolor: "#B22234" }}
          >
            Export Chase List (CSV)
          </Button>
        </Box>
      </Paper>

      {/* === Snackbar === */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="success">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
