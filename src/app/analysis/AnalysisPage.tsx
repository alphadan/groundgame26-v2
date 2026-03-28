import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { FilterValues } from "../../types";
import { useDynamicVoters } from "../../hooks/useDynamicVoters";
import { FilterSelector } from "../../components/FilterSelector";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Stack,
  Alert,
  AlertTitle,
  CircularProgress,
  useTheme,
  Divider,
  Chip,
  Button,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import InfoIcon from "@mui/icons-material/Info";
import BoltIcon from "@mui/icons-material/Bolt";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import AssessmentIcon from "@mui/icons-material/Assessment";
import MapIcon from "@mui/icons-material/Map";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";

export default function AnalysisPage() {
  const theme = useTheme();

  // 1. FIX: Destructure userProfile and isLoaded
  const { isLoaded, userProfile } = useAuth();

  // 2. FIX: Add missing state for SRD selection
  const [selectedSRD, setSelectedSRD] = useState<string>("");
  const [voterFilters, setVoterFilters] = useState<FilterValues | null>(null);

  const { data: voters = [], isLoading: votersLoading } =
    useDynamicVoters(voterFilters);

  // 3. AUTO-SELECT LOGIC: Handles the "District Leader" login flow
  useEffect(() => {
    // If user is locked to one district, auto-select it
    if (userProfile?.access?.districts?.length === 1 && !selectedSRD) {
      const autoDist = userProfile.access.districts[0];
      setSelectedSRD(autoDist);
      // Note: FilterSelector's react-hook-form handles 'setValue' internally
      // when you pass it the 'onSubmit' callback or via its own state.
    }
  }, [userProfile, selectedSRD]);

  // --- PRESETS ---
  const PRESET_FILTERS = [
    {
      label: "24-25 Drop-off Voters",
      icon: "📉",
      filters: { dropoffOnly: true },
    },
    {
      label: "GOP Low Turnout",
      icon: "⚠️",
      filters: { party: "R", turnout: "1" },
    },
    {
      label: "Potential Walk List",
      icon: "🚶",
      filters: { modeledParty: "3 - Swing", mailBallot: "false" },
    },
    {
      label: "VBM Push",
      icon: "📩",
      filters: { party: "R", turnout: "4", mailBallot: "false" },
    },
    {
      label: "Young GOP",
      icon: "🎓",
      filters: { party: "R", ageGroup: "18-25" },
    },
  ];

  // --- DATA TRANSFORMATION ---
  const analysis = useMemo(() => {
    if (!voters.length) return null;

    const partyConfig = [
      { code: "R", label: "Republican", color: "#B22234" },
      { code: "D", label: "Democrat", color: "#00AEF3" },
      { code: "I", label: "Other", color: "#D3D3D3" },
    ];

    const partyCounts = partyConfig.map((p) => ({
      label: p.label,
      val: voters.filter((v) =>
        p.code === "I"
          ? !["R", "D"].includes(v.political_party)
          : v.political_party === p.code,
      ).length,
      color: p.color, // Add the specific color to the dataset
    }));

    const streetMap: Record<string, number> = {};
    voters.forEach((v) => {
      const street = v.address?.replace(/^\d+\s+/, "").trim() || "Unknown";
      streetMap[street] = (streetMap[street] || 0) + 1;
    });

    const topStreets = Object.entries(streetMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { partyCounts, topStreets };
  }, [voters]);

  const applyQuickFilter = (presetFilters: any) => {
    setVoterFilters((prev) => {
      // 1. Keep the existing geographic context (Precinct, Area, County)
      const geoContext = {
        precinct: prev?.precinct,
        area: prev?.area,
        county: prev?.county,
        precinct_id: prev?.precinct_id,
      };

      // 2. If we are clicking a preset that is already active,
      // we reset to just the geographic context (clears the preset)
      if (isPresetActive(presetFilters)) {
        return geoContext;
      }

      // 3. Otherwise, merge the preset into the current geography
      return {
        ...geoContext,
        ...presetFilters,
      };
    });
  };

  useEffect(() => {
    if (analysis?.partyCounts) {
      console.log(
        "📊 Chart Dataset Keys:",
        analysis.partyCounts.map((d) => d.label),
      );
      console.log("📊 Full Dataset Object:", analysis.partyCounts);
    }
  }, [analysis]);

  const isPresetActive = (preset: any) =>
    voterFilters &&
    Object.keys(preset).every(
      (key) => voterFilters[key as keyof FilterValues] === preset[key],
    );

  if (!isLoaded)
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "80vh",
        }}
      >
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1600, margin: "auto" }}>
      <Stack direction="row" spacing={2} alignItems="center" mb={4}>
        <AssessmentIcon color="primary" sx={{ fontSize: 40 }} />
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Voter Analysis & Discovery
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Deep-dive analysis of the BigQuery voter file for District Leaders
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={4}>
        {/* LEFT COLUMN: FILTERS */}
        <Grid size={{ xs: 12, md: 6, lg: 6 }}>
          <Stack spacing={3} sx={{ position: { md: "sticky" }, top: 24 }}>
            {/* FilterSelector now receives the current SRD state */}
            <FilterSelector
              onSubmit={setVoterFilters}
              isLoading={votersLoading}
              initialSrd={selectedSRD}
              demographicFilters={[
                "party",
                "turnout",
                "ageGroup",
                "mailBallot",
                "sex",
              ]}
            />
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                <BoltIcon color="warning" />
                <Typography variant="h6" fontWeight="bold">
                  Quick Targets
                </Typography>
              </Stack>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {PRESET_FILTERS.map((preset) => {
                  const active = isPresetActive(preset.filters);
                  return (
                    <Chip
                      key={preset.label}
                      label={preset.label}
                      onClick={() => applyQuickFilter(preset.filters)}
                      // Visual indicator that it's active
                      color={active ? "primary" : "default"}
                      variant={active ? "filled" : "outlined"}
                      // Add a delete icon if active to clear it
                      onDelete={
                        active
                          ? () => applyQuickFilter(preset.filters)
                          : undefined
                      }
                      sx={{
                        borderRadius: 2,
                        fontWeight: 600,
                        transition: "all 0.2s",
                      }}
                    />
                  );
                })}
              </Box>
            </Paper>
          </Stack>
        </Grid>

        {/* RIGHT COLUMN: WORKSPACE */}
        <Grid size={{ xs: 12, md: 6, lg: 6 }}>
          {/* Inside the Workspace section of AnalysisPage.tsx */}
          {voterFilters?.dropoffOnly && (
            <Alert
              severity="info"
              variant="outlined"
              icon={<RocketLaunchIcon />}
              sx={{
                mb: 2,
                borderRadius: 3,
                bgcolor: "rgba(2, 136, 209, 0.03)",
                borderColor: "info.light",
              }}
            >
              <AlertTitle sx={{ fontWeight: "bold" }}>
                2026 Mobilization Target:{" "}
                {voterFilters.precinct?.name
                  ? `Precinct ${voterFilters.precinct.name}`
                  : voterFilters.area?.name
                    ? `Area ${voterFilters.area.name}`
                    : "District Wide"}
              </AlertTitle>
              <Typography variant="body2">
                Found <strong>{voters.length.toLocaleString()}</strong>{" "}
                Republicans in this area who vote in Presidential cycles but
                skipped last year.
              </Typography>
            </Alert>
          )}
          {!voterFilters ? (
            <Paper
              sx={{
                p: 10,
                textAlign: "center",
                borderRadius: 4,
                border: "2px dashed",
                borderColor: "divider",
              }}
            >
              <FilterAltIcon
                sx={{ fontSize: 80, color: "text.disabled", mb: 2 }}
              />
              <Typography variant="h5" color="text.secondary" fontWeight="bold">
                Ready for Analysis
              </Typography>
              <Typography color="text.disabled">
                Select a District and apply filters to analyze voter segments
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={3}>
              <Alert
                icon={<InfoIcon sx={{ color: "info.main" }} />}
                severity="info"
                variant="outlined"
                sx={{ borderRadius: 3, bgcolor: "background.paper" }}
              >
                Query complete: Found{" "}
                <strong>{voters.length.toLocaleString()}</strong> voters.
              </Alert>

              <Grid container spacing={3}>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Paper sx={{ p: 3, borderRadius: 3 }}>
                    <Typography
                      variant="subtitle2"
                      gutterBottom
                      fontWeight="bold"
                    >
                      Party Distribution
                    </Typography>
                    <BarChart
                      dataset={analysis?.partyCounts || []}
                      // 1. Remove the top-level colors array to avoid confusion
                      xAxis={[
                        {
                          scaleType: "band",
                          dataKey: "label",
                          categoryGapRatio: 0.3,
                          label: "Political Affiliation",
                          // 2. MOVE COLORMAP HERE
                          colorMap: {
                            type: "ordinal",
                            values: ["Republican", "Democrat", "Other"],
                            colors: [
                              theme.palette.voter.hardR,
                              theme.palette.voter.hardD,
                              theme.palette.voter.swing,
                            ],
                          },
                        },
                      ]}
                      series={[
                        {
                          dataKey: "val",
                          label: "Voter Count",
                          // 3. REMOVE colorMap from here
                        },
                      ]}
                      height={300}
                      sx={{
                        "& .MuiChartsSurface-root": {
                          fill: "transparent",
                        },
                      }}
                      slotProps={{
                        legend: {
                          sx: {
                            display: "none",
                          },
                        },
                      }}
                    />
                  </Paper>
                </Grid>

                <Grid size={{ xs: 12, lg: 6 }}>
                  <Paper sx={{ p: 3, borderRadius: 3, height: "100%" }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      mb={2}
                    >
                      <MapIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle2" fontWeight="bold">
                        High Density Streets
                      </Typography>
                    </Stack>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: "bold" }}>
                              Street
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ fontWeight: "bold" }}
                            >
                              Count
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {analysis?.topStreets.map(([name, count]) => (
                            <TableRow key={name}>
                              <TableCell>{name}</TableCell>
                              <TableCell align="right">
                                <Chip
                                  label={count}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Grid>
              </Grid>

              {/* ACTION ALERT */}
              {voterFilters && (
                <Alert
                  icon={<RocketLaunchIcon sx={{ color: "success.main" }} />}
                  severity="success"
                  variant="outlined"
                  sx={{
                    p: 3,
                    borderRadius: 4,
                    bgcolor: "rgba(46, 125, 50, 0.05)", // Success green tint
                    borderColor: "success.light",
                    borderWidth: 2, // Slightly thicker to denote action
                    "& .MuiAlert-message": { width: "100%" },
                  }}
                >
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    color="success.dark"
                    gutterBottom
                  >
                    Generate Outreach List
                  </Typography>
                  <Typography
                    variant="body1"
                    color="success.dark"
                    sx={{ mb: 2 }}
                  >
                    Create a new Walk or Phone list using these{" "}
                    <strong>{voters.length.toLocaleString()}</strong> records
                    with the following parameters:
                  </Typography>

                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {Object.entries(voterFilters)
                      .filter(
                        ([_, val]) =>
                          val !== undefined && val !== null && val !== "",
                      )
                      .map(([key, val]) => {
                        // If the value is our GeoPayload object, show the .name
                        const displayValue =
                          val && typeof val === "object" && "name" in val
                            ? val.name
                            : String(val);

                        return (
                          <Chip
                            key={key}
                            label={`${key.replace(/([A-Z])/g, " $1").toLowerCase()}: ${displayValue}`}
                            size="small"
                            sx={{
                              bgcolor: "success.main",
                              color: "white",
                              fontWeight: "bold",
                            }}
                          />
                        );
                      })}
                  </Stack>
                </Alert>
              )}
            </Stack>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
