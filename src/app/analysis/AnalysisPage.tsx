import React, { useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { FilterValues } from "../../types";
import { useDynamicVoters } from "../../hooks/useDynamicVoters";
import { usePrecinctAnalysis } from "../../hooks/usePrecinctAnalysis";
import { PrecinctFilterBar } from "../../components/navigation/PrecinctFilterBar";
import { FilterSelector } from "../../components/FilterSelector";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Alert,
  CircularProgress,
  useTheme,
  Divider,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import GroupIcon from "@mui/icons-material/Group";

export default function AnalysisPage() {
  const theme = useTheme();
  const { isLoaded } = useAuth();

  // --- 1. SEPARATED STATES ---
  const [analysisPrecinct, setAnalysisPrecinct] =
    useState<string>("PA15-P-005");
  const [voterFilters, setVoterFilters] = useState<FilterValues | null>(null);

  // --- 2. DATA HOOKS ---
  const {
    goal,
    stats,
    loading: analysisLoading,
  } = usePrecinctAnalysis(analysisPrecinct, 1, 2026);

  const { data: voters = [], isLoading: votersLoading } =
    useDynamicVoters(voterFilters);

  // --- 3. PERFORMANCE KPI CALCULATIONS ---
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
      opposition: number = 0,
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
      };
    };

    return [
      {
        label: "GOP Registrations",
        ...calculate(
          s.gop_registrations,
          g.targets.registrations,
          s.dem_registrations,
        ),
      },
      {
        label: "GOP Mail Ballots",
        ...calculate(
          s.gop_has_mail_ballots,
          g.targets.mail_in,
          s.dem_has_mail_ballots,
        ),
      },
      {
        label: "Voter Contacts",
        ...calculate(
          (s.doors_knocked || 0) + (s.texts_sent || 0),
          g.targets.user_activity,
        ),
      },
      {
        label: "Volunteer Team",
        ...calculate(s.volunteers_active_count, g.targets.volunteers),
      },
    ];
  }, [goal, stats]);

  // --- 4. VOTER CHART MAPPING ---
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

  if (!isLoaded)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1600, margin: "auto" }}>
      {/* SECTION 1: FIELD ANALYTICS HEADER & FILTERS */}
      <Stack
        direction={{ xs: "column", md: "row" }} // Underneath on mobile, side-by-side on desktop
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "flex-end" }} // Aligns filters to bottom of header text on desktop
        spacing={3} // Adds consistent gap
        sx={{ mb: 6 }} // Increased spacing between this header and the KPI cards
      >
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Field Analytics
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {/* If using the naming logic from the filter bar update: */}
            Strategic Analysis for{" "}
            {analysisPrecinct === "all"
              ? "All Selected Precincts"
              : analysisPrecinct}
          </Typography>
        </Box>

        <Box sx={{ width: { xs: "100%", md: "auto" } }}>
          <PrecinctFilterBar
            onPrecinctSelect={setAnalysisPrecinct}
            isLoading={analysisLoading}
          />
        </Box>
      </Stack>

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

      {/* SECTION 2: CUSTOM TARGETING (Filter Selector) */}
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Custom Analysis & Targeting
      </Typography>

      <FilterSelector
        onSubmit={setVoterFilters}
        isLoading={votersLoading}
        demographicFilters={[
          "modeledParty",
          "turnout",
          "ageGroup",
          "mailBallot",
        ]}
      />

      {voterFilters && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <Alert icon={<GroupIcon />} severity="info">
              Analyzing <strong>{voters.length.toLocaleString()}</strong> voters
              from BigQuery.
            </Alert>
          </Grid>
          {customChartsData &&
            [
              {
                title: "Party Breakdown",
                data: customChartsData.party,
                color: theme.palette.primary.main,
              },
              {
                title: "Age Distribution",
                data: customChartsData.age,
                color: theme.palette.info.main,
              },
            ].map((chart, i) => (
              <Grid size={{ xs: 12, md: 6 }} key={i}>
                <Paper sx={{ p: 3, borderRadius: 3 }}>
                  <Typography variant="subtitle2" mb={2} fontWeight="bold">
                    {chart.title}
                  </Typography>
                  <BarChart
                    dataset={chart.data}
                    xAxis={[{ scaleType: "band", dataKey: "label" }]}
                    series={[{ dataKey: "val", color: chart.color }]}
                    height={250}
                  />
                </Paper>
              </Grid>
            ))}
        </Grid>
      )}
    </Box>
  );
}
