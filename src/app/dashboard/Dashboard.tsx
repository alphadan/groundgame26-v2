// src/app/dashboard/Dashboard.tsx
import React, { useState, useMemo, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../lib/db";
import { getCountySchema } from "../../schemas";
import { useVoters } from "../../hooks/useVoters";
import { User } from "firebase/auth";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  SelectChangeEvent,
  Card,
  CardContent,
  Grid,
  Alert,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { County, Area } from "../../types";

const VOTER_TURNOUT_STATUS_SQL = (filters: {
  area?: string;
  precincts?: string[];
}) => {
  const schema = getCountySchema("PA-C-15");
  const { columns, tableName } = schema;

  let whereClause = "WHERE 1=1";
  if (filters.area)
    whereClause += ` AND ${columns.areaDistrict} = '${filters.area}'`;
  if (filters.precincts?.length)
    whereClause += ` AND ${columns.precinctCode} IN ('${filters.precincts.join(
      "','"
    )}')`;

  return `
    SELECT 
      COUNTIF(${columns.party} = 'R') AS total_r,
      COUNTIF(${columns.party} = 'D') AS total_d,
      COUNTIF(${columns.party} NOT IN ('R','D') AND ${columns.party} IS NOT NULL) AS total_nf,
      COUNTIF(${columns.hasMailBallot} = TRUE AND ${columns.party} = 'R') AS mail_r,
      COUNTIF(${columns.hasMailBallot} = TRUE AND ${columns.party} = 'D') AS mail_d,
      COUNTIF(${columns.hasMailBallot} = TRUE AND ${columns.party} NOT IN ('R','D') AND ${columns.party} IS NOT NULL) AS mail_nf,
      COUNTIF(${columns.mailBallotReturned} = TRUE AND ${columns.party} = 'R') AS returned_r,
      COUNTIF(${columns.mailBallotReturned} = TRUE AND ${columns.party} = 'D') AS returned_d,
      COUNTIF(${columns.mailBallotReturned} = TRUE AND ${columns.party} NOT IN ('R','D') AND ${columns.party} IS NOT NULL) AS returned_nf,
      COUNTIF(${columns.modeledParty} = '1 - Hard Republican') AS hard_r,
      COUNTIF(${columns.modeledParty} LIKE '2 - Weak%') AS weak_r,
      COUNTIF(${columns.modeledParty} = '3 - Swing') AS swing,
      COUNTIF(${columns.modeledParty} LIKE '4 - Weak%') AS weak_d,
      COUNTIF(${columns.modeledParty} = '5 - Hard Democrat') AS hard_d
    FROM \`${tableName}\`
    ${whereClause}
  `;
};

// === Safe Number Coercion ===
const safeNumber = (value: any): number => {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

// === Safe ID Extraction ===
const extractAreaCode = (fullId?: string): string | undefined => {
  if (!fullId) return undefined;
  const match = fullId.match(/A-(\d+)$/);
  return match ? match[1] : undefined;
};

const extractPrecinctCode = (fullId?: string): string | undefined => {
  if (!fullId) return undefined;
  const match = fullId.match(/P-(\d+)$/);
  return match ? String(parseInt(match[1], 10)) : undefined;
};

export default function Dashboard() {
  const authState = useAuth();

  const user = authState?.user ?? null;
  const claims = authState?.claims ?? null;
  const isLoaded = authState?.isLoaded ?? false;

  const [selectedCounty, setSelectedCounty] = useState<string>("PA-C-15");
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [selectedPrecinct, setSelectedPrecinct] = useState<string>("");

  // === Live Queries with DEBUG logs ===
  const counties = useLiveQuery(async () => {
    if (!isLoaded || !claims?.role || claims.role !== "state_admin") return [];
    const allCounties = await indexedDb.counties
      .filter((c: County) => c.active === true)
      .toArray();
    const allowedCounties = claims.counties || [];
    const filtered = allCounties.filter((c) => allowedCounties.includes(c.id));
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [claims, isLoaded]);

  const areas = useLiveQuery(async () => {
    if (!selectedCounty || !claims?.role || claims.role !== "state_admin")
      return [];
    const allAreas = await indexedDb.areas
      .filter((a: Area) => a.active === true)
      .toArray();
    const allowedAreas = claims.areas || [];
    const filtered = allAreas.filter((a) => allowedAreas.includes(a.id));
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedCounty, claims]);

  const precincts = useLiveQuery(async () => {
    if (!selectedArea || !claims?.role || claims.role !== "state_admin")
      return [];
    const allowedPrecincts = claims.precincts || [];
    if (allowedPrecincts.length > 0) {
      const filtered = await indexedDb.precincts
        .filter((p) => p.active === true && allowedPrecincts.includes(p.id))
        .toArray();
      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    const allPrecincts = await indexedDb.precincts
      .filter((p) => p.active === true && p.area_district === selectedArea)
      .toArray();
    return allPrecincts.sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedArea, claims]);

  const extractAreaCode = (fullId: string | undefined): string | undefined => {
    if (!fullId) return undefined;
    const match = fullId.match(/A-(\d+)$/);
    return match ? match[1] : undefined;
  };

  // === Profile ===
  const profile = useLiveQuery(
    () => (user?.uid ? indexedDb.users.get(user.uid) : undefined),
    [user?.uid]
  );

  const preferredName =
    profile?.preferred_name || user?.displayName || user?.email || "User";

  const extractPrecinctCode = (
    fullId: string | undefined
  ): string | undefined => {
    if (!fullId) return undefined;
    const match = fullId.match(/P-(\d+)$/);
    if (!match) return undefined;
    return String(parseInt(match[1], 10));
  };

  // === Build Filters ===
  const rawArea = selectedArea ? extractAreaCode(selectedArea) : undefined;

  const rawPrecincts =
    selectedPrecinct !== ""
      ? [extractPrecinctCode(selectedPrecinct)].filter(
          (code): code is string => !!code
        )
      : claims?.precincts
          ?.map(extractPrecinctCode)
          .filter((code): code is string => !!code) || [];
  const filters = {
    area: rawArea,
    precincts: rawPrecincts.length > 0 ? rawPrecincts : undefined,
  };

  // === Voter Data ===

  const sql = VOTER_TURNOUT_STATUS_SQL(filters);
  const { data: turnoutData, isLoading: turnoutLoading } = useVoters(sql);
  const turnoutStats = turnoutData?.[0] || {};

  const isLoadingCounties = isLoaded && counties === undefined;
  const isLoadingAreas = selectedCounty && areas === undefined;
  const isLoadingPrecincts = selectedArea && precincts === undefined;

  // === Handlers ===

  const handleCountyChange = (event: SelectChangeEvent) => {
    setSelectedCounty(event.target.value);
    setSelectedArea("");
    setSelectedPrecinct("");
  };

  const handleAreaChange = (event: SelectChangeEvent) => {
    setSelectedArea(event.target.value);
    setSelectedPrecinct("");
  };

  const handlePrecinctChange = (event: SelectChangeEvent) => {
    setSelectedPrecinct(event.target.value);
  };

  // === Voter Data ===

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

      {/* Charts */}
      {selectedCounty && (
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
              </Box>
            ) : (
              <Grid container spacing={3}>
                <Grid>
                  <Paper sx={{ p: 3, height: "100%" }}>
                    <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                      Total Voters by Party
                    </Typography>
                    <BarChart
                      dataset={[
                        { strength: "Hard R", count: turnoutStats.hard_r || 0 },
                        { strength: "Weak R", count: turnoutStats.weak_r || 0 },
                        { strength: "Swing", count: turnoutStats.swing || 0 },
                        { strength: "Weak D", count: turnoutStats.weak_d || 0 },
                        { strength: "Hard D", count: turnoutStats.hard_d || 0 },
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

                <Grid>
                  <Paper sx={{ p: 3, height: "100%" }}>
                    <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                      Mail Ballots by Party
                    </Typography>
                    <BarChart
                      dataset={[
                        { strength: "R", count: turnoutStats.mail_r || 0 },
                        { strength: "NF", count: turnoutStats.mail_nf || 0 },
                        { strength: "D", count: turnoutStats.mail_d || 0 },
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

                <Grid>
                  <Paper sx={{ p: 3, height: "100%" }}>
                    <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                      Modeled Party Strength
                    </Typography>
                    <BarChart
                      dataset={[
                        { strength: "1", count: turnoutStats.hard_r || 0 },
                        { strength: "2", count: turnoutStats.weak_r || 0 },
                        { strength: "3", count: turnoutStats.swing || 0 },
                        { strength: "4", count: turnoutStats.weak_d || 0 },
                        { strength: "5", count: turnoutStats.hard_d || 0 },
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
      )}

      {/* Admin Filters */}
      {claims?.role === "state_admin" && (
        <Paper sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>County</InputLabel>
            <Select value={selectedCounty} onChange={handleCountyChange}>
              {(counties ?? []).map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedCounty && (
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Area</InputLabel>
              <Select value={selectedArea} onChange={handleAreaChange}>
                <MenuItem value="">
                  <em>All Areas</em>
                </MenuItem>
                {(areas ?? []).map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {selectedArea && (
            <FormControl fullWidth>
              <InputLabel>Precinct</InputLabel>
              <Select value={selectedPrecinct} onChange={handlePrecinctChange}>
                <MenuItem value="">
                  <em>All Precincts</em>
                </MenuItem>
                {(precincts ?? []).map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name} ({p.precinct_code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Paper>
      )}
    </Box>
  );
}
