// src/app/analysis/AnalysisPage.tsx
import React, { useState, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCloudFunctions } from "../../hooks/useCloudFunctions";
import { useQuery } from "@tanstack/react-query";
import { saveAs } from "file-saver";
import { FilterSelector } from "../../components/FilterSelector";
import {
  Box,
  Typography,
  Paper,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  TablePagination,
  Button,
  Snackbar,
  Grid,
  LinearProgress,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";

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

// Dummy data until real Cloud Function is ready
const dummyAnalysisData = [
  { group: "Hard R", count: 85000 },
  { group: "Weak R", count: 62000 },
  { group: "Swing", count: 78000 },
  { group: "Weak D", count: 71000 },
  { group: "Hard D", count: 102000 },
];

const useAnalysis = (filters: FilterValues | null) => {
  const { callFunction } = useCloudFunctions();

  return useQuery({
    queryKey: ["analysis", filters],
    queryFn: async () => {
      if (!filters) return [];

      // TODO: Replace with real Cloud Function when ready
      // const result = await callFunction("analyzeVoters", { filters });
      // return result.data;

      // For now, return dummy aggregated data
      return dummyAnalysisData;
    },
    enabled: !!filters,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

export default function AnalysisPage() {
  const { isLoaded } = useAuth();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // === Analysis data (aggregated) ===
  const { data: analysisData = [], isLoading, error } = useAnalysis(filters);

  // === Submit handler ===
  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    setFilters(submittedFilters);
    setPage(0);
  }, []);

  // === CSV Export ===
  const exportList = useCallback(() => {
    if (analysisData.length === 0) return;

    const headers = ["Group", "Voter Count"];
    const rows = analysisData.map((item: any) => [item.group, item.count]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(
      blob,
      `Target_Analysis_${new Date().toISOString().slice(0, 10)}.csv`
    );
  }, [analysisData]);

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
        Analysis — Voter Targeting Engine
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Create filtered reports to identify high-priority voter segments for
        outreach.
      </Typography>

      {/* === Filter Selector === */}
      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isLoading}
        unrestrictedFilters={[
          "modeledParty",
          "ageGroup",
          "mailBallot",
          "turnout",
        ]}
      />

      {/* === Error / Empty States === */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Analysis failed. Please try again.
        </Alert>
      )}

      {filters && !isLoading && analysisData.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No data available for current filters.
        </Alert>
      )}

      {/* === Bar Chart Report === */}
      {filters && analysisData.length > 0 && (
        <Paper sx={{ borderRadius: 2, mb: 4 }}>
          <Box
            p={3}
            sx={{ bgcolor: "#f8f9fa", borderBottom: 1, borderColor: "divider" }}
          >
            <Typography variant="h6" fontWeight="bold">
              Targeted Voter Breakdown (
              {analysisData
                .reduce((sum: number, item: any) => sum + item.count, 0)
                .toLocaleString()}{" "}
              voters)
            </Typography>
            <Box sx={{ mt: 2, textAlign: "right" }}>
              <Button
                variant="contained"
                onClick={exportList}
                sx={{ bgcolor: "#B22234" }}
              >
                Export CSV
              </Button>
            </Box>
          </Box>

          {isLoading && <LinearProgress />}

          <Box p={4}>
            <BarChart
              dataset={analysisData}
              xAxis={[{ scaleType: "band", dataKey: "group" }]}
              series={[{ dataKey: "count", label: "Voters" }]}
              height={400}
              barLabel="value"
              colors={["#B22234", "#FF6347", "#9370DB", "#6495ED", "#1E90FF"]}
            />
          </Box>
        </Paper>
      )}

      {/* === Popular Reports (Quick Buttons) === */}
      <Paper sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Popular Targeting Reports
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Button
              variant="outlined"
              onClick={() =>
                handleSubmit({
                  county: "",
                  area: "",
                  precinct: "",
                  modeledParty: "1 - Hard Republican,2 - Weak Republican",
                  mailBallot: "false",
                })
              }
            >
              Republicans Without Mail Ballots
            </Button>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Button
              variant="outlined"
              onClick={() =>
                handleSubmit({
                  county: "",
                  area: "",
                  precinct: "",
                  modeledParty: "3 - Swing",
                  turnout: "high",
                })
              }
            >
              High-Turnout Swing Voters
            </Button>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Button
              variant="outlined"
              onClick={() =>
                handleSubmit({
                  county: "",
                  area: "",
                  precinct: "",
                  ageGroup: "18-29",
                  turnout: "low",
                })
              }
            >
              Young Low-Turnout Voters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* === Snackbar === */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="info">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
