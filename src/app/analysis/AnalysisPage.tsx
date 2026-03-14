import React, { useState, useMemo } from "react";
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
  const { isLoaded } = useAuth();
  const [voterFilters, setVoterFilters] = useState<FilterValues | null>(null);

  const { data: voters = [], isLoading: votersLoading } =
    useDynamicVoters(voterFilters);

  // --- PRESETS ---
  const PRESET_FILTERS = [
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

    // Chart Data
    const parties = ["R", "D", "I"];
    const partyCounts = parties.map((p) => ({
      label: p === "I" ? "Other" : p,
      val: voters.filter((v) =>
        p === "I"
          ? !["R", "D"].includes(v.political_party)
          : v.political_party === p,
      ).length,
      mailIn: voters.filter(
        (v) =>
          (p === "I"
            ? !["R", "D"].includes(v.political_party)
            : v.political_party === p) && v.has_mail_ballot,
      ).length,
    }));

    // Top Streets Discovery (Extracting Street Name from Address)
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

  const applyQuickFilter = (preset: any) => setVoterFilters(preset);
  const isPresetActive = (preset: any) =>
    JSON.stringify(voterFilters) === JSON.stringify(preset);

  if (!isLoaded)
    return <CircularProgress sx={{ display: "block", mx: "auto", mt: 10 }} />;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1600, margin: "auto" }}>
      <Stack direction="row" spacing={2} alignItems="center" mb={4}>
        <AssessmentIcon color="primary" sx={{ fontSize: 40 }} />
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Voter Analysis & Discovery
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Deep-dive analysis of the BigQuery voter file
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={4}>
        {/* LEFT COLUMN: FILTERS (Fixed Width on Desktop) */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={3} sx={{ position: { md: "sticky" }, top: 24 }}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                <BoltIcon color="warning" />
                <Typography variant="h6" fontWeight="bold">
                  Quick Targets
                </Typography>
              </Stack>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {PRESET_FILTERS.map((preset) => (
                  <Chip
                    key={preset.label}
                    label={preset.label}
                    onClick={() => applyQuickFilter(preset.filters)}
                    color={
                      isPresetActive(preset.filters) ? "primary" : "default"
                    }
                    sx={{ borderRadius: 2, fontWeight: 600 }}
                  />
                ))}
              </Box>
            </Paper>

            <FilterSelector
              onSubmit={setVoterFilters}
              isLoading={votersLoading}
              demographicFilters={[
                "modeledParty",
                "turnout",
                "ageGroup",
                "mailBallot",
                "sex",
              ]}
            />
          </Stack>
        </Grid>

        {/* RIGHT COLUMN: WORKSPACE */}
        <Grid size={{ xs: 12, md: 6 }}>
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
                Apply a filter to generate voter segments
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={3}>
              <Alert
                icon={<InfoIcon sx={{ color: "info.main" }} />}
                severity="info"
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  bgcolor: "rgba(2, 136, 209, 0.05)",
                  borderColor: "info.light",
                  color: "info.dark",
                  fontWeight: 500,
                  "& .MuiAlert-icon": {
                    fontSize: 28,
                  },
                }}
              >
                Query complete: Found{" "}
                <strong>{voters.length.toLocaleString()}</strong> voters
                matching these criteria.
              </Alert>

              <Grid container spacing={3}>
                {/* Chart 1 */}
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
                      xAxis={[{ scaleType: "band", dataKey: "label" }]}
                      series={[
                        {
                          dataKey: "val",
                          label: "Voters",
                          color: theme.palette.primary.main,
                        },
                      ]}
                      height={300}
                    />
                  </Paper>
                </Grid>

                {/* Top Streets Table - High Insight Value */}
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
                              Street Name
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
                                  variant="outlined"
                                  color="primary"
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

              {/* Action Callout */}
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
                    Ready to mobilize this segment? Create a new Walk or Phone
                    list using these{" "}
                    <strong>{voters.length.toLocaleString()}</strong> records
                    with the following parameters:
                  </Typography>

                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {Object.entries(voterFilters)
                      .filter(([_, val]) => val !== undefined && val !== "")
                      .map(([key, val]) => (
                        <Chip
                          key={key}
                          label={`${key.replace(/([A-Z])/g, " $1").toLowerCase()}: ${val}`}
                          size="small"
                          sx={{
                            bgcolor: "success.main",
                            color: "white",
                            fontWeight: "bold",
                            textTransform: "capitalize",
                          }}
                        />
                      ))}
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
