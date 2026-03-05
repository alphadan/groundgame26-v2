// src/app/dashboard/Dashboard.tsx
import React, { useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { db as indexedDb } from "../../lib/db";
import { UserProfile } from "../../types";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";
import { useLiveQuery } from "dexie-react-hooks";
import { useVoterStats, type VoterStats } from "../../hooks/useVoterStats";
import { usePrecinctAnalysis } from "../../hooks/usePrecinctAnalysis";
import ManageTeamPage from "../precincts/ManageTeamPage";
import { PrecinctFilterBar } from "../../components/navigation/PrecinctFilterBar";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Grid,
  Alert,
  Stack,
  Divider,
  useTheme,
  useMediaQuery,
  LinearProgress,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";

export default function Dashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const authState = useAuth();
  const user = authState?.user ?? null;
  const claims = authState?.claims ?? null;
  const isLoaded = authState?.isLoaded ?? false;

  // Fetch and cache user profile (simplified — your original logic is fine)
  // ... (keep your useEffect for profile caching)

  const profile = useLiveQuery(
    () => (user?.uid ? indexedDb.users.get(user.uid) : undefined),
    [user?.uid],
  );

  const preferredName =
    profile?.preferred_name || user?.displayName || user?.email || "User";

  // --- 1. STATE & DATA HOOKS ---
  const [analysisPrecinct, setAnalysisPrecinct] = useState<string>("all");

  // Fetch AI Goals & Narratives (Bridge to BigQuery data)
  const {
    goal,
    stats,
    loading: analysisLoading,
  } = usePrecinctAnalysis(analysisPrecinct, 1, 2026);

  const { data: turnoutStats = {} as VoterStats, isLoading: turnoutLoading } =
    useVoterStats({
      precinct_id: analysisPrecinct === "all" ? undefined : analysisPrecinct,
    });

  // --- 2. KPI CALCULATIONS ---
  const progressStats = useMemo(() => {
    // Ensure we have a valid object even if hooks return null
    const s = stats || {
      gop_registrations: 0,
      gop_has_mail_ballots: 0,
      doors_knocked: 0,
      texts_sent: 0,
    };
    const g = goal?.targets || {
      registrations: 0,
      mail_in: 0,
      user_activity: 0,
    };

    const calc = (cur: number | undefined, tar: number | undefined) => {
      const safeCur = cur ?? 0;
      const safeTar = tar ?? 0;
      return {
        value: safeCur,
        target: safeTar,
        pct: safeTar > 0 ? Math.min((safeCur / safeTar) * 100, 100) : 0,
      };
    };

    return {
      regs: calc(s.gop_registrations, g.registrations),
      vbm: calc(s.gop_has_mail_ballots, g.mail_in),
      outreach: calc(
        (s.doors_knocked || 0) + (s.texts_sent || 0),
        g.user_activity,
      ),
    };
  }, [stats, goal]);

  // --- 3. TREND STUBS (Replace with real hooks when ready) ---

  const outreachTrendData = [
    { month: "Oct", sms: 1200, email: 800, surveys: 150, doors: 400 },
    { month: "Nov", sms: 2800, email: 1900, surveys: 380, doors: 950 },
    { month: "Dec", sms: 4500, email: 3200, surveys: 720, doors: 1800 },
    { month: "Jan", sms: 6200, email: 4800, surveys: 1100, doors: 2900 },
  ];

  // Stub data for Volunteer Recruitment (Cumulative +8/mo)
  const volunteerTrendData = [
    { month: "Oct", total: 42 },
    { month: "Nov", total: 50 },
    { month: "Dec", total: 58 },
    { month: "Jan", total: 66 },
  ];

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
        <CircularProgress color="primary" size={60} />
      </Box>
    );
  }
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "100vw",
        p: { xs: 2, sm: 3, md: 4 },
        mx: "auto",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems="flex-end"
        spacing={2}
        sx={{ mb: 4 }}
      >
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Dashboard
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mt: 0.5, mb: 3 }}
          >
            Welcome, {preferredName}
          </Typography>
        </Box>
        <Box sx={{ minWidth: 300 }}>
          <PrecinctFilterBar onPrecinctSelect={setAnalysisPrecinct} />
        </Box>
      </Stack>

      {/* PROGRESS TRACKER */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        {[
          {
            label: "GOP Registrations",
            data: progressStats.regs,
            color: "primary",
          },
          {
            label: "VBM Conversions",
            data: progressStats.vbm,
            color: "success",
          },
          {
            label: "Voter Outreach",
            data: progressStats.outreach,
            color: "warning",
          },
        ].map((kpi) => (
          <Grid size={{ xs: 12, md: 4 }} key={kpi.label}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Typography
                variant="caption"
                fontWeight="bold"
                color="text.secondary"
              >
                {kpi.label}
              </Typography>

              {/* FIX: Added null-coalescing (?? 0) before toLocaleString */}
              <Typography variant="h4" fontWeight="900" sx={{ my: 1 }}>
                {(kpi.data?.value ?? 0).toLocaleString()}
              </Typography>

              <LinearProgress
                variant="determinate"
                value={kpi.data?.pct ?? 0}
                color={kpi.color as any}
                sx={{ height: 8, borderRadius: 4, mb: 1 }}
              />

              <Typography variant="caption" color="text.secondary">
                Goal: {kpi.data?.target ?? 0} ({(kpi.data?.pct ?? 0).toFixed(0)}
                %)
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ mb: 5 }} />

      {/* ANALYTICS CHARTS */}
      <Grid container spacing={3}>
        {/* 1. Voter Registration by Age Group */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3, height: "100%" }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Voter Registration by Age Group
            </Typography>
            <BarChart
              dataset={[
                {
                  age: "18-25",
                  R: turnoutStats.age_18_25_r || 0,
                  I: turnoutStats.age_18_25_i || 0,
                  D: turnoutStats.age_18_25_d || 0,
                },
                {
                  age: "26-40",
                  R: turnoutStats.age_26_40_r || 0,
                  I: turnoutStats.age_26_40_i || 0,
                  D: turnoutStats.age_26_40_d || 0,
                },
                {
                  age: "41-70",
                  R: turnoutStats.age_41_70_r || 0,
                  I: turnoutStats.age_41_70_i || 0,
                  D: turnoutStats.age_41_70_d || 0,
                },
                {
                  age: "71+",
                  R: turnoutStats.age_71_plus_r || 0,
                  I: turnoutStats.age_71_plus_i || 0,
                  D: turnoutStats.age_71_plus_d || 0,
                },
              ]}
              xAxis={[{ scaleType: "band", dataKey: "age" }]}
              series={[
                { dataKey: "R", label: "Rep", color: "#B22234" },
                { dataKey: "I", label: "Ind (NF)", color: "#E0E0E0" },
                { dataKey: "D", label: "Dem", color: "#1976D2" },
              ]}
              height={300}
              margin={{ top: 50, bottom: 30, left: 40, right: 10 }}
            />
          </Paper>
        </Grid>

        {/* 2. Mail-In Ballot Holders by Age Group */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3, height: "100%" }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Mail-In Ballot Holders by Age Group
            </Typography>
            <BarChart
              dataset={[
                {
                  age: "18-25",
                  R: turnoutStats.mail_age_18_25_r || 0,
                  I: turnoutStats.mail_age_18_25_i || 0,
                  D: turnoutStats.mail_age_18_25_d || 0,
                },
                {
                  age: "26-40",
                  R: turnoutStats.mail_age_26_40_r,
                  I: turnoutStats.mail_age_26_40_i || 0,
                  D: turnoutStats.mail_age_26_40_d || 0,
                },
                {
                  age: "41-70",
                  R: turnoutStats.mail_age_41_70_r || 0,
                  I: turnoutStats.mail_age_41_70_i || 0,
                  D: turnoutStats.mail_age_41_70_d || 0,
                },
                {
                  age: "71+",
                  R: turnoutStats.mail_age_71_plus_r || 0,
                  I: turnoutStats.mail_age_71_plus_i || 0,
                  D: turnoutStats.mail_age_71_plus_d || 0,
                },
              ]}
              xAxis={[{ scaleType: "band", dataKey: "age" }]}
              series={[
                { dataKey: "R", label: "Rep", color: "#B22234" },
                { dataKey: "I", label: "Ind (NF)", color: "#E0E0E0" },
                { dataKey: "D", label: "Dem", color: "#1976D2" },
              ]}
              height={300}
              margin={{ top: 50, bottom: 30, left: 40, right: 10 }}
            />
          </Paper>
        </Grid>

        {/* 3. Voter Outreach Activity Trend */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3, height: "100%" }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Voter Outreach Activity (Cumulative) (***SAMPLE***)
            </Typography>
            <LineChart
              dataset={outreachTrendData}
              xAxis={[{ scaleType: "point", dataKey: "month" }]}
              series={[
                { dataKey: "sms", label: "SMS", color: "#9c27b0" },
                { dataKey: "email", label: "Email", color: "#03a9f4" },
                { dataKey: "surveys", label: "Surveys", color: "#ff9800" },
                { dataKey: "doors", label: "Doors", color: "#4caf50" },
              ]}
              height={300}
              margin={{ top: 50, bottom: 30, left: 60, right: 20 }}
            />
          </Paper>
        </Grid>

        {/* 4. Volunteer Recruitment Trend */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3, height: "100%" }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Total Volunteers Recruited (Cumulative) (***SAMPLE***)
            </Typography>
            <LineChart
              dataset={volunteerTrendData}
              xAxis={[{ scaleType: "point", dataKey: "month" }]}
              series={[
                {
                  dataKey: "total",
                  label: "Total Volunteers",
                  color: "#66BB6A",
                  area: true,
                },
              ]}
              height={300}
              margin={{ top: 50, bottom: 30, left: 60, right: 20 }}
            />
          </Paper>
        </Grid>
      </Grid>

      {/* AI STRATEGIC SUITE - THE "MISSION BRIEFING" */}
      {goal?.ai_narratives && (
        <Grid container spacing={3} sx={{ mt: 5, mb: 3 }}>
          <Grid size={{ xs: 12 }}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                bgcolor: "secondary.main",
                color: "white",
                borderRadius: 4,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <AutoFixHighIcon sx={{ opacity: 0.8 }} />
                <Typography
                  variant="overline"
                  fontWeight="900"
                  sx={{ letterSpacing: 1.2 }}
                >
                  AI Strategic Summary
                </Typography>
              </Stack>
              <Typography variant="h6" fontWeight="400">
                {goal.ai_narratives.summary}
              </Typography>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 4,
                height: "100%",
                borderLeft: `6px solid ${theme.palette.success.main}`,
                bgcolor: "rgba(46, 125, 50, 0.02)",
              }}
            >
              <Typography
                variant="caption"
                fontWeight="900"
                color="success.main"
                display="block"
                gutterBottom
              >
                POSITIVE TRENDS
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {goal.ai_narratives.positive}
              </Typography>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 4,
                height: "100%",
                borderLeft: `6px solid ${theme.palette.error.main}`,
                bgcolor: "rgba(211, 47, 47, 0.02)",
              }}
            >
              <Typography
                variant="caption"
                fontWeight="900"
                color="error.main"
                display="block"
                gutterBottom
              >
                IMMEDIATE ATTENTION
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {goal.ai_narratives.immediate}
              </Typography>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 4,
                height: "100%",
                borderLeft: `6px solid ${theme.palette.info.main}`,
                bgcolor: "rgba(2, 136, 209, 0.02)",
              }}
            >
              <Typography
                variant="caption"
                fontWeight="900"
                color="info.main"
                display="block"
                gutterBottom
              >
                ACTIONABLE STEPS
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {goal.ai_narratives.actionable}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      <ManageTeamPage />
    </Box>
  );
}
