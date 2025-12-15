// src/app/reports/ReportsPage.tsx
import React from "react";
import { useAuth } from "../../context/AuthContext";
import { Box, Typography, Paper, Alert, CircularProgress } from "@mui/material";

export default function ReportsPage() {
  const { user, claims } = useAuth();

  if (!user || !claims) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="70vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  const role = claims.role || "unknown";

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Reports & Analytics
      </Typography>

      <Paper sx={{ p: 4, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Hello, {user.email}
        </Typography>
        <Typography variant="body1">
          <strong>Current Role:</strong> {role.replace("_", " ").toUpperCase()}
        </Typography>
      </Paper>

      <Alert severity="info">
        Clean placeholder — no data loading yet. Ready for stable development.
      </Alert>

      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="body1" color="text.secondary">
          Coming soon: Voter turnout charts, mail ballot stats, modeled
          strength, and more.
        </Typography>
      </Paper>
    </Box>
  );
}
