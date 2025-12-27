// src/app/dashboard/Dashboard.tsx
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db as indexedDb } from "../../lib/db"; // ← ADD THIS LINE
import { useLiveQuery } from "dexie-react-hooks";
import { useVoterStats, type VoterStats } from "../../hooks/useVoterStats";
import { FilterSelector } from "../../components/FilterSelector";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Card,
  CardContent,
  Grid,
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

  // === Profile ===
  // === Profile (from IndexedDB) ===
  const profile = useLiveQuery(
    () => (user?.uid ? indexedDb.users.get(user.uid) : undefined),
    [user?.uid]
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

  // === Voter Data (only runs when filters submitted) ===
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

  const handleSubmit = (submittedFilters: FilterValues) => {
    setFilters(submittedFilters);
    setIsSubmitting(true);
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
        Dashboard
      </Typography>

      <Paper sx={{ p: 4, mb: 4 }}>
        <Typography variant="h6">Welcome, {preferredName}</Typography>
        <Typography>
          Role: {(claims?.role || "unknown").toUpperCase()}
        </Typography>
      </Paper>

      {/* === Filter Selector with Submit === */}
      {claims?.role === "state_admin" && (
        <FilterSelector
          onSubmit={handleSubmit}
          isLoading={isSubmitting && turnoutLoading}
          unrestrictedFilters={[]} 
        />
      )}

      {/* === Charts === */}
      <Card sx={{ mb: 4 }}>
        <Box p={2} sx={{ bgcolor: "#D3D3D3", color: "black" }}>
          <Typography variant="h6" fontWeight="bold">
            Voter Turnout Status — Detailed Breakdown
          </Typography>
          <Typography variant="body2">
            Party • Mail Ballots • Modeled Strength
          </Typography>
        </Box>
        <CardContent sx={{ pt: 3 }}>
          {turnoutLoading ? (
            <Box textAlign="center" py={8}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary" mt={2}>
                Loading stats for selected filters...
              </Typography>
            </Box>
          ) : filters === null ? (
            <Box textAlign="center" py={8}>
              <Typography variant="body1" color="text.secondary">
                Use the filters above and click "Submit Query" to view stats.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper sx={{ p: 3, height: "100%" }}>
                  <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                    Total Voters by Party
                  </Typography>
                  <BarChart
                    dataset={[
                      { strength: "Hard R", count: turnoutStats.hard_r ?? 0 },
                      { strength: "Weak R", count: turnoutStats.weak_r ?? 0 },
                      { strength: "Swing", count: turnoutStats.swing ?? 0 },
                      { strength: "Weak D", count: turnoutStats.weak_d ?? 0 },
                      { strength: "Hard D", count: turnoutStats.hard_d ?? 0 },
                    ]}
                    xAxis={[
                      {
                        scaleType: "band",
                        dataKey: "strength",
                        colorMap: {
                          type: "ordinal",
                          values: [
                            "Hard R",
                            "Weak R",
                            "Swing",
                            "Weak D",
                            "Hard D",
                          ],
                          colors: [
                            "#B22234",
                            "#FF6347",
                            "#9370DB",
                            "#6495ED",
                            "#1E90FF",
                          ],
                        },
                      },
                    ]}
                    series={[{ dataKey: "count", label: "Voters" }]}
                    height={280}
                    barLabel="value"
                  />
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Paper sx={{ p: 3, height: "100%" }}>
                  <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                    Mail Ballots by Party
                  </Typography>
                  <BarChart
                    dataset={[
                      { strength: "R", count: turnoutStats.mail_r ?? 0 },
                      { strength: "NF", count: turnoutStats.mail_nf ?? 0 },
                      { strength: "D", count: turnoutStats.mail_d ?? 0 },
                    ]}
                    xAxis={[
                      {
                        scaleType: "band",
                        dataKey: "strength",
                        colorMap: {
                          type: "ordinal",
                          values: ["R", "NF", "D"],
                          colors: ["#B22234", "#9370DB", "#1E90FF"],
                        },
                      },
                    ]}
                    series={[{ dataKey: "count", label: "Voters" }]}
                    height={280}
                    barLabel="value"
                  />
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Paper sx={{ p: 3, height: "100%" }}>
                  <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                    Modeled Party Strength
                  </Typography>
                  <BarChart
                    dataset={[
                      { strength: "1", count: turnoutStats.hard_r ?? 0 },
                      { strength: "2", count: turnoutStats.weak_r ?? 0 },
                      { strength: "3", count: turnoutStats.swing ?? 0 },
                      { strength: "4", count: turnoutStats.weak_d ?? 0 },
                      { strength: "5", count: turnoutStats.hard_d ?? 0 },
                    ]}
                    xAxis={[
                      {
                        scaleType: "band",
                        dataKey: "strength",
                        colorMap: {
                          type: "ordinal",
                          values: ["1", "2", "3", "4", "5"],
                          colors: [
                            "#FF4500",
                            "#FFA500",
                            "#FFD700",
                            "#32CD32",
                            "#228B22",
                          ],
                        },
                      },
                    ]}
                    series={[{ dataKey: "count", label: "Strength" }]}
                    height={280}
                    barLabel="value"
                  />
                </Paper>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
