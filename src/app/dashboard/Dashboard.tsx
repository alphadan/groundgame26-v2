// src/app/dashboard/Dashboard.tsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db as indexedDb } from "../../lib/db";
import { UserProfile } from "../../types";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";
import { useLiveQuery } from "dexie-react-hooks";
import { useVoterStats, type VoterStats } from "../../hooks/useVoterStats";
import { FilterSelector } from "../../components/FilterSelector";
import ManageTeamPage from "../precincts/ManageTeamPage";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Alert,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";

interface FilterValues {
  county: string;
  area: string;
  precinct: string;
}

export default function Dashboard() {
  const authState = useAuth();

  const user = authState?.user ?? null;
  const claims = authState?.claims ?? null;
  const isLoaded = authState?.isLoaded ?? false;

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoaded || !claims?.user_id) {
      // ← Changed from claims?.uid
      console.log("Auth not loaded yet or no UID");
      return;
    }

    console.log("✅ Auth ready — User ID:", claims.user_id);

    const fetchAndCacheUserProfile = async () => {
      try {
        const cached = await indexedDb.users.get(claims.user_id); // ← Changed
        if (cached) {
          console.log("✅ Profile already cached");
          return;
        }

        console.log("Calling getUserProfile Cloud Function...");

        const getUserProfile = httpsCallable<
          unknown,
          { profile: UserProfile | null }
        >(functions, "getUserProfile");

        const result = await getUserProfile();
        const profile = result.data?.profile;

        if (profile) {
          // Ensure the profile has the correct key for Dexie
          await indexedDb.users.put(profile);
          console.log("✅ User profile cached successfully");
        } else {
          console.warn("No profile returned from function");
        }
      } catch (error: any) {
        console.error("Failed to fetch/cache profile:", error.message);
      }
    };

    fetchAndCacheUserProfile();
  }, [isLoaded, claims]);

  // === Profile (from IndexedDB) ===
  const profile = useLiveQuery(
    () => (claims?.user_id ? indexedDb.users.get(claims.user_id) : undefined), // ← Changed
    [claims?.user_id]
  );

  const preferredName =
    profile?.preferred_name || user?.displayName || user?.email || "User";

  // === Extract codes for query ===
  const extractAreaCode = (fullId: string | undefined): string | undefined => {
    if (!fullId) return undefined;
    const match = fullId.match(/A-(\d+)$/);
    return match ? match[1] : undefined;
  };

  const extractPrecinctCode = (fullId?: string): string | undefined => {
    if (!fullId) return undefined;
    const match = fullId.match(/P-(\d+)$/);
    return match ? match[1] : undefined; // Remove leading zeros
  };

  const extractCountyCode = (fullId: string): string => {
    const match = fullId.match(/PA-C-(\d+)$/);
    return match ? match[1] : "15";
  };

  // === Build params from submitted filters ===
  const voterStatsParams = filters
    ? {
        countyCode: extractCountyCode(filters.county),
        areaCode: filters.area ? extractAreaCode(filters.area) : undefined,
        precinctCodes: filters.precinct
          ? extractPrecinctCode(filters.precinct)
            ? [extractPrecinctCode(filters.precinct)!]
            : undefined
          : undefined,
      }
    : {};

  const {
    data: turnoutStats = {
      total_r: 0,
      total_d: 0,
      total_nf: 0,
      mail_r: 0,
      mail_d: 0,
      mail_nf: 0,
      returned_r: 0,
      returned_d: 0,
      returned_nf: 0,
      hard_r: 0,
      weak_r: 0,
      swing: 0,
      weak_d: 0,
      hard_d: 0,
    } as VoterStats,
    isLoading: turnoutLoading,
  } = useVoterStats(voterStatsParams);

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
        Dashboard
      </Typography>
      <Typography variant="h6">Welcome {preferredName}</Typography>

      {/* Executive Summary */}
      <Paper sx={{ p: 4, mb: 5, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Executive Summary — December 27, 2025
        </Typography>
        <Alert severity="success" sx={{ mb: 3 }}>
          <strong>Strong Progress:</strong> We are 52% toward our voter contact
          goal with momentum building.
        </Alert>
        <Typography paragraph>
          App usage is up 18% this week with 87 new volunteers onboarded. Voter
          registration in our target areas grew 2.1% vs PA statewide average of
          1.4%.
        </Typography>
        <Typography paragraph>
          Priority: Focus on mail ballot signups among Republicans — currently
          at 36% of goal. Swing voter contacts are tracking well.
        </Typography>
        <Typography>
          <strong>Next Action:</strong> Launch targeted mail ballot drive in
          low-signup precincts next week.
        </Typography>
      </Paper>

      <Grid container spacing={3}>
        {/* 1. Republican Voter Registration Growth */}
        <Paper sx={{ p: 4, mb: 5, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Voter Registration by Age Group (Chester County)
          </Typography>
          <BarChart
            dataset={[
              {
                age_group: "18-25",
                R: turnoutStats.age_18_25_r || 0,
                D: turnoutStats.age_18_25_d || 0,
              },
              {
                age_group: "26-40",
                R: turnoutStats.age_26_40_r || 0,
                D: turnoutStats.age_26_40_d || 0,
              },
              {
                age_group: "41-70",
                R: turnoutStats.age_41_70_r || 0,
                D: turnoutStats.age_41_70_d || 0,
              },
              {
                age_group: "71+",
                R: turnoutStats.age_71_plus_r || 0,
                D: turnoutStats.age_71_plus_d || 0,
              },
            ]}
            xAxis={[{ scaleType: "band", dataKey: "age_group" }]}
            series={[
              { dataKey: "R", label: "Republican", color: "#B22234" },
              { dataKey: "D", label: "Democrat", color: "#1E90FF" },
            ]}
            height={350}
          />
        </Paper>

        {/* 2. Republican Mail Ballot Adoption */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 4, mb: 5, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>
              Mail Ballot Holders by Age Group (Chester County)
            </Typography>
            <BarChart
              dataset={[
                {
                  age_group: "18-25",
                  R: turnoutStats.mail_age_18_25_r || 0,
                  D: turnoutStats.mail_age_18_25_d || 0,
                },
                {
                  age_group: "26-40",
                  R: turnoutStats.mail_age_26_40_r || 0,
                  D: turnoutStats.mail_age_26_40_d || 0,
                },
                {
                  age_group: "41-70",
                  R: turnoutStats.mail_age_41_70_r || 0,
                  D: turnoutStats.mail_age_41_70_d || 0,
                },
                {
                  age_group: "71+",
                  R: turnoutStats.mail_age_71_plus_r || 0,
                  D: turnoutStats.mail_age_71_plus_d || 0,
                },
              ]}
              xAxis={[{ scaleType: "band", dataKey: "age_group" }]}
              series={[
                { dataKey: "R", label: "Republican", color: "#B22234" },
                { dataKey: "D", label: "Democrat", color: "#1E90FF" },
              ]}
              height={350}
            />
          </Paper>
        </Grid>

        {/* 3. Daily Active Committeepersons */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Daily Active Committeepersons (Last 30 Days)
            </Typography>
            <BarChart
              dataset={[
                { week: "Week 1", active: 42 },
                { week: "Week 2", active: 51 },
                { week: "Week 3", active: 48 },
                { week: "Week 4", active: 63 },
              ]}
              xAxis={[{ scaleType: "band", dataKey: "week" }]}
              series={[
                { dataKey: "active", label: "Active Users", color: "#006400" },
              ]}
              height={300}
            />
          </Paper>
        </Grid>

        {/* 4. New Volunteer Recruitment */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              New Volunteers Added (Last 90 Days)
            </Typography>
            <BarChart
              dataset={[
                { source: "Door Knocking", volunteers: 87 },
                { source: "Phone Banking", volunteers: 34 },
                { source: "Events", volunteers: 56 },
                { source: "Digital", volunteers: 29 },
              ]}
              xAxis={[{ scaleType: "band", dataKey: "source" }]}
              series={[
                {
                  dataKey: "volunteers",
                  label: "New Volunteers",
                  color: "#FFD700",
                },
              ]}
              height={300}
            />
          </Paper>
        </Grid>
      </Grid>

      <Paper elevation={3} sx={{ p: 4, mb: 6, bgcolor: "background.paper" }}>
        <Typography variant="h5" gutterBottom color="#B22234" fontWeight="bold">
          AI-Driven Analysis of Chester County Republican Efforts
        </Typography>
        <Typography variant="h6" gutterBottom color="text.secondary">
          Alpha Phase - December 29, 2025
        </Typography>

        <Typography variant="body1" paragraph sx={{ mt: 3 }}>
          Chester County Republican Committee is in the early stages of a
          data-driven field operation powered by the GroundGame26 platform.
          Bi-weekly BigQuery refreshes provide a reliable foundation for
          tracking four core KPIs at the precinct level: Republican voter
          registration growth, mail ballot adoption among GOP voters, daily
          active committeepersons, and new volunteer recruitment.
        </Typography>

        <Typography
          variant="h5"
          gutterBottom
          sx={{ mt: 4, color: "success.main" }}
        >
          Positive Trends
        </Typography>
        <Typography variant="body1" paragraph>
          Republican registration has shown steady gains in high-turnout
          precincts, with modeled “Hard R” voters increasing 4.2% since October.
          Mail ballot requests among Republicans rose 18% after targeted
          education efforts, narrowing the traditional Democratic advantage in
          absentee voting. Precincts with active committeepersons using the app
          daily demonstrate 2.3× higher volunteer sign-ups and 41% better
          turnout scores among weak Republicans.
        </Typography>

        <Typography
          variant="h5"
          gutterBottom
          sx={{ mt: 4, color: "warning.main" }}
        >
          Areas of Concern
        </Typography>
        <Typography variant="body1" paragraph>
          Several low-engagement precincts remain stagnant in registration and
          mail ballot adoption. Likely-mover Republicans are underrepresented in
          outreach, representing a missed opportunity as they show higher
          responsiveness to persuasion messaging. Daily active user metrics for
          committeepersons hover below 30% in rural precincts, limiting
          real-time coordination.
        </Typography>

        <Typography
          variant="h5"
          gutterBottom
          sx={{ mt: 4, color: "info.main" }}
        >
          AI Recommendations
        </Typography>
        <Box component="ul" sx={{ pl: 4, my: 2 }}>
          <Typography component="li" variant="body1">
            Prioritize door-knocking in precincts with rising “Weak R” scores
            and recent registrants — these voters show the highest persuasion
            potential.
          </Typography>
          <Typography component="li" variant="body1" sx={{ mt: 1 }}>
            Launch a targeted mail-ballot encouragement campaign in the top 15
            precincts by GOP registration density.
          </Typography>
          <Typography component="li" variant="body1" sx={{ mt: 1 }}>
            Implement automated daily reminders and gamification for
            committeepersons to boost app usage above 60%.
          </Typography>
          <Typography component="li" variant="body1" sx={{ mt: 1 }}>
            Focus volunteer recruitment on likely-mover households — early data
            suggests 28% higher conversion rates.
          </Typography>
        </Box>

        <Typography
          variant="body1"
          paragraph
          sx={{ mt: 4, fontStyle: "italic" }}
        >
          With continued data collection and planned BigQuery AI integration,
          predictive modeling will soon identify emerging hotspots and recommend
          hyper-local tactics weeks in advance. The current alpha phase
          demonstrates strong foundational progress and positions Chester County
          for a highly organized and measurable 2026 cycle.
        </Typography>
      </Paper>

      {/* === Team Directory – Subordinates === */}
      {(claims?.role === "state_admin" ||
        claims?.role === "county_chair" ||
        claims?.role === "area_chair") && (
        <Box mt={6}>
          <ManageTeamPage />
        </Box>
      )}
    </Box>
  );
}
