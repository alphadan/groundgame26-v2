// src/app/dashboard/Dashboard.tsx
import React, { useState, useMemo, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../lib/db";
import { useVoters } from "../../hooks/useVoters";
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
import { County, Area } from "../../types";

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

  const [selectedCounty, setSelectedCounty] = useState<string>("pa-c-15");
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [selectedPrecinct, setSelectedPrecinct] = useState<string>("");

  // === Live Queries ===
  const counties =
    useLiveQuery(() => {
      if (!isLoaded || !claims || claims.role !== "state_admin") return [];
      return indexedDb.counties
        .where("active")
        .equals(1)
        .filter((c: County) => (claims.counties ?? []).includes(c.id))
        .toArray();
    }, [isLoaded, claims]) ?? [];

  const areas =
    useLiveQuery(() => {
      if (!selectedCounty || !claims || claims.role !== "state_admin")
        return [];
      return indexedDb.areas
        .where("active")
        .equals(1)
        .filter((a: Area) => (claims.areas ?? []).includes(a.id))
        .toArray();
    }, [selectedCounty, claims]) ?? [];

  const precincts =
    useLiveQuery(() => {
      if (!selectedArea || !claims || claims.role !== "state_admin") return [];

      const allowedPrecincts = claims.precincts ?? [];
      if (allowedPrecincts.length > 0) {
        return indexedDb.precincts
          .where("id")
          .anyOf(allowedPrecincts)
          .and((p) => p.active)
          .toArray();
      }

      return indexedDb.precincts
        .where({ area_district: selectedArea, active: true })
        .toArray();
    }, [selectedArea, claims]) ?? [];

  // === Profile ===
  const profile = useLiveQuery(
    () => (user?.uid ? indexedDb.users.get(user.uid) : undefined),
    [user?.uid]
  );

  const preferredName =
    profile?.preferred_name || user?.displayName || user?.email || "User";

  // === Build Filters ===
  const rawArea = selectedArea ? extractAreaCode(selectedArea) : undefined;

  const rawPrecincts = useMemo<string[]>(() => {
    if (selectedPrecinct) {
      const code = extractPrecinctCode(selectedPrecinct);
      return code ? [code] : [];
    }
    return (claims?.precincts ?? [])
      .map(extractPrecinctCode)
      .filter((code: string | undefined): code is string => !!code);
  }, [selectedPrecinct, claims?.precincts]);

  // === Safe SQL Builder (no injection) ===
  const sqlQuery = useMemo<string>(() => {
    let query = `
      SELECT 
        COUNTIF(party = 'R') AS total_r,
        COUNTIF(party = 'D') AS total_d,
        COUNTIF(party NOT IN ('R','D') AND party IS NOT NULL) AS total_nf,
        COUNTIF(hasMailBallot = TRUE AND party = 'R') AS mail_r,
        COUNTIF(hasMailBallot = TRUE AND party = 'D') AS mail_d,
        COUNTIF(hasMailBallot = TRUE AND party NOT IN ('R','D') AND party IS NOT NULL) AS mail_nf,
        COUNTIF(mailBallotReturned = TRUE AND party = 'R') AS returned_r,
        COUNTIF(mailBallotReturned = TRUE AND party = 'D') AS returned_d,
        COUNTIF(mailBallotReturned = TRUE AND party NOT IN ('R','D') AND party IS NOT NULL) AS returned_nf,
        COUNTIF(modeledParty = '1 - Hard Republican') AS hard_r,
        COUNTIF(modeledParty LIKE '2 - Weak%') AS weak_r,
        COUNTIF(modeledParty = '3 - Swing') AS swing,
        COUNTIF(modeledParty LIKE '4 - Weak%') AS weak_d,
        COUNTIF(modeledParty = '5 - Hard Democrat') AS hard_d
      FROM \`voters_pa_c_15\`
      WHERE active = TRUE
    `;

    if (rawArea) {
      query += ` AND areaDistrict = '${rawArea}'`;
    }

    if (rawPrecincts.length > 0) {
      const escaped = rawPrecincts
        .map((p) => p.replace(/'/g, "''"))
        .join("','");
      query += ` AND precinctCode IN ('${escaped}')`;
    }

    return query.trim();
  }, [rawArea, rawPrecincts]);

  // === Voter Data ===
  const { data: turnoutData = [], isLoading: turnoutLoading } =
    useVoters(sqlQuery);

  const turnoutStats = turnoutData[0] ?? {};

  // === Loading States ===
  const isLoadingCounties =
    isLoaded && counties.length === 0 && claims?.role === "state_admin";
  const isLoadingAreas = !!selectedCounty && areas.length === 0;
  const isLoadingPrecincts = !!selectedArea && precincts.length === 0;

  // === Handlers ===
  const handleCountyChange = useCallback((event: SelectChangeEvent) => {
    setSelectedCounty(event.target.value);
    setSelectedArea("");
    setSelectedPrecinct("");
  }, []);

  const handleAreaChange = useCallback((event: SelectChangeEvent) => {
    setSelectedArea(event.target.value);
    setSelectedPrecinct("");
  }, []);

  const handlePrecinctChange = useCallback((event: SelectChangeEvent) => {
    setSelectedPrecinct(event.target.value);
  }, []);

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

      <Paper sx={{ p: 4, mb: 4, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Welcome, {preferredName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Role:</strong>{" "}
          {(claims?.role || "unknown").replace("_", " ").toUpperCase()}
        </Typography>
      </Paper>

      {selectedCounty && (
        <Card sx={{ mb: 4 }}>
          <Box p={2} sx={{ bgcolor: "#D3D3D3", color: "black" }}>
            <Typography variant="h6" fontWeight="bold">
              Voter Turnout Status — Detailed Breakdown
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
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                      Modeled Party Strength
                    </Typography>
                    <BarChart
                      dataset={[
                        {
                          strength: "Hard R",
                          count: safeNumber(turnoutStats.hard_r),
                        },
                        {
                          strength: "Weak R",
                          count: safeNumber(turnoutStats.weak_r),
                        },
                        {
                          strength: "Swing",
                          count: safeNumber(turnoutStats.swing),
                        },
                        {
                          strength: "Weak D",
                          count: safeNumber(turnoutStats.weak_d),
                        },
                        {
                          strength: "Hard D",
                          count: safeNumber(turnoutStats.hard_d),
                        },
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
                      height={300}
                      barLabel="value"
                    />
                  </Paper>
                </Grid>

                <Grid>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                      Mail Ballots by Party
                    </Typography>
                    <BarChart
                      dataset={[
                        {
                          strength: "R",
                          count: safeNumber(turnoutStats.mail_r),
                        },
                        {
                          strength: "NF",
                          count: safeNumber(turnoutStats.mail_nf),
                        },
                        {
                          strength: "D",
                          count: safeNumber(turnoutStats.mail_d),
                        },
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
                      series={[{ dataKey: "count", label: "Mail Ballots" }]}
                      height={300}
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
                        {
                          strength: "1",
                          count: safeNumber(turnoutStats.hard_r) || 0,
                        },
                        {
                          strength: "2",
                          count: safeNumber(turnoutStats.weak_r) || 0,
                        },
                        {
                          strength: "3",
                          count: safeNumber(turnoutStats.swing) || 0,
                        },
                        {
                          strength: "4",
                          count: safeNumber(turnoutStats.weak_d) || 0,
                        },
                        {
                          strength: "5",
                          count: safeNumber(turnoutStats.hard_d) || 0,
                        },
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

      {/* Admin Controls */}
      {claims?.role === "state_admin" && (
        <Paper sx={{ p: 4, mb: 4, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Administrator Filters
          </Typography>

          {isLoadingCounties ? (
            <CircularProgress size={24} />
          ) : (
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>County</InputLabel>
              <Select
                value={selectedCounty}
                label="County"
                onChange={handleCountyChange}
              >
                <MenuItem value="pa-c-15">Chester County</MenuItem>
              </Select>
            </FormControl>
          )}

          {selectedCounty &&
            (isLoadingAreas ? (
              <CircularProgress size={24} sx={{ mb: 3 }} />
            ) : (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Area</InputLabel>
                <Select
                  value={selectedArea}
                  label="Area"
                  onChange={handleAreaChange}
                >
                  <MenuItem value="">
                    <em>All Areas</em>
                  </MenuItem>
                  {areas.map((a) => (
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
                <InputLabel>Precinct</InputLabel>
                <Select
                  value={selectedPrecinct}
                  label="Precinct"
                  onChange={handlePrecinctChange}
                >
                  <MenuItem value="">
                    <em>All Precincts</em>
                  </MenuItem>
                  {precincts.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name} ({p.precinct_code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}
        </Paper>
      )}

      <Paper sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Active Filters
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
          {selectedCounty && <Chip label="County: Chester" />}
          {selectedArea && <Chip label={`Area: ${selectedArea}`} />}
          {selectedPrecinct && <Chip label={`Precinct: ${selectedPrecinct}`} />}
          {!selectedArea && !selectedPrecinct && (
            <Chip label="All Data" color="default" />
          )}
        </Box>
      </Paper>
    </Box>
  );
}
