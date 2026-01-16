import React, { useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { db as indexedDb } from "../../lib/db";
import { FilterValues, Goal, PrecinctMonthlyStats } from "../../types";
import { useLiveQuery } from "dexie-react-hooks";
import { useDynamicVoters } from "../../hooks/useDynamicVoters";
import { FilterSelector } from "../../components/FilterSelector";
import { usePrecinctAnalysis } from "../../hooks/usePrecinctAnalysis";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  MenuItem,
  TextField,
  Tooltip,
  IconButton,
  Divider,
  Button,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import RefreshIcon from "@mui/icons-material/Refresh";
import GroupIcon from "@mui/icons-material/Group";

export default function AnalysisPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { user, isLoaded } = useAuth();

  // --- 1. STATE & CONTEXT ---
  const [selectedPrecinct, setSelectedPrecinct] =
    useState<string>("PA15-P-005");
  const [filters, setFilters] = useState<FilterValues | null>(null);

  const currentMonth = 1; // Jan
  const currentYear = 2026;

  // --- 2. DATA HOOKS ---
  const precincts = useLiveQuery(() => indexedDb.precincts.toArray()) || [];
  const {
    goal,
    stats,
    loading: analysisLoading,
  } = usePrecinctAnalysis(selectedPrecinct, currentMonth, currentYear);
  const { data: voters = [], isLoading: votersLoading } =
    useDynamicVoters(filters);
  const profile = useLiveQuery(
    () => (user?.uid ? indexedDb.users.get(user.uid) : undefined),
    [user?.uid]
  );

  // --- 3. PERFORMANCE KPI LOGIC (Top Section) ---
  const dynamicKPIs = useMemo(() => {
    const s = stats || {
      gop_registrations: 0,
      dem_registrations: 0,
      gop_has_mail_ballots: 0,
      dem_has_mail_ballots: 0,
      doors_knocked: 0,
      texts_sent: 0,
      volunteers_active_count: 0,
    };
    const g = goal || {
      targets: {
        registrations: 0,
        mail_in: 0,
        user_activity: 0,
        volunteers: 0,
      },
    };

    const calculate = (
      actual: number,
      target: number,
      opposition: number = 0
    ) => {
      const progress = target > 0 ? (actual / target) * 100 : 0;
      const isTrailing = opposition > actual;
      let color: "error" | "warning" | "success" | "primary" = "error";
      if (target === 0) color = "primary";
      else if (progress >= 80 && !isTrailing) color = "success";
      else if (progress >= 50) color = "warning";
      return {
        percentage: Math.min(progress, 100),
        color,
        isTrailing,
        current: actual,
        target,
        opposition,
      };
    };

    return [
      {
        label: "GOP Registrations",
        ...calculate(
          s.gop_registrations,
          g.targets.registrations,
          s.dem_registrations
        ),
      },
      {
        label: "GOP Mail Ballots",
        ...calculate(
          s.gop_has_mail_ballots,
          g.targets.mail_in,
          s.dem_has_mail_ballots
        ),
      },
      {
        label: "Voter Contacts",
        ...calculate(
          (s.doors_knocked || 0) + (s.texts_sent || 0),
          g.targets.user_activity
        ),
      },
      {
        label: "Volunteer Team",
        ...calculate(s.volunteers_active_count, g.targets.volunteers),
      },
    ];
  }, [goal, stats]);

  // --- 4. CUSTOM ANALYSIS AGGREGATION (Bottom Section) ---
  const customChartsData = useMemo(() => {
    if (!voters.length) return null;
    return {
      party: [
        { label: "GOP", val: voters.filter((v) => v.party === "R").length },
        { label: "DEM", val: voters.filter((v) => v.party === "D").length },
        {
          label: "IND",
          val: voters.filter((v) => !["R", "D"].includes(v.party || "")).length,
        },
      ],
      ballots: [
        {
          label: "Has Ballot",
          val: voters.filter((v) => v.has_mail_ballot).length,
        },
        {
          label: "No Ballot",
          val: voters.filter((v) => !v.has_mail_ballot).length,
        },
      ],
      age: [
        {
          label: "18-34",
          val: voters.filter((v) => v.age && v.age <= 34).length,
        },
        {
          label: "35-54",
          val: voters.filter((v) => v.age && v.age > 34 && v.age <= 54).length,
        },
        { label: "55+", val: voters.filter((v) => v.age && v.age > 54).length },
      ],
    };
  }, [voters]);

  const handleSubmitFilters = (submittedFilters: FilterValues) => {
    setFilters({ ...submittedFilters, precinct_id: selectedPrecinct });
  };

  if (!isLoaded || analysisLoading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1600, margin: "auto" }}>
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        spacing={2}
        mb={4}
      >
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Field Analytics
          </Typography>
          <Typography color="text.secondary">
            Strategic Analysis for {selectedPrecinct}
          </Typography>
        </Box>
        <TextField
          select
          size="small"
          label="Focus Precinct"
          value={selectedPrecinct}
          onChange={(e) => setSelectedPrecinct(e.target.value)}
          sx={{ minWidth: 250 }}
        >
          {precincts.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {/* SECTION 1: PERFORMANCE KPI BARS */}
      <Grid container spacing={3} mb={6}>
        {dynamicKPIs.map((kpi) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={kpi.label}>
            <Card
              sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
            >
              <CardContent>
                <Typography
                  variant="caption"
                  fontWeight="bold"
                  color="text.secondary"
                >
                  {kpi.label}
                </Typography>
                <Typography
                  variant="h4"
                  fontWeight="900"
                  color={kpi.isTrailing ? "error.main" : "primary.main"}
                >
                  {kpi.current.toLocaleString()}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={kpi.percentage}
                  color={kpi.color as any}
                  sx={{ height: 10, borderRadius: 5, my: 1.5 }}
                />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption">Goal: {kpi.target}</Typography>
                  <Typography variant="caption" fontWeight="bold">
                    {kpi.percentage.toFixed(0)}%
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ mb: 6 }} />

      {/* SECTION 2: CUSTOM ANALYSIS (VOTER INSIGHTS) */}
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Custom Analysis & Targeting
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Apply filters to identify specific voter segments. Results are derived
        from the live voter file.
      </Typography>

      <Paper
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <FilterSelector
          onSubmit={handleSubmitFilters}
          isLoading={votersLoading}
          unrestrictedFilters={[
            "modeledParty",
            "turnout",
            "ageGroup",
            "mailBallot",
          ]}
        />
      </Paper>

      {filters ? (
        <Box>
          {votersLoading ? (
            <Stack alignItems="center" py={10}>
              <CircularProgress />
              <Typography mt={2}>Analyzing Voter File...</Typography>
            </Stack>
          ) : (
            <Grid container spacing={3}>
              {/* Summary Header */}
              <Grid size={{ xs: 12 }}>
                <Alert
                  icon={<GroupIcon />}
                  severity="info"
                  sx={{ borderRadius: 2 }}
                >
                  Found <strong>{voters.length.toLocaleString()}</strong> voters
                  matching your criteria. Below is the demographic breakdown of
                  this specific segment.
                </Alert>
              </Grid>

              {/* Custom Charts */}

              {customChartsData && (
                <>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 3, borderRadius: 3 }}>
                      <Typography variant="subtitle2" mb={2} fontWeight="bold">
                        Party Breakdown
                      </Typography>
                      <BarChart
                        dataset={customChartsData.party}
                        xAxis={[{ scaleType: "band", dataKey: "label" }]}
                        series={[
                          { dataKey: "val", color: theme.palette.primary.main },
                        ]}
                        height={250}
                        margin={{ left: 40, right: 10, top: 10, bottom: 30 }}
                      />
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 3, borderRadius: 3 }}>
                      <Typography variant="subtitle2" mb={2} fontWeight="bold">
                        Mail Ballot Status
                      </Typography>
                      <BarChart
                        dataset={customChartsData.ballots}
                        xAxis={[{ scaleType: "band", dataKey: "label" }]}
                        series={[
                          { dataKey: "val", color: theme.palette.success.main },
                        ]}
                        height={250}
                        margin={{ left: 40, right: 10, top: 10, bottom: 30 }}
                      />
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 3, borderRadius: 3 }}>
                      <Typography variant="subtitle2" mb={2} fontWeight="bold">
                        Age Distribution
                      </Typography>
                      <BarChart
                        dataset={customChartsData.age}
                        xAxis={[{ scaleType: "band", dataKey: "label" }]}
                        series={[
                          { dataKey: "val", color: theme.palette.info.main },
                        ]}
                        height={250}
                        margin={{ left: 40, right: 10, top: 10, bottom: 30 }}
                      />
                    </Paper>
                  </Grid>
                </>
              )}
            </Grid>
          )}
        </Box>
      ) : (
        <Paper
          sx={{
            py: 10,
            textAlign: "center",
            borderRadius: 3,
            bgcolor: "grey.50",
            border: "1px dashed grey",
          }}
        >
          <Typography color="text.secondary">
            Select filters above to generate custom insights
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
