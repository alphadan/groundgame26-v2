// src/app/resources/ResourcesPage.tsx
import React, { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useAuth } from "../../context/AuthContext";

// Modular Component Imports
import { MessagesManager } from "./components/MessagesManager";
import { DownloadCenter } from "./components/DownloadCenter";
import { UsefulLinks } from "./components/UsefulLinks";

// Types
import { UsefulLink, CampaignResource } from "../../types";

// Static Data (Could also be moved to a constants file)
const USEFUL_LINKS: UsefulLink[] = [
  /* ... your data ... */
];
const SAMPLE_RESOURCES: CampaignResource[] = [
  /* ... your data ... */
];

export default function ResourcesPage() {
  const { isLoaded } = useAuth();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const handleNotify = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

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
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        Campaign Resources
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom mb={6}>
        Your hub for outreach messaging, campaign materials, and key contacts.
      </Typography>

      {/* 1. Outreach Messages Section */}
      <Box sx={{ mb: 6 }}>
        <MessagesManager onNotify={handleNotify} />
      </Box>

      {/* 2. Download Center Section */}
      <Box sx={{ mb: 6 }}>
        <DownloadCenter resources={SAMPLE_RESOURCES} onNotify={handleNotify} />
      </Box>

      {/* 3. Useful Links Section */}
      <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        <UsefulLinks links={USEFUL_LINKS} />
      </Paper>

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
