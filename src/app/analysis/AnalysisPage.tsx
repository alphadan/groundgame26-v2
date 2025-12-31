// src/app/analysis/AnalysisPage.tsx
import React, { useState, useEffect } from "react";
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
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { FilterValues } from "../../types";

// KPI Data
const kpis = [
  {
    label: "New Republican Registrations",
    current: 5240,
    goal: 10000,
    percentage: 52.4,
  },
  {
    label: "GOP Mail Ballot Holders",
    current: 1820,
    goal: 5000,
    percentage: 36.4,
  },
  {
    label: "Voter Contacts (Doors + Messages)",
    current: 5240,
    goal: 10000,
    percentage: 52.4,
  },
  {
    label: "New Volunteers Recruited",
    current: 87,
    goal: 150,
    percentage: 58,
  },
];

// Default trend data
const trendData = [
  { month: "Sep", contacts: 3200 },
  { month: "Oct", contacts: 4100 },
  { month: "Nov", contacts: 4800 },
  { month: "Dec", contacts: 5240 },
];

export default function AnalysisPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const authState = useAuth();
  const user = authState?.user ?? null;
  const claims = authState?.claims ?? null;
  const isLoaded = authState?.isLoaded ?? false;

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [selectedReport, setSelectedReport] = useState<string | null>("trend");

  // User profile
  useEffect(() => {
    if (!isLoaded || !claims?.user_id) return;

    const fetchAndCacheUserProfile = async () => {
      try {
        const cached = await indexedDb.users.get(claims.user_id);
        if (cached) return;

        const getUserProfile = httpsCallable<
          unknown,
          { profile: UserProfile | null }
        >(functions, "getUserProfile");
        const result = await getUserProfile();
        const profile = result.data?.profile;

        if (profile) {
          await indexedDb.users.put(profile);
        }
      } catch (error: any) {
        console.error("Failed to fetch/cache profile:", error.message);
      }
    };

    fetchAndCacheUserProfile();
  }, [isLoaded, claims]);

  const profile = useLiveQuery(
    () => (claims?.user_id ? indexedDb.users.get(claims.user_id) : undefined),
    [claims?.user_id]
  );

  const preferredName =
    profile?.preferred_name || user?.displayName || user?.email || "User";

  // Dynamic voter data
  const {
    data: voters = [],
    isLoading: votersLoading,
    error: votersError,
  } = useDynamicVoters(filters);

  const handleSubmit = (submittedFilters: FilterValues) => {
    setSelectedReport(null);
    setFilters(submittedFilters);
  };

  const quickReports = [
    {
      id: "trend",
      label: "Contact Trend (Default)",
    },
    {
      id: "noMailR",
      label: "Republicans Without Mail Ballots",
      filters: {
        modeledParty: "1 - Hard Republican,2 - Weak Republican",
        mailBallot: "false",
      },
    },
    {
      id: "swingHigh",
      label: "High-Turnout Swing Voters",
      filters: {
        modeledParty: "3 - Swing",
        turnout: "high",
      },
    },
    {
      id: "youngLow",
      label: "Young Low-Turnout Voters",
      filters: {
        ageGroup: "18-25",
        turnout: "low",
      },
    },
  ];

  const handleQuickReport = (
    reportId: string,
    filters?: Partial<FilterValues>
  ) => {
    setSelectedReport(reportId);
    if (filters) {
      handleSubmit(filters as FilterValues);
    } else {
      setFilters(null);
    }
  };

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
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Page Header */}
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        Reports & Analytics
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Welcome back, {preferredName}
      </Typography>

      {/* KPI Cards */}
      <Grid container spacing={3} mb={5}>
        {kpis.map((kpi) => (
          <Grid size={{ xs: 12, sm: 6 }} key={kpi.label}>
            <Card sx={{ height: "100%", boxShadow: 3, borderRadius: 3 }}>
              <CardContent>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  {kpi.label}
                </Typography>
                <Typography variant="h3" fontWeight="bold" color="primary">
                  {kpi.current.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Goal: {kpi.goal.toLocaleString()}
                </Typography>
                <Box sx={{ mt: 3 }}>
                  <LinearProgress
                    variant="determinate"
                    value={kpi.percentage}
                    sx={{
                      height: 12,
                      borderRadius: 6,
                      bgcolor: "grey.200",
                      "& .MuiLinearProgress-bar": {
                        bgcolor:
                          kpi.percentage >= 100
                            ? "success.main"
                            : "primary.main",
                        borderRadius: 6,
                      },
                    }}
                  />
                  <Typography
                    variant="body2"
                    align="right"
                    mt={1}
                    fontWeight="medium"
                  >
                    {kpi.percentage.toFixed(1)}%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Reports */}
      <Paper sx={{ p: 3, mb: 5, borderRadius: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">
          Quick Reports
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {quickReports.map((report) => (
            <Chip
              key={report.id}
              label={report.label}
              color={selectedReport === report.id ? "primary" : "default"}
              onClick={() => handleQuickReport(report.id, report.filters)}
              clickable
              sx={{ mb: 1 }}
            />
          ))}
        </Stack>
      </Paper>

      {/* Default Trend Report */}
      {selectedReport === "trend" && (
        <Paper sx={{ p: { xs: 3, sm: 4 }, mb: 5, borderRadius: 3 }}>
          <Typography variant="h5" gutterBottom fontWeight="bold">
            Voter Contact Trend
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Overall canvassing activity — Last 4 months
          </Typography>

          <BarChart
            dataset={trendData}
            xAxis={[{ scaleType: "band", dataKey: "month" }]}
            series={[
              {
                dataKey: "contacts",
                label: "Voters Contacted",
                color: theme.palette.primary.main,
              },
            ]}
            height={isMobile ? 300 : 380}
          />
        </Paper>
      )}

      {/* Custom Filtered Report */}
      {selectedReport !== "trend" && filters && (
        <Paper sx={{ p: { xs: 3, sm: 4 }, mb: 5, borderRadius: 3 }}>
          <Typography variant="h5" gutterBottom fontWeight="bold">
            Custom Report
          </Typography>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {voters.length.toLocaleString()} voters match your filters
          </Typography>

          {votersLoading ? (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <CircularProgress />
              <Typography mt={2}>Loading voter data...</Typography>
            </Box>
          ) : votersError ? (
            <Alert severity="error">Failed to load voter data</Alert>
          ) : (
            <Grid container spacing={4} mt={1}>
              {/* Party Breakdown */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom fontWeight="bold">
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
                      party: "Other",
                      count: voters.filter(
                        (v) => !["R", "D"].includes(v.party || "")
                      ).length,
                    },
                  ]}
                  xAxis={[{ scaleType: "band", dataKey: "party" }]}
                  series={[{ dataKey: "count", label: "Voters" }]}
                  height={isMobile ? 280 : 320}
                  colors={[theme.palette.primary.main, "#1976D2", "#888"]}
                />
              </Grid>

              {/* Age Distribution */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom fontWeight="bold">
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
                  height={isMobile ? 280 : 320}
                />
              </Grid>

              {/* Mail Ballot Status */}
              <Grid size={12}>
                <Typography variant="h6" gutterBottom fontWeight="bold">
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
                  height={280}
                  colors={[theme.palette.success.main, theme.palette.grey[500]]}
                />
              </Grid>
            </Grid>
          )}
        </Paper>
      )}

      {/* Filter Selector for Admins */}
      {(claims?.role === "state_admin" || claims?.role === "county_chair") && (
        <FilterSelector
          onSubmit={handleSubmit}
          isLoading={votersLoading}
          unrestrictedFilters={[
            "modeledParty",
            "turnout",
            "ageGroup",
            "mailBallot",
          ]}
        />
      )}

      {/* No Selection Message */}
      {!selectedReport && !filters && (
        <Box sx={{ textAlign: "center", py: 10 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Select a quick report or apply filters to view analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Use the chips above for popular targeting reports, or use the filter
            tool to create custom insights.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
