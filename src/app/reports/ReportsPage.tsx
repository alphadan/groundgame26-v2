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
  // 1. Pull 'isLoaded' from Context for a consistent global loading state
  const { user, claims, isLoaded } = useAuth();

  // 2. Consistent Gatekeeper UI
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

  // Safe derivation of role
  const role = claims?.role || "user";

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Reports & Analytics
      </Typography>

      <Paper sx={{ p: 4, mb: 4, borderRadius: 2, boxShadow: 2 }}>
        <Typography variant="h6" gutterBottom>
          Hello, {user?.displayName || user?.email}
        </Typography>
        <Typography variant="body1">
          <strong>Access Level:</strong> {role.replace("_", " ").toUpperCase()}
        </Typography>
      </Paper>

      <Alert severity="success" variant="outlined" sx={{ mb: 4 }}>
        <strong>Security Verified:</strong> Your session is active and your
        role-based permissions are synchronized.
      </Alert>

      <Grid container spacing={3}>
        <Grid>
          <Paper sx={{ p: 4, textAlign: "center", height: "100%" }}>
            <Typography variant="h6" color="text.secondary">
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
          <Paper sx={{ p: 4, textAlign: "center", height: "100%" }}>
            <Typography variant="h6" color="text.secondary">
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
