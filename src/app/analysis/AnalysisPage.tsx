// src/app/analysis/AnalysisPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { db as indexedDb } from "../../lib/db";
import { UserProfile } from "../../types";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";
import { useLiveQuery } from "dexie-react-hooks";
import { useDynamicVoters } from "../../hooks/useDynamicVoters";
import { FilterSelector } from "../../components/FilterSelector";
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Phone, Email } from "@mui/icons-material";
import { BarChart } from "@mui/x-charts/BarChart";
import { FilterValues } from "../../types";

// Dummy data — replace with real Cloud Functions later
const dummyKPIs = [
  {
    label: "New Republican Voter Registrations",
    current: 5240,
    goal: 10000,
    percentage: 52.4,
  },
  {
    label: "GOP Have Mail Ballots",
    current: 1820,
    goal: 5000,
    percentage: 36.4,
  },
  {
    label: "Messages Sent / Doors Knocked",
    current: 3100,
    goal: 6000,
    percentage: 51.7,
  },
  { label: "New Volunteers", current: 87, goal: 150, percentage: 58 },
];

const dummyTrendData = [
  { month: "Sep", contacts: 3200 },
  { month: "Oct", contacts: 4100 },
  { month: "Nov", contacts: 4800 },
  { month: "Dec", contacts: 5240 },
];

