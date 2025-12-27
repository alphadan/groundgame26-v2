// src/app/planning/PlanningPage.tsx
import React, { useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCloudFunctions } from "../../hooks/useCloudFunctions";
import { useQuery } from "@tanstack/react-query";
import { FilterSelector } from "../../components/FilterSelector";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { saveAs } from "file-saver";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Snackbar,
} from "@mui/material";

interface FilterValues {
  county: string;
  area: string;
  precinct: string;
  name?: string;
  street?: string;
  modeledParty?: string;
  turnout?: string;
  ageGroup?: string;
  mailBallot?: string;
}

export default function PlanningPage() {
  const { user, isLoaded } = useAuth();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Messages
  const [suggestedMessages, setSuggestedMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState("");

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // === Submit handler (loads messages immediately) ===
  const handleSubmit = useCallback(async (submittedFilters: FilterValues) => {
    setFilters(submittedFilters);
    setIsSubmitting(true);

    setLoadingMessages(true);
    setMessageError("");

    try {
      let q = query(
        collection(db, "message_templates"),
        where("active", "==", true)
      );

      if (submittedFilters.ageGroup) {
        q = query(q, where("age_group", "==", submittedFilters.ageGroup));
      }
      if (submittedFilters.modeledParty) {
        q = query(
          q,
          where("modeled_party", "==", submittedFilters.modeledParty)
        );
      }
      if (submittedFilters.turnout) {
        q = query(
          q,
          where("turnout_score_general", "==", submittedFilters.turnout)
        );
      }
      if (submittedFilters.mailBallot) {
        q = query(
          q,
          where("mail_ballot_status", "==", submittedFilters.mailBallot)
        );
      }

      const snapshot = await getDocs(q);
      const templates = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setSuggestedMessages(templates);

      if (templates.length === 0) {
        setMessageError("No messages match your selected audience.");
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
      setMessageError("Failed to load messages. Please try again.");
    } finally {
      setLoadingMessages(false);
      setIsSubmitting(false);
    }
  }, []);

  // === Copy to Clipboard ===
  const copyToClipboard = useCallback(async (text: string) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setSnackbarMessage("Message copied to clipboard!");
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

      {/* === Suggested Messages (Always Visible) === */}
      <Paper sx={{ p: 4, mt: 5, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">
          Suggested Messages
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
              <Grid size={{ xs: 12, md: 6 }} key={msg.id}>
                <Paper
                  sx={{
                    p: 3,
                    bgcolor: "#f5f5f5",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "#e0e0e0" },
                    borderLeft: "4px solid #B22234",
                  }}
                  onClick={() => copyToClipboard(msg.body || "")}
                >
                  <Typography
                    variant="subtitle1"
                    fontWeight="bold"
                    gutterBottom
                  >
                    {msg.title || "Untitled Message"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {msg.body?.substring(0, 200)}...
                  </Typography>
                  <Chip
                    label="Click to Copy"
                    size="small"
                    color="primary"
                    sx={{ mt: 2 }}
                  />
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      {/* === Mail Ballot Chase (Always Visible) === */}
      <Paper sx={{ p: 4, mt: 5, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">
          Mail Ballot Chase
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Voters who requested mail ballots but have not yet returned them
        </Typography>

        {/* Placeholder stats until real function */}
        <Grid container spacing={4} justifyContent="center">
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 4, textAlign: "center", bgcolor: "#ffebee" }}>
              <Typography variant="h3" color="error">
                1,240
              </Typography>
              <Typography variant="h6">Outstanding</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 4, textAlign: "center", bgcolor: "#e8f5e8" }}>
              <Typography variant="h3" color="success">
                68%
              </Typography>
              <Typography variant="h6">Return Rate</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12 }}>
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
