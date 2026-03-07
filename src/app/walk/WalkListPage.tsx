import React, { useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDynamicVoters } from "../../hooks/useDynamicVoters";
import { useInteractionMap } from "../../hooks/useInteractionMap";
import { useDncMap } from "../../hooks/useDncMap";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
import { awardPoints } from "../../services/rewardsService";
import { db, recordEvent } from "../../lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";

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
import {
  Doorbell as DoorbellIcon,
  Block as BlockIcon,
  Map as MapIcon,
  Sort as SortIcon,
} from "@mui/icons-material";
import BoltIcon from "@mui/icons-material/Bolt";
import ApartmentIcon from "@mui/icons-material/Apartment";
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import OtherHousesIcon from "@mui/icons-material/OtherHouses";
import MailIcon from "@mui/icons-material/Mail";
import {
  DataGrid,
  GridColDef,
  GridToolbarContainer,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";

import { Voter } from "../../types";

const PURPLE_MAIN = "#673ab7";

export default function WalkListPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { user, isLoaded: authLoaded } = useAuth();

  // --- STATE ---
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [dbFilters, setDbFilters] = useState<any>(null);
  const [activeSubFilter, setActiveSubFilter] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });

  // --- DATA HOOKS ---
  const dncMap = useDncMap();
  const interactionMap = useInteractionMap(dbFilters?.precinct);
  const {
    data: rawVoters = [],
    isLoading,
    error,
  } = useDynamicVoters(dbFilters);

  // --- REFINEMENT & SORTING LOGIC ---
  const filteredVoters = useMemo(() => {
    let result = [...rawVoters];

    // 1. Apply Sub-Filters (Refinements)
    if (activeSubFilter === "communal") {
      const addressCounts: Record<string, number> = {};
      result.forEach((v) => {
        const addr = v.address || "Unknown";
        addressCounts[addr] = (addressCounts[addr] || 0) + 1;
      });
      result = result.filter((v) => addressCounts[v.address || ""] >= 8);
    }

    if (activeSubFilter === "largefamily") {
      const addressCounts: Record<string, number> = {};
      result.forEach((v) => {
        const addr = v.address || "Unknown";
        addressCounts[addr] = (addressCounts[addr] || 0) + 1;
      });
      result = result.filter((v) => addressCounts[v.address || ""] >= 4);
    }

    if (activeSubFilter === "high_primary") {
      result = result.filter(
        (v) =>
          v.political_party === "R" &&
          [3, 4].includes(Number(v.turnout_score_primary)),
      );
    }

    // 2. Sort Logic (Street -> House Number)
    result.sort((a, b) => {
      const streetA = (a.address || "").replace(/^[0-9]+\s+/, "").toLowerCase();
      const streetB = (b.address || "").replace(/^[0-9]+\s+/, "").toLowerCase();

      let comparison =
        streetA !== streetB
          ? streetA.localeCompare(streetB)
          : (Number(a.house_int) || 0) - (Number(b.house_int) || 0);

      return sortOrder === "asc" ? comparison : -comparison;
    });

    // 3. Map Suppression & Data Normalization
    return result.map((voter, index, array) => {
      const prev = index > 0 ? array[index - 1] : null;
      const vId = voter.voter_id
        ? String(voter.voter_id)
        : `temp-${voter.address}-${index}`;

      return {
        ...voter,
        voter_id: vId,
        gender: voter.sex, // Mapping DB 'sex' to UI 'gender'
        party: voter.political_party, // Mapping DB 'political_party' to UI 'party'
        isFirstInHouse: !prev || prev.address !== voter.address,
        isDnc: dncMap.has(vId),
        isRecentlyVisited: interactionMap.has(vId),
        isLocked: dncMap.has(vId) || interactionMap.has(vId),
      };
    });
  }, [rawVoters, dncMap, interactionMap, sortOrder, activeSubFilter]);

  // --- HANDLERS ---
  const toggleSubFilter = (filter: string) => {
    setActiveSubFilter((prev) => (prev === filter ? null : filter));
  };

  const handleVisit = async (voter: Voter) => {
    if (!user?.uid) return;
    try {
      await awardPoints(user.uid, "walk", 1);
      const now = Date.now();
      const expiry = now + 30 * 24 * 60 * 60 * 1000;

      await setDoc(
        doc(collection(db, "voter_interactions"), `${voter.voter_id}_walk`),
        {
          voter_id: String(voter.voter_id),
          volunteer_uid: user.uid,
          interaction_type: "walk",
          timestamp: now,
          expires_at: expiry,
          precinct: String(dbFilters?.precinct || "unknown"),
        },
      );

      setSnackbar({
        open: true,
        message: `Visit logged for ${voter.full_name}`,
      });
      recordEvent("voter_visit_logged", { voter_id: voter.voter_id });
    } catch (e) {
      setSnackbar({ open: true, message: "Error logging visit." });
    }
  };

  const openInMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  };

  // --- COLUMNS (DESKTOP) ---
  const columns: GridColDef[] = [
    {
      field: "address",
      headerName: "Household",
      flex: 1.5,
      renderCell: ({ row }) => (
        <Box sx={{ py: 1 }}>
          {row.isFirstInHouse ? (
            <Stack direction="column" spacing={1} alignItems="left">
              <Typography variant="body2" fontWeight="900" color="primary.main">
                {row.address}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {row.city || "No city on file"}, {row.state || "PA"}{" "}
                {row.zip_code || "No ZIP"}
              </Typography>
            </Stack>
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
      ),
    },
    {
      field: "full_name",
      headerName: "Voter Name",
      flex: 1.2,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography
            variant="body2"
            sx={{ textDecoration: row.isLocked ? "line-through" : "none" }}
          >
            {row.full_name}
          </Typography>
          {row.isDnc && (
            <Chip
              label="DNC"
              size="small"
              color="error"
              variant="outlined"
              sx={{ height: 20 }}
            />
          )}
          {row.isRecentlyVisited && (
            <Chip
              label="Visited"
              size="small"
              color="success"
              sx={{ height: 20 }}
            />
          )}
        </Stack>
      ),
    },
    {
      field: "has_mail_ballot",
      headerName: "VBM",
      width: 80,
      headerAlign: "center",
      align: "center",
      renderCell: ({ value }) => (
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          justifyContent="center"
          sx={{ color: value ? "success.main" : "warning.main" }}
        >
          <MailIcon sx={{ fontSize: 18 }} />
        </Stack>
      ),
    },
    {
      field: "age",
      headerName: "Age",
      width: 70,
      renderCell: ({ value }) => (
        <Chip
          label={value || "?"}
          size="small"
          variant="outlined"
          sx={{ fontWeight: "bold" }}
        />
      ),
    },
    {
      field: "sex",
      headerName: "Sex",
      width: 60,
      renderCell: ({ value }) => (
        <Typography
          variant="caption"
          fontWeight="bold"
          sx={{ color: value === "F" ? "primary.light" : "secondary.dark" }}
        >
          {value}
        </Typography>
      ),
    },
    {
      field: "political_party",
      headerName: "Party",
      width: 90,
      renderCell: ({ value }) => (
        <Chip
          label={value || "?"}
          size="small"
          sx={{
            fontWeight: "bold",
            bgcolor:
              value === "R"
                ? theme.palette.error.main
                : value === "D"
                  ? theme.palette.info.main
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
        <Stack direction="row" spacing={1}>
          {!row.isLocked && (
            <IconButton
              size="small"
              sx={{ color: PURPLE_MAIN }}
              onClick={() => handleVisit(row)}
            >
              <DoorbellIcon fontSize="small" />
            </IconButton>
          )}
          <VoterNotes
            voterId={row.voter_id}
            fullName={row.full_name}
            address={row.address}
          />
        </Stack>
      ),
    },
  ];

  // --- MOBILE VOTER CARD ---
  const VoterCard = ({ row }: { row: any }) => (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 2,
        mt: row.isFirstInHouse ? 4 : 0,
        borderRadius: 2,
        opacity: row.isLocked ? 0.6 : 1,
        bgcolor: row.isLocked ? "grey.50" : "background.paper",
        borderLeft: `6px solid ${
          row.isLocked
            ? "#d32f2f"
            : row.party === "R"
              ? "#B22234"
              : row.party === "D"
                ? "#1976d2"
                : "#9e9e9e"
        }`,
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          {/* Left Side: Name and Sub-details */}
          <Box>
            <Typography
              variant="subtitle1"
              fontWeight="bold"
              sx={{ textDecoration: row.isLocked ? "line-through" : "none" }}
            >
              {row.full_name}
            </Typography>

            {/* MIB and SEX Row underneath name */}
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ mt: 0.5 }}
            >
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{
                  color: row.has_mail_ballot ? "success.main" : "warning.main",
                }}
              >
                <MailIcon sx={{ fontSize: 18 }} />
                <Typography variant="caption" fontWeight="900">
                  {row.has_mail_ballot ? "YES" : "NO"}
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: "bold" }}
              >
                SEX: {row.sex || "?"}
              </Typography>
            </Stack>
          </Box>

          {/* Right Side: Age and Party Chips */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Chip label={row.age || "?"} size="small" variant="outlined" />
            <Chip
              label={row.party || "U"}
              size="small"
              sx={{
                bgcolor:
                  row.party === "R"
                    ? "error.main"
                    : row.party === "D"
                      ? "info.main"
                      : "grey.400",
                color: "white",
                fontWeight: "bold",
              }}
            />
          </Stack>
        </Stack>

        {row.isFirstInHouse && (
          <Button
            size="small"
            startIcon={<MapIcon />}
            onClick={() => openInMaps(row.address)}
            sx={{
              justifyContent: "flex-start",
              p: 0,
              textTransform: "none",
              fontWeight: 800,
            }}
          >
            {row.address}
          </Button>
        )}

        {(row.isDnc || row.isRecentlyVisited) && (
          <Stack direction="row" spacing={1}>
            {row.isDnc && (
              <Chip
                label="DNC"
                size="small"
                color="error"
                icon={<BlockIcon sx={{ fontSize: "1rem !important" }} />}
              />
            )}
            {row.isRecentlyVisited && (
              <Chip
                label="Visited"
                size="small"
                color="success"
                variant="outlined"
              />
            )}
          </Stack>
        )}

        <Divider />

        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Stack direction="row" spacing={1.5}>
            <VoterNotes
              voterId={row.voter_id}
              fullName={row.full_name}
              address={row.address}
            />
            {!row.isLocked && (
              <IconButton
                onClick={() => handleVisit(row)}
                sx={{
                  color: PURPLE_MAIN,
                  border: `1px solid ${PURPLE_MAIN}`,
                  p: "4px",
                }}
              >
                <DoorbellIcon />
              </IconButton>
            )}
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
      <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
        Walk List
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
        ]}
      />

      {dbFilters && (
        <>
          <Paper sx={{ mt: 2, p: 2, borderRadius: 3, bgcolor: "grey.50" }}>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
            >
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
              />
              <Chip
                label="Large Families (4+)"
                size="small"
                icon={<OtherHousesIcon sx={{ fontSize: "1rem !important" }} />}
                onClick={() => toggleSubFilter("largefamily")}
                color={
                  activeSubFilter === "largefamily" ? "primary" : "default"
                }
                variant={
                  activeSubFilter === "largefamily" ? "filled" : "outlined"
                }
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
              />
              {activeSubFilter && (
                <Button
                  size="small"
                  onClick={() => setActiveSubFilter(null)}
                  color="error"
                  sx={{ ml: "auto" }}
                >
                  Reset Refinement
                </Button>
              )}
            </Stack>
          </Paper>

          <Box sx={{ mt: 4 }}>
            {isMobile ? (
              <Box>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  mb={2}
                  px={1}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    fontWeight="bold"
                  >
                    {filteredVoters.length} Results
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={
                      <SortIcon
                        sx={{
                          transform:
                            sortOrder === "desc" ? "rotate(180deg)" : "none",
                        }}
                      />
                    }
                    onClick={() =>
                      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                    }
                  >
                    {sortOrder === "asc" ? "Ascending" : "Descending"}
                  </Button>
                </Stack>
                {filteredVoters.map((v) => (
                  <VoterCard key={v.voter_id} row={v} />
                ))}
              </Box>
            ) : (
              <Paper
                elevation={3}
                sx={{ height: 800, borderRadius: 3, overflow: "hidden" }}
              >
                <DataGrid
                  rows={filteredVoters}
                  columns={columns}
                  getRowId={(r) => r.voter_id}
                  rowHeight={75}
                  loading={isLoading}
                  sx={{ border: "none" }}
                />
              </Paper>
            )}
          </Box>
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}
