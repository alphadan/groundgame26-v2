// src/app/dashboard/Dashboard.tsx
import React from "react";
import { useAuth } from "../../context/AuthContext";
import { db as indexedDb } from "../../lib/db";
import { UserProfile } from "../../types";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";
import { useLiveQuery } from "dexie-react-hooks";
import { useVoterStats, type VoterStats } from "../../hooks/useVoterStats";
import ManageTeamPage from "../precincts/ManageTeamPage";
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
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";

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

  // Voter stats (your original params logic — kept simple)
  // ... (keep your filters and voterStatsParams if you have FilterSelector)

  const { data: turnoutStats = {} as VoterStats, isLoading: turnoutLoading } =
    useVoterStats({}); // adjust params as needed

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
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        Dashboard
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Welcome back, {preferredName}
      </Typography>

      {/* Executive Summary */}
      <Paper elevation={3} sx={{ p: { xs: 3, sm: 4 }, mb: 5, borderRadius: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Executive Summary — December 31, 2025
        </Typography>

        <Alert severity="success" sx={{ mb: 3 }}>
          <strong>Strong Progress:</strong> We are 52% toward our voter contact
          goal.
        </Alert>

        <Stack spacing={2}>
          <Typography variant="body1">
            <strong>*** SAMPLE ***</strong>
            App usage up <strong>18%</strong> this week • <strong>87</strong>{" "}
            new volunteers
          </Typography>
          <Typography variant="body1">
            Registration growth: <strong>2.1%</strong> (vs PA avg 1.4%)
          </Typography>
          <Typography variant="body1">
            <strong>Priority:</strong> Mail ballot signups at{" "}
            <strong>36%</strong> of goal
          </Typography>
          <Typography variant="body1" fontWeight="bold" color="primary">
            Next Action: Targeted mail ballot drive in low-signup precincts
          </Typography>
        </Stack>
      </Paper>

      {/* Charts */}
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
                  R: turnoutStats.age_18_25_r,
                  I: turnoutStats.age_18_25_i,
                  D: turnoutStats.age_18_25_d,
                },
                {
                  age: "26-40",
                  R: turnoutStats.age_26_40_r,
                  I: turnoutStats.age_26_40_i,
                  D: turnoutStats.age_26_40_d,
                },
                {
                  age: "41-70",
                  R: turnoutStats.age_41_70_r,
                  I: turnoutStats.age_41_70_i,
                  D: turnoutStats.age_41_70_d,
                },
                {
                  age: "71+",
                  R: turnoutStats.age_71_plus_r,
                  I: turnoutStats.age_71_plus_i,
                  D: turnoutStats.age_71_plus_d,
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
                  age: "18–25",
                  R: turnoutStats.mail_age_18_25_r,
                  I: turnoutStats.mail_age_18_25_i,
                  D: turnoutStats.mail_age_18_25_d,
                },
                {
                  age: "26–40",
                  R: turnoutStats.mail_age_26_40_r,
                  I: turnoutStats.mail_age_26_40_i,
                  D: turnoutStats.mail_age_26_40_d,
                },
                {
                  age: "41–70",
                  R: turnoutStats.mail_age_41_70_r,
                  I: turnoutStats.mail_age_41_70_i,
                  D: turnoutStats.mail_age_41_70_d,
                },
                {
                  age: "71+",
                  R: turnoutStats.mail_age_71_plus_r,
                  I: turnoutStats.mail_age_71_plus_i,
                  D: turnoutStats.mail_age_71_plus_d,
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

      {/* AI-Driven Analysis – More Narrative & Visually Engaging */}
      <Paper elevation={3} sx={{ mt: 5, p: { xs: 3, sm: 4 }, borderRadius: 3 }}>
        <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
          AI-Driven Analysis
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Chester County Republican Efforts • Alpha Phase — December 30, 2025
        </Typography>

        <Stack spacing={4} sx={{ mt: 4 }}>
          {/* Introductory Narrative */}
          <Box>
            <Typography variant="body1" paragraph>
              <strong>*** BEGIN SAMPLE ***</strong>
              The Chester County Republican Committee is building a modern,
              data-driven field operation powered by GroundGame26. With
              bi-weekly BigQuery refreshes, we now have reliable precinct-level
              insight into four core KPIs: voter registration growth, mail
              ballot adoption, daily active committeepersons, and volunteer
              recruitment.
            </Typography>
            <Typography variant="body1">
              Early results show clear momentum—and equally clear opportunities
              to sharpen our focus for maximum impact in 2026.
            </Typography>
          </Box>

          <Divider />

          {/* Positive Trends */}
          <Box>
            <Typography
              variant="h5"
              gutterBottom
              color="success.main"
              fontWeight="bold"
            >
              Positive Trends We’re Building On
            </Typography>
            <Typography variant="body1" paragraph>
              Republican registration is steadily climbing in high-turnout
              precincts, with modeled “Hard R” voters up <strong>4.2%</strong>{" "}
              since October. Targeted education efforts drove an{" "}
              <strong>18%</strong> increase in GOP mail ballot
              requests—narrowing the traditional Democratic advantage in
              absentee voting.
            </Typography>
            <Typography variant="body1">
              Most encouraging: precincts with daily-active committeepersons
              using GroundGame26 show{" "}
              <strong>2.3× higher volunteer sign-ups</strong> and{" "}
              <strong>41% better turnout performance</strong> among weak
              Republicans.
            </Typography>
          </Box>

          <Divider />

          {/* Areas of Concern */}
          <Box>
            <Typography
              variant="h5"
              gutterBottom
              color="warning.main"
              fontWeight="bold"
            >
              Areas Requiring Immediate Attention
            </Typography>
            <Typography variant="body1" paragraph>
              Several low-engagement precincts remain stagnant in both
              registration and mail ballot adoption. Likely-mover
              Republicans—voters who respond strongly to persuasion
              messaging—are currently underrepresented in our outreach.
            </Typography>
            <Typography variant="body1">
              Daily active user rates among committeepersons fall below{" "}
              <strong>30%</strong> in rural areas, limiting real-time
              coordination and momentum.
            </Typography>
          </Box>

          <Divider />

          {/* AI Recommendations */}
          <Box>
            <Typography
              variant="h5"
              gutterBottom
              color="info.main"
              fontWeight="bold"
            >
              AI-Powered Recommendations
            </Typography>
            <Box component="ol" sx={{ pl: 4, my: 2, "& li": { mb: 2 } }}>
              <Typography component="li" variant="body1">
                <strong>Prioritize door-knocking</strong> in precincts showing
                rising "Weak R" scores and recent registrants—these voters
                demonstrate the highest persuasion potential.
              </Typography>
              <Typography component="li" variant="body1">
                Launch a{" "}
                <strong>targeted mail-ballot encouragement campaign</strong> in
                the top 15 precincts by GOP registration density.
              </Typography>
              <Typography component="li" variant="body1">
                Implement{" "}
                <strong>
                  automated daily reminders and enhanced gamification
                </strong>{" "}
                to drive committeeperson app usage above 60%.
              </Typography>
              <Typography component="li" variant="body1">
                Shift volunteer recruitment focus to{" "}
                <strong>likely-mover households</strong>—early data shows{" "}
                <strong>28% higher conversion rates</strong>.
              </Typography>
            </Box>
          </Box>

          <Divider />

          {/* Closing Vision */}
          <Box>
            <Typography
              variant="body1"
              fontStyle="italic"
              color="text.secondary"
            >
              As data collection continues and BigQuery AI integration advances,
              predictive modeling will soon identify emerging hotspots weeks
              ahead of schedule. The current alpha phase already demonstrates
              strong foundational progress—positioning Chester County for the
              most organized, measurable, and effective Republican ground game
              in 2026.
              <strong>*** END SAMPLE ***</strong>
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
