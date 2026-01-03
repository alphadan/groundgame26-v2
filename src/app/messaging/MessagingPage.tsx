// src/app/messaging/MessagingPage.tsx
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
  Stack,
  Divider,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { ContentCopy as ContentCopyIcon } from "@mui/icons-material";

import { FilterValues, MessageTemplate } from "../../types";

export default function MessagingPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { user, isLoaded } = useAuth();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [suggestedMessages, setSuggestedMessages] = useState<MessageTemplate[]>(
    []
  );
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState("");

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // Cloud Function
  const getMessageIdeas = httpsCallable<
    {
      ageGroup?: string;
      modeledParty?: string;
      turnout?: string;
      mailBallot?: string;
    },
    { templates: MessageTemplate[] }
  >(functions, "getMessageIdeas");

  const handleSubmit = useCallback(
    async (submittedFilters: FilterValues) => {
      setFilters(submittedFilters);
      setIsSubmitting(true);
      setLoadingMessages(true);
      setMessageError("");
      setSuggestedMessages([]);

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
          setMessageError("No message templates found for this audience.");
        }
      } catch (err: any) {
        console.error("Failed to load messages:", err);
        setMessageError(
          err?.message || "Failed to generate messages. Please try again."
        );
      } finally {
        setLoadingMessages(false);
        setIsSubmitting(false);
      }
    },
    [getMessageIdeas]
  );

  const copyToClipboard = useCallback(async (text: string, title: string) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setSnackbarMessage(`"${title}" copied to clipboard!`);
      setSnackbarOpen(true);
    } catch {
      setSnackbarMessage("Copy failed — please select and copy manually.");
      setSnackbarOpen(true);
    }
  }, []);

  if (!isLoaded) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "70vh",
        }}
      >
        <CircularProgress color="primary" size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Header */}
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        Target & Message
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Select your audience and get AI-generated, personalized outreach
        messages.
      </Typography>

      {/* Filter Selector */}
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

      {/* Results Section */}
      <Paper sx={{ mt: 5, p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Suggested Messages
          {suggestedMessages.length > 0 && (
            <Typography
              component="span"
              variant="h6"
              color="text.secondary"
              sx={{ ml: 1 }}
            >
              ({suggestedMessages.length})
            </Typography>
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={4}>
          AI-crafted templates tailored to your selected audience
        </Typography>

        {loadingMessages ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <CircularProgress size={60} />
            <Typography variant="body1" mt={3} color="text.secondary">
              Generating personalized messages...
            </Typography>
          </Box>
        ) : messageError ? (
          <Alert severity="warning" sx={{ mb: 3 }}>
            {messageError}
          </Alert>
        ) : suggestedMessages.length === 0 ? (
          <Alert severity="info">
            Apply filters above to generate targeted message templates.
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {suggestedMessages.map((msg) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={msg.id}>
                <Card
                  elevation={3}
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 3,
                    transition: "transform 0.2s, box-shadow 0.2s",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: 8,
                    },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                    <Typography variant="h6" gutterBottom fontWeight="bold">
                      {msg.subject_line || "Untitled Message"}
                    </Typography>

                    {msg.tags && msg.tags.length > 0 && (
                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        sx={{ mb: 2 }}
                      >
                        {msg.tags.map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    )}

                    <Typography
                      variant="body2"
                      color="text.primary"
                      sx={{
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.6,
                      }}
                    >
                      {msg.body}
                    </Typography>
                  </CardContent>

                  <Divider />

                  <CardActions sx={{ justifyContent: "space-between", pt: 2 }}>
                    <Button
                      startIcon={<ContentCopyIcon />}
                      onClick={() =>
                        copyToClipboard(msg.body, msg.subject_line || "Message")
                      }
                      size="medium"
                      color="primary"
                      sx={{ fontWeight: "bold" }}
                    >
                      Copy Message
                    </Button>

                    <Tooltip title="Copy full message">
                      <IconButton
                        onClick={() =>
                          copyToClipboard(msg.body, msg.subject_line || "Message")
                        }
                        color="primary"
                      >
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          variant="filled"
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
