import React, { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Snackbar,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  Stack,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChatIcon from "@mui/icons-material/Chat";
import FolderIcon from "@mui/icons-material/Folder";
import LinkIcon from "@mui/icons-material/Link";

import { useAuth } from "../../context/AuthContext";
import { MessagesManager } from "./components/MessagesManager";
import { DownloadCenter } from "./components/DownloadCenter";
import { UsefulLinks } from "./components/UsefulLinks";

export default function ResourcesPage() {
  const { isLoaded } = useAuth();
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
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
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
        Campaign Hub
      </Typography>

      {/* 1. Tab Navigation */}
      <Paper sx={{ borderRadius: 3, mb: 4 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab icon={<ChatIcon />} label="Scripts & Messaging" />
          <Tab icon={<FolderIcon />} label="Field Materials" />
        </Tabs>

        <Box sx={{ p: { xs: 1, sm: 3 } }}>
          {tabValue === 0 && <MessagesManager onNotify={handleNotify} />}
          {tabValue === 1 && <DownloadCenter onNotify={handleNotify} />}
        </Box>
      </Paper>

      {/* 2. Collapsible Useful Links (Mobile optimized) */}
      <Accordion
        sx={{
          borderRadius: 3,
          "&:before": { display: "none" },
          overflow: "hidden",
          border: 1,
          borderColor: "divider",
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" spacing={1} alignItems="center">
            <LinkIcon color="action" />
            <Typography fontWeight="bold">
              External Quick Links & Contacts
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          <UsefulLinks />
        </AccordionDetails>
      </Accordion>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSnackbarOpen(false)}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
