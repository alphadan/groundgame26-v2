import React, { useState, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDynamicVoters } from "../../hooks/useDynamicVoters";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
import { useDncMap } from "../../hooks/useDncMap";
import { awardPoints } from "../../services/rewardsService";
import { logEvent } from "../../lib/analytics";
import { RewardAction } from "../../services/rewardsService";

import {
  Box,
  Typography,
  Paper,
  IconButton,
  Stack,
  CircularProgress,
  Alert,
  Button,
  useTheme,
  Snackbar,
  Chip,
  Divider,
  useMediaQuery,
} from "@mui/material";
import { Download as DownloadIcon } from "@mui/icons-material";
import DoorbellIcon from "@mui/icons-material/Doorbell";
import BoltIcon from "@mui/icons-material/Bolt";
import ApartmentIcon from "@mui/icons-material/Apartment";
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import MapIcon from "@mui/icons-material/Map";
import { FilterValues } from "../../types";
import {
  DataGrid,
  GridColDef,
  GridToolbarContainer,
  GridToolbarQuickFilter,
  GridRenderCellParams,
} from "@mui/x-data-grid";

interface Voter {
  voter_id: string;
  full_name?: string;
  age?: number | string;
  party?: string;
  address?: string;
  address_num?: number;
  precinct?: string;
  phone_mobile?: string;
  phone_home?: string;
  email?: string;
  city?: string;
  zip_code?: number | string;
  turnout_score_primary?: number;
}

const PURPLE_MAIN = "#673ab7";

