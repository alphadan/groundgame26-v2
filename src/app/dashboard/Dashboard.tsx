// src/app/dashboard/Dashboard.tsx
import React, { useState } from "react";
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
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { County, Area, CustomClaims } from "../../types";

const VOTER_TURNOUT_STATUS_SQL = (filters: {
  area?: string;
  precincts?: string[];
}) => {
  const schema = getCountySchema("PA-C-15"); // Force Chester for now
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

export default function Dashboard() {
  const { user, claims, isLoaded } = useAuth() as {
    user: User | null;
    claims: CustomClaims | null;
    isLoaded: boolean;
  };

  // 1. DEFAULT TO CHESTER COUNTY
  const [selectedCounty, setSelectedCounty] = useState<string>("pa-c-15");
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [selectedPrecinct, setSelectedPrecinct] = useState<string>("");

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

  const profile = useLiveQuery(
    () => indexedDb.users.get(user?.uid || ""),
    [user?.uid]
  );

  const preferredName =
    profile?.preferred_name || user?.displayName || user?.email;

  const extractPrecinctCode = (
    fullId: string | undefined
  ): string | undefined => {
    if (!fullId) return undefined;
    const match = fullId.match(/P-(\d+)$/);
    if (!match) return undefined;
    return String(parseInt(match[1], 10));
  };

  const rawArea =
    selectedArea !== "" ? extractAreaCode(selectedArea) : undefined;
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
  const sql = VOTER_TURNOUT_STATUS_SQL(filters);
  const { data: turnoutData, isLoading: turnoutLoading } = useVoters(sql);
  const turnoutStats = turnoutData?.[0] || {};

  const isLoadingCounties = isLoaded && counties === undefined;
  const isLoadingAreas = selectedCounty && areas === undefined;
  const isLoadingPrecincts = selectedArea && precincts === undefined;

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
      <Typography variant="body2" color="text.secondary" mb={3}>
        Last synced: {new Date().toLocaleString()}
      </Typography>

      {/* WELCOME SECTION */}
      <Paper sx={{ p: 4, mb: 4, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Welcome, {preferredName || user?.email}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Authorized Role:</strong>{" "}
          {(claims?.role || "unknown").replace("_", " ").toUpperCase()}
        </Typography>
      </Paper>

      {/* 2. CHARTS SECTION - REMOVED COLLAPSE */}
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

      {/* CONTROLS SECTION */}
      {claims?.role === "state_admin" && (
        <Paper sx={{ p: 4, mb: 4, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            State Administrator Control
          </Typography>
          {isLoadingCounties ? (
            <CircularProgress size={24} />
          ) : (
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Active Counties</InputLabel>
              <Select
                value={selectedCounty}
                label="Active Counties"
                onChange={handleCountyChange}
              >
                <MenuItem value="">
                  <em>Select a County</em>
                </MenuItem>
                {counties?.map((c: County) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {selectedCounty &&
            (isLoadingAreas ? (
              <CircularProgress size={24} sx={{ mb: 3 }} />
            ) : (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Active Areas</InputLabel>
                <Select
                  value={selectedArea}
                  label="Active Areas"
                  onChange={handleAreaChange}
                >
                  <MenuItem value="">
                    <em>All Areas</em>
                  </MenuItem>
                  {areas?.map((a: Area) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}

          {selectedArea &&
            (isLoadingPrecincts ? (
              <CircularProgress size={24} />
            ) : (
              <FormControl fullWidth>
                <InputLabel>Active Precincts</InputLabel>
                <Select
                  value={selectedPrecinct}
                  label="Active Precincts"
                  onChange={handlePrecinctChange}
                >
                  <MenuItem value="">
                    <em>All Precincts</em>
                  </MenuItem>
                  {precincts?.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name} ({p.precinct_code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}
        </Paper>
      )}

      {/* KPI INFO CHIPS */}
      <Paper sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Key Performance Indicators
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Applied Filters:
          </Typography>
          {selectedCounty && (
            <Chip
              label={`County: ${selectedCounty.toUpperCase()}`}
              size="small"
            />
          )}
          {selectedArea && (
            <Chip label={`Area: ${selectedArea}`} size="small" />
          )}
          {selectedPrecinct && (
            <Chip label={`Precinct: ${selectedPrecinct}`} size="small" />
          )}
        </Box>
      </Paper>
    </Box>
  );
}