export default function AnalysisPage() {
  const authState = useAuth();

  const user = authState?.user ?? null;
  const claims = authState?.claims ?? null;
  const isLoaded = authState?.isLoaded ?? false;

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>("trend");

  // === User Profile Caching ===
  useEffect(() => {
    if (!isLoaded || !claims?.user_id) {
      console.log("Auth not loaded yet or no UID");
      return;
    }

    console.log("✅ Auth ready — User ID:", claims.user_id);

    const fetchAndCacheUserProfile = async () => {
      try {
        const cached = await indexedDb.users.get(claims.user_id);
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

  useEffect(() => {
    if (isLoaded && !filters && selectedReport !== "trend") {
      setSelectedReport("trend");
    }
  }, [isLoaded, filters]);

  // === Profile (from IndexedDB) ===
  const profile = useLiveQuery(
    () => (claims?.user_id ? indexedDb.users.get(claims.user_id) : undefined),
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
    return match ? match[1] : undefined;
  };

  const extractCountyCode = (fullId: string): string => {
    const match = fullId.match(/PA-C-(\d+)$/);
    return match ? match[1] : "15";
  };

  // === Voter data from dynamic query ===
  const { data: voters = [], isLoading, error } = useDynamicVoters(filters);

  const handleSubmit = (submittedFilters: FilterValues) => {
    setSelectedReport(null);
    setFilters(submittedFilters);
  };

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
        Reports & Analytics
      </Typography>

      {/* Executive Summary */}
      <Paper sx={{ p: 4, mb: 5, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Executive Summary — December 29, 2025
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

      {/* KPI Cards */}
      <Grid container spacing={3} mb={5}>
        {dummyKPIs.map((kpi) => (
          <Grid size={{ xs: 12, md: 6 }} key={kpi.label}>
            <Card sx={{ height: "100%", boxShadow: 3 }}>
              <CardContent>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  {kpi.label}
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {kpi.current.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Goal: {kpi.goal.toLocaleString()}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={kpi.percentage}
                    sx={{
                      height: 10,
                      borderRadius: 5,
                      bgcolor: "grey.300",
                      "& .MuiLinearProgress-bar": {
                        bgcolor: kpi.percentage >= 100 ? "#4caf50" : "#B22234",
                      },
                    }}
                  />
                  <Typography variant="body2" align="right" mt={1}>
                    {kpi.percentage.toFixed(1)}%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* === Default Trend Report (Only when no specific report selected) === */}
      {selectedReport === "trend" && (
        <Paper sx={{ p: 4, mb: 5, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Contact Trend (Last 4 Months)
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Overall canvassing activity across all precincts
          </Typography>
          <BarChart
            dataset={dummyTrendData}
            xAxis={[{ scaleType: "band", dataKey: "month" }]}
            series={[
              {
                dataKey: "contacts",
                label: "Voters Contacted",
                color: "#B22234",
              },
            ]}
            height={350}
          />
        </Paper>
      )}

      {/* === Custom Report from Filters === */}
      {selectedReport === null && filters && (
        <Paper sx={{ p: 4, mb: 5, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Custom Report: {voters.length.toLocaleString()} Voters Match Your
            Filters
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Breakdown by party, age, turnout, and mail ballot status
          </Typography>

          {isLoading ? (
            <Box textAlign="center" py={6}>
              <CircularProgress />
              <Typography>Loading report...</Typography>
            </Box>
          ) : error ? (
            <Alert severity="error">Failed to load voter data</Alert>
          ) : (
            <Grid container spacing={3}>
              {/* Party Breakdown */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                  Party Affiliation
                </Typography>
                <BarChart
                  dataset={[
                    {
                      party: "Republican",
                      count: voters.filter((v) => v.party === "R").length,
                    },
                    {
                      party: "Democrat",
                      count: voters.filter((v) => v.party === "D").length,
                    },
                    {
                      party: "Other/None",
                      count: voters.filter(
                        (v) => !v.party || !["R", "D"].includes(v.party)
                      ).length,
                    },
                  ]}
                  xAxis={[{ scaleType: "band", dataKey: "party" }]}
                  series={[{ dataKey: "count", label: "Voters" }]}
                  height={300}
                  colors={["#B22234", "#1E90FF", "#9370DB"]}
                />
              </Grid>

              {/* Age Groups */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                  Age Distribution
                </Typography>
                <BarChart
                  dataset={[
                    {
                      range: "18-29",
                      count: voters.filter((v) => v.age && v.age <= 29).length,
                    },
                    {
                      range: "30-49",
                      count: voters.filter(
                        (v) => v.age && v.age >= 30 && v.age <= 49
                      ).length,
                    },
                    {
                      range: "50-64",
                      count: voters.filter(
                        (v) => v.age && v.age >= 50 && v.age <= 64
                      ).length,
                    },
                    {
                      range: "65+",
                      count: voters.filter((v) => v.age && v.age >= 65).length,
                    },
                  ]}
                  xAxis={[{ scaleType: "band", dataKey: "range" }]}
                  series={[{ dataKey: "count", label: "Voters" }]}
                  height={300}
                />
              </Grid>

              {/* Mail Ballot Status */}
              <Grid size={12}>
                <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                  Mail Ballot Status
                </Typography>
                <BarChart
                  dataset={[
                    {
                      status: "Requested",
                      count: voters.filter((v) => v.has_mail_ballot).length,
                    },
                    {
                      status: "Not Requested",
                      count: voters.filter((v) => !v.has_mail_ballot).length,
                    },
                  ]}
                  xAxis={[{ scaleType: "band", dataKey: "status" }]}
                  series={[{ dataKey: "count", label: "Voters" }]}
                  height={250}
                  colors={["#FFD700", "#808080"]}
                />
              </Grid>
            </Grid>
          )}
        </Paper>
      )}

      {/* === Default Popular Targeting Report === */}
      <Paper sx={{ p: 4, mb: 5, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Popular Targeting Reports
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Chip
            label="Contact Trend (Default)"
            color={selectedReport === "trend" ? "primary" : "default"}
            onClick={() => {
              setSelectedReport("trend");
              setFilters(null);
            }}
            clickable
          />
          <Chip
            label="Republicans Without Mail Ballots"
            color={selectedReport === "noMailR" ? "primary" : "default"}
            onClick={() => {
              setSelectedReport("noMailR");
              handleSubmit({
                county: "",
                area: "",
                precinct: "",
                modeledParty: "1 - Hard Republican,2 - Weak Republican",
                mailBallot: "false",
              });
            }}
            clickable
          />
          <Chip
            label="High-Turnout Swing Voters"
            color={selectedReport === "swingHigh" ? "primary" : "default"}
            onClick={() => {
              setSelectedReport("swingHigh");
              handleSubmit({
                county: "",
                area: "",
                precinct: "",
                modeledParty: "3 - Swing",
                turnout: "high",
              });
            }}
            clickable
          />
          <Chip
            label="Young Low-Turnout Voters"
            color={selectedReport === "youngLow" ? "primary" : "default"}
            onClick={() => {
              setSelectedReport("youngLow");
              handleSubmit({
                county: "",
                area: "",
                precinct: "",
                ageGroup: "18-25",
                turnout: "low",
              });
            }}
            clickable
          />
        </Box>
      </Paper>

      {/* Filter Selector */}
      {claims?.role === "state_admin" && (
        <FilterSelector
          onSubmit={handleSubmit}
          isLoading={isSubmitting && isLoading}
          unrestrictedFilters={[
            "modeledParty",
            "turnout",
            "ageGroup",
            "mailBallot",
          ]}
        />
      )}
      {/* === No Filters Message === */}
      {filters === null && (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Select a report or use filters to view analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Click one of the quick reports above or apply filters and submit to
            generate detailed charts and insights.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