export default function WalkListPage() {
  const theme = useTheme();
  // Using 'md' as the threshold for switching to mobile cards
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { user, isLoaded: authLoaded } = useAuth();
  const dncMap = useDncMap();

  const [dbFilters, setDbFilters] = useState<FilterValues | null>(null);
  const [activeSubFilter, setActiveSubFilter] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const {
    data: rawVoters = [],
    isLoading,
    error,
  } = useDynamicVoters(dbFilters);

  // --- 1. REFINEMENT & SORTING LOGIC ---
  const filteredVoters = useMemo(() => {
    let result = [...rawVoters];

    if (activeSubFilter === "communal") {
      const addressCounts: Record<string, number> = {};
      result.forEach((v) => {
        const addr = v.address || "Unknown";
        addressCounts[addr] = (addressCounts[addr] || 0) + 1;
      });
      result = result.filter((v) => addressCounts[v.address || ""] > 8);
    }

    if (activeSubFilter === "high_primary") {
      result = result.filter(
        (v) =>
          v.party === "R" && [3, 4].includes(Number(v.turnout_score_primary)),
      );
    }

    // Group by Street, then sort by Address Number (Walking Order)
    return result.sort((a, b) => {
      const streetA = (a.address || "").replace(/^[0-9]+\s+/, "").toLowerCase();
      const streetB = (b.address || "").replace(/^[0-9]+\s+/, "").toLowerCase();
      if (streetA !== streetB) return streetA.localeCompare(streetB);
      return (a.address_num || 0) - (b.address_num || 0);
    });
  }, [rawVoters, activeSubFilter]);

  // --- 2. ACTION HANDLERS ---
  const toggleSubFilter = (id: string) => {
    setActiveSubFilter((prev) => (prev === id ? null : id));
  };

  const handleRewardAction = async (
    action: RewardAction,
    label: string,
    row: Voter,
  ) => {
    if (!user?.uid) return;
    try {
      await awardPoints(user.uid, action, 1);
      setSnackbarMessage(`Logged ${label} for ${row.full_name}`);
      setSnackbarOpen(true);
      logEvent("voter_interaction", { action, voter_id: row.voter_id });
    } catch (e) {
      console.error(e);
    }
  };

  const openInMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  };

  // --- 3. DESKTOP COLUMNS ---
  const columns: GridColDef<Voter>[] = useMemo(
    () => [
      {
        field: "address_num",
        headerName: "#",
        width: 70,
        type: "number",
        renderCell: ({ row }) => (
          <Typography variant="body2" color="text.secondary">
            {row.address_num}
          </Typography>
        ),
      },
      {
        field: "address",
        headerName: "Household / Address",
        flex: 1.5,
        minWidth: 220,
        renderCell: (params: GridRenderCellParams<Voter>) => {
          const { row, api, id } = params;
          const rowIndex = api.getRowIndexRelativeToVisibleRows(id);
          const prevRowId =
            rowIndex > 0 ? api.getRowIdFromRowIndex(rowIndex - 1) : null;
          const prevRow = prevRowId
            ? (api.getRowModels().get(prevRowId) as any)
            : null;
          const isNewHouse = !prevRow || prevRow.address !== row.address;

          return (
            <Box sx={{ py: 1 }}>
              {isNewHouse ? (
                <Typography
                  variant="body2"
                  fontWeight="900"
                  color="primary.main"
                >
                  {row.address}
                </Typography>
              ) : (
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ pl: 2, fontStyle: "italic" }}
                >
                  (Same Household)
                </Typography>
              )}
            </Box>
          );
        },
      },
      {
        field: "full_name",
        headerName: "Voter Name",
        flex: 1.2,
        minWidth: 180,
        renderCell: ({ row }) => (
          <Typography
            variant="body2"
            color={dncMap.has(row.voter_id) ? "error.main" : "text.primary"}
          >
            {row.full_name}
          </Typography>
        ),
      },
      {
        field: "age",
        headerName: "Age",
        width: 70,
        align: "center",
        renderCell: ({ value }) => (
          <Chip
            label={value || "U"}
            size="small"
            variant="outlined"
            sx={{ fontWeight: "bold" }}
          />
        ),
      },
      {
        field: "party",
        headerName: "Party",
        width: 80,
        renderCell: ({ value }) => (
          <Chip
            label={value || "U"}
            size="small"
            sx={{
              fontWeight: "bold",
              bgcolor:
                value === "R"
                  ? "error.light"
                  : value === "D"
                    ? "info.light"
                    : "grey.400",
              color: "white",
            }}
          />
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 150,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              size="small"
              sx={{ color: PURPLE_MAIN }}
              onClick={() => handleRewardAction("walk", "Visit", row)}
            >
              <DoorbellIcon fontSize="small" />
            </IconButton>
            <Divider orientation="vertical" flexItem />
            <VoterNotes
              voterId={row.voter_id}
              fullName={row.full_name}
              address={row.address}
            />
          </Stack>
        ),
      },
    ],
    [dncMap, theme.palette],
  );

  // --- 4. MOBILE CARD VIEW ---
  const VoterCard = ({ row }: { row: Voter }) => (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 2,
        borderLeft: `6px solid ${row.party === "R" ? theme.palette.error.main : row.party === "D" ? theme.palette.info.main : "grey"}`,
      }}
    >
      <Stack spacing={1.5}>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box>
            <Typography
              variant="subtitle1"
              fontWeight="bold"
              color={dncMap.has(row.voter_id) ? "error.main" : "text.primary"}
            >
              {row.full_name}
            </Typography>
            <Button
              size="small"
              startIcon={<MapIcon fontSize="small" />}
              onClick={() => openInMaps(row.address || "")}
              sx={{ p: 0, textTransform: "none", fontWeight: 800 }}
            >
              {row.address}
            </Button>
          </Box>
          <Stack direction="row" spacing={0.5}>
            <Chip label={row.age || "?"} size="small" variant="outlined" />
            <Chip
              label={row.party || "U"}
              size="small"
              color={
                row.party === "R"
                  ? "error"
                  : row.party === "D"
                    ? "info"
                    : "default"
              }
            />
          </Stack>
        </Box>

        <Divider />

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            ID: {row.voter_id} • Precinct: {row.precinct}
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <IconButton
              sx={{ color: PURPLE_MAIN, border: `1px solid ${PURPLE_MAIN}` }}
              onClick={() => handleRewardAction("walk", "Visit", row)}
            >
              <DoorbellIcon />
            </IconButton>
            <VoterNotes
              voterId={row.voter_id}
              fullName={row.full_name}
              address={row.address}
            />
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );

  if (!authLoaded)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1400, margin: "auto" }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom color="primary">
        Household Walk List
      </Typography>

      <FilterSelector
        onSubmit={(f) => setDbFilters(f)}
        isLoading={isLoading}
        demographicFilters={[
          "zipCode",
          "street",
          "party",
          "turnout",
          "ageGroup",
          "mailBallot",
        ]}
      />

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Error loading voter data.
        </Alert>
      )}

      {dbFilters && (
        <Box sx={{ mt: 4 }}>
          {/* Sub-Filter Bar */}
          <Paper
            sx={{
              p: 2,
              mb: 1,
              bgcolor: "grey.50",
              borderRadius: isMobile ? 2 : "12px 12px 0 0",
            }}
          >
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              flexWrap="wrap"
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <BoltIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" fontWeight="bold">
                  Refine:
                </Typography>
              </Stack>
              <Chip
                label="Communal (8+)"
                onClick={() => toggleSubFilter("communal")}
                color={activeSubFilter === "communal" ? "primary" : "default"}
              />
              <Chip
                label="High Primary GOP"
                onClick={() => toggleSubFilter("high_primary")}
                color={
                  activeSubFilter === "high_primary" ? "primary" : "default"
                }
              />
              {activeSubFilter && (
                <Button size="small" onClick={() => setActiveSubFilter(null)}>
                  Reset
                </Button>
              )}
            </Stack>
          </Paper>

          {isMobile ? (
            // MOBILE RESPONSIVE FOLDED VIEW

            <Box sx={{ mt: 2 }}>
              {filteredVoters.map((v) => (
                <VoterCard key={v.voter_id} row={v} />
              ))}
            </Box>
          ) : (
            // DESKTOP DATAGRID VIEW

            <Paper
              elevation={3}
              sx={{
                height: 800,
                borderRadius: "0 0 12px 12px",
                overflow: "hidden",
              }}
            >
              <DataGrid
                rows={filteredVoters}
                getRowId={(row) => row.voter_id}
                columns={columns}
                rowHeight={75}
                loading={isLoading}
                disableRowSelectionOnClick
                slots={{
                  toolbar: () => (
                    <GridToolbarContainer
                      sx={{ p: 2, justifyContent: "space-between" }}
                    >
                      <Typography variant="body2">
                        <strong>{filteredVoters.length}</strong> Results
                      </Typography>
                      <GridToolbarQuickFilter />
                    </GridToolbarContainer>
                  ),
                }}
              />
            </Paper>
          )}
        </Box>
      )}

      {!dbFilters && (
        <Paper
          sx={{
            mt: 4,
            p: 10,
            textAlign: "center",
            border: "2px dashed #ccc",
            bgcolor: "#fafafa",
          }}
        >
          <Typography color="text.secondary">
            Apply geographic filters to generate your walking list.
          </Typography>
        </Paper>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert severity="success" variant="filled">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
