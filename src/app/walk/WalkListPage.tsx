import React, { useState, useMemo, useCallback } from "react";
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
  Tooltip,
} from "@mui/material";
import {
  Doorbell as DoorbellIcon,
  Block as BlockIcon,
  Map as MapIcon,
  Sort as SortIcon,
} from "@mui/icons-material";
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
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [dbFilters, setDbFilters] = useState<any>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });

  // Suppression Hooks
  const dncMap = useDncMap();
  const interactionMap = useInteractionMap(dbFilters?.precinct);

  // Data Loading
  const {
    data: rawVoters = [],
    isLoading,
    error,
  } = useDynamicVoters(dbFilters);

  // --- 1. DATA STABILIZATION, SORTING & SUPPRESSION LOGIC ---
  const filteredVoters = useMemo(() => {
    // 1. Create a shallow copy to avoid mutating the source data
    let result = [...rawVoters];

    // 2. Primary Sort Logic (Street Name -> House Number)
    result.sort((a, b) => {
      const streetA = (a.address || "").replace(/^[0-9]+\s+/, "").toLowerCase();
      const streetB = (b.address || "").replace(/^[0-9]+\s+/, "").toLowerCase();

      let comparison = 0;

      // Sort by Street Name first
      if (streetA !== streetB) {
        comparison = streetA.localeCompare(streetB);
      } else {
        // If streets are the same, sort by House Number (numeric)
        comparison =
          (Number(a.address_num) || 0) - (Number(b.address_num) || 0);
      }

      // Apply Mobile Sort Toggle (flips the result if 'desc')
      return sortOrder === "asc" ? comparison : -comparison;
    });

    // 3. Map with Type-Safe Suppression Checks
    // We do this inside the memo so the DataGrid doesn't re-calculate on every scroll frame
    return result.map((voter, index, array) => {
      const prev = index > 0 ? array[index - 1] : null;

      // Ensure ID is a string for consistent .has() lookups
      const vId = voter.voter_id
        ? String(voter.voter_id)
        : `temp-${voter.address}-${index}`;

      // Check both Suppression Maps
      const isDnc = dncMap.has(vId);
      const isRecentlyVisited = interactionMap.has(vId);
      const isLocked = isDnc || isRecentlyVisited;

      return {
        ...voter,
        voter_id: vId,
        gender: voter.sex,
        party: voter.political_party,
        // Household grouping logic:
        // Only "true" if the address changed from the previous row
        isFirstInHouse: !prev || prev.address !== voter.address,
        isDnc,
        isRecentlyVisited,
        isLocked,
      };
    });

    // Dependencies: If any of these change, the list re-calculates
  }, [rawVoters, dncMap, interactionMap, dbFilters?.precinct, sortOrder]);

  // --- 2. ACTION HANDLER ---
  const handleVisit = async (voter: Voter) => {
    if (!user?.uid) {
      console.error("No User UID found");
      return;
    }

    try {
      console.log("Starting visit log for:", voter.voter_id);
      await awardPoints(user.uid, "walk", 1);

      // Perfect 30-day math: Use a constant to be 100% precise
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now(); // <--- Capture "now" once for consistency
      const expiry = now + THIRTY_DAYS_MS;

      const interactionId = `${voter.voter_id}_walk`;
      const docRef = doc(collection(db, "voter_interactions"), interactionId);

      await setDoc(docRef, {
        // We force everything to String to ensure the hook can find it
        voter_id: String(voter.voter_id), // <--- CRITICAL FIX
        volunteer_uid: user.uid,
        interaction_type: "walk",
        timestamp: now,
        expires_at: expiry,
        precinct: String(dbFilters?.precinct || "unknown"), // <--- CRITICAL FIX
      });

      console.log("Firestore document written successfully!");
      setSnackbar({
        open: true,
        message: `Visit logged for ${voter.full_name}`,
      });
      recordEvent("voter_visit_logged", { voter_id: voter.voter_id });
    } catch (e) {
      console.error("CRITICAL ERROR in handleVisit:", e);
      setSnackbar({
        open: true,
        message: "Error logging visit. Check console.",
      });
    }
  };

  const openInMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  };

  // --- 3. DATAGRID COLUMNS (DESKTOP) ---
  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "address",
        headerName: "Household",
        flex: 1.5,
        renderCell: ({ row }) => (
          <Box sx={{ py: 1 }}>
            {row.isFirstInHouse ? (
              <Typography variant="body2" fontWeight="900" color="primary.main">
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
        field: "age",
        headerName: "Age",
        width: 70,
        align: "center",
        headerAlign: "center",
        renderCell: ({ value }) => (
          <Chip
            label={value || "?"}
            size="small"
            variant="outlined"
            sx={{ fontWeight: "bold", borderColor: "grey.300" }}
          />
        ),
      },
      {
        field: "political_party",
        headerName: "Party",
        width: 80,
        renderCell: ({ value }) => (
          <Chip
            label={value || "U"}
            size="small"
            sx={{
              bgcolor:
                value === "R"
                  ? "error.main"
                  : value === "D"
                    ? "info.main"
                    : "grey.400",
              color: "white",
              fontWeight: "bold",
            }}
          />
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 150,
        renderCell: ({ row }) => {
          if (row.isLocked)
            return <BlockIcon color="error" sx={{ opacity: 0.5 }} />;
          return (
            <Stack direction="row" spacing={1}>
              <IconButton
                size="small"
                sx={{ color: PURPLE_MAIN }}
                onClick={() => handleVisit(row)}
              >
                <DoorbellIcon fontSize="small" />
              </IconButton>
              <VoterNotes
                voterId={row.voter_id}
                fullName={row.full_name}
                address={row.address}
              />
            </Stack>
          );
        },
      },
    ],
    [],
  );

  // --- 4. MOBILE CARD VIEW ---
  const VoterCard = ({ row }: { row: any }) => (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 2,
        opacity: row.isLocked ? 0.6 : 1,
        bgcolor: row.isLocked ? "grey.50" : "background.paper",
        borderLeft: `6px solid ${
          row.isLocked
            ? theme.palette.error.main
            : row.party === "R"
              ? theme.palette.error.main
              : row.party === "D"
                ? theme.palette.info.main
                : "grey"
        }`,
      }}
    >
      <Stack spacing={1.5}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Box>
            <Typography
              variant="subtitle1"
              fontWeight="bold"
              sx={{ textDecoration: row.isLocked ? "line-through" : "none" }}
            >
              {row.full_name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ID: {row.voter_id} • Precinct: {row.precinct || "N/A"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5}>
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
              }}
            />
          </Stack>
        </Box>

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

        <Button
          size="small"
          startIcon={<MapIcon />}
          onClick={() => openInMaps(row.address || "")}
          sx={{
            justifyContent: "flex-start",
            p: 0,
            textTransform: "none",
            fontWeight: 800,
          }}
        >
          {row.address}
        </Button>

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

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Error loading voter data.
        </Alert>
      )}

      {dbFilters && (
        <Box sx={{ mt: 4 }}>
          {isMobile ? (
            <>
              {/* NEW: Sort Toggle Row for Mobile */}
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 2, px: 1 }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight="bold"
                >
                  {filteredVoters.length} Households
                </Typography>
                <Button
                  size="small"
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
                  sx={{
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 700,
                  }}
                  variant="outlined"
                  color="primary"
                >
                  {sortOrder === "asc"
                    ? "Sorting: Ascending"
                    : "Sorting: Descending"}
                </Button>
              </Stack>

              {filteredVoters.map((v) => (
                <VoterCard
                  key={v.voter_id}
                  row={v}
                  sx={{ mt: v.isFirstInHouse ? 4 : 1 }}
                />
              ))}
            </>
          ) : (
            <Paper
              elevation={3}
              sx={{ height: 800, borderRadius: 3, overflow: "hidden" }}
            >
              <DataGrid
                rows={filteredVoters}
                getRowId={(r) => r.voter_id}
                columns={columns}
                rowHeight={75}
                loading={isLoading}
                getRowClassName={(params) =>
                  params.row.isLocked ? "muted-row" : ""
                }
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
                sx={{
                  border: "none",
                  "& .muted-row": {
                    bgcolor: "grey.50",
                    opacity: 0.6,
                    pointerEvents: "none",
                  },
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
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}
