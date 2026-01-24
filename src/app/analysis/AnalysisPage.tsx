import React, { useState, useMemo, useEffect } from "react";
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
  Chip,
  Button,
  Avatar,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import GroupIcon from "@mui/icons-material/Group";
import BoltIcon from "@mui/icons-material/Bolt";

export default function AnalysisPage() {
  const theme = useTheme();
  const { isLoaded } = useAuth();

  // --- 0. PRESET FILTERS ---
  const PRESET_FILTERS = [
    {
      label: "Female Republicans",
      icon: "👩",
      filters: { party: "R", gender: "F" },
    },
    {
      label: "Young GOP (18-24)",
      icon: "🎓",
      filters: { party: "R", ageGroup: "18-24" },
    },
    {
      label: "High-Propensity Seniors",
      icon: "🗳️",
      filters: { turnout: "4", ageGroup: "71+" },
    },
    {
      label: "Missing Mail Ballots",
      icon: "📩",
      filters: { party: "R", mailBallot: "false" },
    },
  ];

  // --- 1. STATES ---
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

  // --- 3. HELPER FUNCTIONS ---

  const getFilterTitle = (filters: FilterValues | null) => {
    if (!filters) return "All Voters";

    const parts: string[] = [];
    if (filters.modeledParty)
      parts.push(
        filters.modeledParty === "R" ? "Republicans" : filters.modeledParty,
      );
    if (filters.gender) parts.push(filters.gender === "F" ? "Female" : "Male");
    if (filters.ageGroup) parts.push(`Age ${filters.ageGroup}`);
    if (filters.turnout) parts.push(`${filters.turnout} Turnout`);

    // Handle the boolean strings for the title
    if (
      filters.mailBallot !== undefined &&
      filters.mailBallot !== null &&
      filters.mailBallot !== ""
    ) {
      const hasBallot = String(filters.mailBallot).toLowerCase() === "true";
      parts.push(hasBallot ? "Mail-In" : "No Mail-In");
    }

    return parts.length > 0 ? parts.join(" • ") : "Custom Filter Set";
  };

  const applyQuickFilter = (presetFilters: Partial<FilterValues>) => {
    console.log("⚡ Applying Quick Target:", presetFilters);
    const merged: FilterValues = { ...presetFilters };
    if (analysisPrecinct && analysisPrecinct !== "all") {
      merged.precinct_id = analysisPrecinct;
    }
    setVoterFilters(merged);
  };

  const isPresetActive = (presetFilters: Partial<FilterValues>) => {
    if (!voterFilters) return false;
    return Object.keys(presetFilters).every(
      (key) =>
        voterFilters[key as keyof FilterValues] ===
        presetFilters[key as keyof FilterValues],
    );
  };

  // --- 4. CALCULATIONS ---

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

  const customChartsData = useMemo(() => {
    if (!voters.length) return null;

    // 1. Voter Registration (By Party)
    const registrationData = [
      { label: "GOP", val: voters.filter((v) => v.party === "R").length },
      { label: "DEM", val: voters.filter((v) => v.party === "D").length },
      {
        label: "Other",
        val: voters.filter((v) => !["R", "D"].includes(v.party || "")).length,
      },
    ];

    // 2. Mail-In Ballots (Those who have requested/returned a ballot)
    // Assuming your voter object has a 'mail_ballot' or similar property
    const mailInData = [
      {
        label: "GOP",
        val: voters.filter((v) => v.party === "R" && v.has_mail_ballot === true)
          .length,
      },
      {
        label: "DEM",
        val: voters.filter((v) => v.party === "D" && v.has_mail_ballot === true)
          .length,
      },
      {
        label: "Other",
        val: voters.filter(
          (v) =>
            !["R", "D"].includes(v.party || "") && v.has_mail_ballot === true,
        ).length,
      },
    ];

    return {
      registration: registrationData,
      mailIn: mailInData,
    };
  }, [voters]);

  useEffect(() => {
    if (voters.length > 0) {
      console.log("📥 [BigQuery Raw Data Sample]:", voters[0]);
      console.log(
        "🧐 [Check has_mail_ballot type]:",
        typeof voters[0].has_mail_ballot,
      );
    }
  }, [voters]);

  if (!isLoaded)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1600, margin: "auto" }}>
      {/* HEADER & FILTERS */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "flex-end" }}
        spacing={3}
        sx={{ mb: 6 }}
      >
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Field Analytics
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
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

      {/* KPI GRID */}
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

      {/* QUICK TARGETS */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <BoltIcon color="primary" fontSize="small" />
          <Typography
            variant="subtitle2"
            fontWeight="bold"
            color="text.secondary"
          >
            Quick Targets
          </Typography>
        </Stack>
        <Stack
          direction="row"
          spacing={1.5}
          flexWrap="wrap"
          useFlexGap
          sx={{ gap: 1.5 }}
        >
          {PRESET_FILTERS.map((preset) => {
            const active = isPresetActive(
              preset.filters as Partial<FilterValues>,
            );
            return (
              <Chip
                key={preset.label}
                label={preset.label}
                onClick={() =>
                  applyQuickFilter(preset.filters as Partial<FilterValues>)
                }
                onDelete={active ? () => setVoterFilters(null) : undefined}
                color={active ? "primary" : "default"}
                variant={active ? "filled" : "outlined"}
                avatar={
                  <Avatar
                    sx={{
                      bgcolor: "transparent",
                      fontSize: "1.5rem",
                      width: "38px !important",
                      height: "38px !important",
                      marginLeft: "6px !important",
                    }}
                  >
                    {preset.icon}
                  </Avatar>
                }
                sx={{
                  borderRadius: "12px",
                  fontWeight: 600,
                  height: 48,
                  px: 1,
                  fontSize: "0.95rem",
                  backgroundColor: active ? undefined : "#ffffff",
                  boxShadow: active
                    ? theme.shadows[2]
                    : "0 2px 4px rgba(0,0,0,0.05)",
                  border: active
                    ? undefined
                    : `1px solid ${theme.palette.divider}`,
                  transition: "all 0.2s ease-in-out",
                  "& .MuiChip-label": { pl: 1.5 },
                  "&:hover": {
                    backgroundColor: active ? undefined : "#f8f9fa",
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                  },
                }}
              />
            );
          })}
          {voterFilters && (
            <Button
              size="large"
              variant="text"
              onClick={() => setVoterFilters(null)}
              sx={{
                color: theme.palette.error.main,
                textTransform: "none",
                fontWeight: "bold",
                height: 48,
                px: 2,
              }}
            >
              Clear All
            </Button>
          )}
        </Stack>
      </Box>

      <FilterSelector
        onSubmit={(values) => {
          console.log("📝 Form Submitted:", values);
          setVoterFilters(values);
        }}
        isLoading={votersLoading}
        demographicFilters={[
          "modeledParty",
          "turnout",
          "ageGroup",
          "mailBallot",
          "gender",
        ]}
      />

      {/* RESULTS DISPLAY */}
      {voterFilters && (
        <Box sx={{ mt: 4 }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ mb: 2, textAlign: "center" }}>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  {getFilterTitle(voterFilters)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Showing results for{" "}
                  {analysisPrecinct === "all"
                    ? "Selected Area"
                    : `Precinct ${analysisPrecinct}`}
                </Typography>
              </Box>

              <Alert
                icon={<GroupIcon />}
                severity="info"
                sx={{ mt: 4, borderRadius: 2 }}
              >
                Analyzing <strong>{voters.length.toLocaleString()}</strong>{" "}
                voters from BigQuery.
              </Alert>
            </Grid>

            {customChartsData &&
              [
                {
                  title: "Voter Registration",
                  data: customChartsData.registration,
                  color: theme.palette.primary.main,
                },
                {
                  title: "Mail-In Ballots",
                  data: customChartsData.mailIn,
                  color: theme.palette.success.main, // Success green often fits mail-in tracking
                },
              ].map((chart, i) => (
                <Grid size={{ xs: 12, md: 6 }} key={i}>
                  <Paper
                    sx={{ p: 3, borderRadius: 3, boxShadow: theme.shadows[2] }}
                  >
                    <Typography variant="subtitle2" mb={2} fontWeight="bold">
                      {chart.title}
                    </Typography>
                    <BarChart
                      dataset={chart.data}
                      xAxis={[
                        {
                          scaleType: "band",
                          dataKey: "label",
                          colorMap: {
                            type: "ordinal",
                            values: ["GOP", "DEM", "Other"],
                            colors: ["#cc0000", "#0000cc", "#d1d1d1"], // Red, Blue, Light Gray
                          },
                        },
                      ]}
                      series={[{ dataKey: "val", label: "Voters" }]}
                      height={300}
                    />
                  </Paper>
                </Grid>
              ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
}
