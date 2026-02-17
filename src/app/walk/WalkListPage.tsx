import React, { useState, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDynamicVoters } from "../../hooks/useDynamicVoters";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
import { useDncMap } from "../../hooks/useDncMap";
import { awardPoints } from "../../services/rewardsService";
import { logEvent } from "../../lib/analytics";

import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
  Alert,
  Button,
  useTheme,
  Snackbar,
  Chip,
  Divider,
  useMediaQuery,
  Avatar,
} from "@mui/material";
import {
  Phone,
  Message,
  Download as DownloadIcon,
  MailOutline,
  Block,
  Home as HomeIcon,
} from "@mui/icons-material";
import DoorbellIcon from "@mui/icons-material/Doorbell";
import BoltIcon from "@mui/icons-material/Bolt";
import ApartmentIcon from "@mui/icons-material/Apartment";
import HowToVoteIcon from "@mui/icons-material/HowToVote";
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
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user, isLoaded: authLoaded } = useAuth();
  const dncMap = useDncMap();

  // 1. Primary DB Query State
  const [dbFilters, setDbFilters] = useState<FilterValues | null>(null);

  // 2. Client-Side Sub-Filter State
  const [activeSubFilter, setActiveSubFilter] = useState<string | null>(null);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const {
    data: rawVoters = [],
    isLoading,
    error,
  } = useDynamicVoters(dbFilters);

  // --- 3. REFINEMENT LOGIC (Memoized for Performance) ---
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

    // Sort by address to maintain household grouping
    return result.sort((a, b) =>
      (a.address || "").localeCompare(b.address || ""),
    );
  }, [rawVoters, activeSubFilter]);

  // --- 4. ACTION HANDLERS ---
  const toggleSubFilter = (id: string) => {
    setActiveSubFilter((prev) => (prev === id ? null : id));
  };

  const handleRewardAction = async (
    action: string,
    label: string,
    row: Voter,
  ) => {
    if (!user?.uid) return;
    try {
      await awardPoints(user.uid, action, 1);
      setSnackbarMessage(`Logged ${label} for ${row.full_name}`);
      setSnackbarOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  // --- 5. GRID COLUMNS ---
  const columns: GridColDef<Voter>[] = useMemo(
    () => [
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
                  ? theme.palette.error.light
                  : value === "D"
                    ? theme.palette.info.light
                    : "grey.300",
              color: "white",
            }}
          />
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 180,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton
              size="small"
              sx={{ color: PURPLE_MAIN }}
              onClick={() => handleRewardAction("walk", "Visit", row)}
            >
              <DoorbellIcon fontSize="small" />
            </IconButton>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
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

  if (!authLoaded)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom color="primary">
        Household Walk List
      </Typography>

      {/* 1. PRIMARY FILTER SELECTOR */}
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
          Error loading list. Please refresh.
        </Alert>
      )}

      {dbFilters && (
        <Box sx={{ mt: 4 }}>
          {/* 2. SUB-FILTER PRESETS (Placed just above DataGrid) */}
          <Paper
            sx={{
              p: 2,
              mb: 1,
              bgcolor: "grey.50",
              borderRadius: "12px 12px 0 0",
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <BoltIcon color="primary" fontSize="small" />
                <Typography
                  variant="subtitle2"
                  fontWeight="bold"
                  color="text.secondary"
                >
                  Refine View:
                </Typography>
              </Stack>
              <Chip
                label="Communal Hubs (8+)"
                size="small"
                icon={<ApartmentIcon sx={{ fontSize: "1rem !important" }} />}
                onClick={() => toggleSubFilter("communal")}
                color={activeSubFilter === "communal" ? "primary" : "default"}
                variant={activeSubFilter === "communal" ? "filled" : "outlined"}
                sx={{ fontWeight: "bold" }}
              />
              <Chip
                label="High Primary GOP"
                size="small"
                icon={<HowToVoteIcon sx={{ fontSize: "1rem !important" }} />}
                onClick={() => toggleSubFilter("high_primary")}
                color={
                  activeSubFilter === "high_primary" ? "primary" : "default"
                }
                variant={
                  activeSubFilter === "high_primary" ? "filled" : "outlined"
                }
                sx={{ fontWeight: "bold" }}
              />
              {activeSubFilter && (
                <Button
                  size="small"
                  onClick={() => setActiveSubFilter(null)}
                  sx={{ ml: "auto", fontWeight: "bold" }}
                  color="inherit"
                >
                  Reset Refinement
                </Button>
              )}
            </Stack>
          </Paper>

          {/* 3. MAIN DATAGRID */}
          <Paper
            elevation={3}
            sx={{
              height: 800,
              borderRadius: "0 0 12px 12px",
              overflow: "hidden",
              boxShadow: 3,
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
                    sx={{
                      p: 2,
                      justifyContent: "space-between",
                      bgcolor: "white",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Showing <strong>{filteredVoters.length}</strong> of{" "}
                      {rawVoters.length} total voters
                    </Typography>
                    <GridToolbarQuickFilter />
                  </GridToolbarContainer>
                ),
              }}
              sx={{ border: "none" }}
            />
          </Paper>
        </Box>
      )}

      {!dbFilters && (
        <Paper
          sx={{
            mt: 4,
            p: 10,
            textAlign: "center",
            bgcolor: "grey.50",
            border: "1px dashed grey",
          }}
        >
          <Typography variant="h6" color="text.secondary">
            Apply filters to generate your walking route
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
