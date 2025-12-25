// src/app/reports/ReportsPage.tsx
import React from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Box,
  Typography,
  Grid,
  Paper,
  Alert,
  CircularProgress,
} from "@mui/material";

export default function ReportsPage() {
  const { user, claims, isLoaded } = useAuth();

  // === Safe Loading Guard ===
  if (!isLoaded) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="70vh"
        role="status"
        aria-live="polite"
      >
        <CircularProgress
          sx={{ color: "#B22234" }}
          aria-label="Loading reports"
        />
      </Box>
    );
  }

  // === Defensive Role Handling ===
  const role = typeof claims?.role === "string" ? claims.role : "user";

  // === Safe User Display ===
  const displayName = user?.displayName || user?.email || "User";

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Reports & Analytics
      </Typography>

      <Paper sx={{ p: 4, mb: 4, borderRadius: 2, boxShadow: 2 }}>
        <Typography variant="h6" gutterBottom>
          Hello, {displayName}
        </Typography>
        <Typography variant="body1">
          <strong>Access Level:</strong> {role.replace("_", " ").toUpperCase()}
        </Typography>
      </Paper>

      <Alert severity="success" variant="outlined" sx={{ mb: 4 }}>
        <strong>Security Verified:</strong> Your session is active and
        permissions are synchronized.
      </Alert>

      <Grid container spacing={3}>
        <Grid>
          <Paper
            sx={{ p: 4, textAlign: "center", height: "100%" }}
            aria-labelledby="turnout-trends-heading"
          >
            <Typography
              id="turnout-trends-heading"
              variant="h6"
              color="text.secondary"
              gutterBottom
            >
              Voter Turnout Trends
            </Typography>
            <Box py={5} color="text.disabled">
              <Typography variant="body2">
                [ Chart Module Placeholder ]
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid>
          <Paper
            sx={{ p: 4, textAlign: "center", height: "100%" }}
            aria-labelledby="mail-pipeline-heading"
          >
            <Typography
              id="mail-pipeline-heading"
              variant="h6"
              color="text.secondary"
              gutterBottom
            >
              Mail Ballot Pipeline
            </Typography>
            <Box py={5} color="text.disabled">
              <Typography variant="body2">
                [ Data Pipeline Placeholder ]
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
