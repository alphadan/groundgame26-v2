// src/app/voters/NameSearchPage.tsx
import React, { useState, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCloudFunctions } from "../../hooks/useCloudFunctions";
import { useQuery } from "@tanstack/react-query";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  TablePagination,
  CircularProgress,
  IconButton,
  Tooltip,
  Stack,
  useTheme,
  useMediaQuery,
  Snackbar,
} from "@mui/material";
import { Phone, Message } from "@mui/icons-material";

interface FilterValues {
  county: string;
  area: string;
  precinct: string;
  name?: string;
  street?: string;
  modeledParty?: string;
  turnout?: string;
  ageGroup?: string;
  mailBallot?: string;
}

const useDynamicVoters = (filters: FilterValues | null) => {
  const { callFunction } = useCloudFunctions();

  return useQuery({
    queryKey: ["nameSearchVoters", filters],
    queryFn: async (): Promise<any[]> => {
      if (!filters || !filters.name || filters.name.trim().length < 3)
        return [];

      try {
        const result = await callFunction<{ voters: any[] }>(
          "queryVotersDynamic",
          filters
        );
        return result.voters ?? [];
      } catch (err) {
        console.error("Name search query failed:", err);
        throw err;
      }
    },
    enabled: !!filters && !!filters.name && filters.name.trim().length >= 3,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

export default function NameSearchPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [showReturnHint, setShowReturnHint] = useState<boolean>(false);

  const { isLoaded } = useAuth();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const { data: voters = [], isLoading, error } = useDynamicVoters(filters);

  // Extract voter IDs for batch note count fetch
  const voterIds = useMemo(
    () => voters.map((v: any) => v.voter_id).filter(Boolean),
    [voters]
  );

  // Fetch note counts for all voters in results
  const { data: notesCounts = {} } = useQuery({
    queryKey: ["voterNotesCounts", voterIds],
    queryFn: async () => {
      if (voterIds.length === 0) return {};

      const result = await httpsCallable(
        functions,
        "getVoterNotes"
      )({ voterIds });
      const notesList = (result.data as any).notes || [];

      const counts: Record<string, number> = {};
      notesList.forEach((note: any) => {
        counts[note.voter_id] = (counts[note.voter_id] || 0) + 1;
      });
      return counts;
    },
    enabled: voterIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    if (!submittedFilters.name || submittedFilters.name.trim().length < 3) {
      return;
    }
    setFilters(submittedFilters);
    setPage(0);
  }, []);

  const handleCall = useCallback(
    (phone?: string) => {
      if (!phone || !isMobile) return;

      const cleaned = phone.replace(/\D/g, "");
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;

      setSnackbarMessage(
        "Opens your Phone app — from the left swipe right to return back here."
      );
      setSnackbarOpen(true);

      setTimeout(() => {
        window.location.href = `tel:${normalized}`;
      }, 2000);
    },
    [isMobile]
  );

  const handleText = useCallback(
    async (phone?: string) => {
      if (!phone || !isMobile) return;

      const cleaned = phone.replace(/\D/g, "");
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;

      let messageBody = "";

      try {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText.trim()) {
          messageBody = clipboardText.trim();
        }
      } catch (err) {
        console.log("Clipboard access denied or empty");
      }

      setSnackbarMessage(
        "Opens your Messages app — from the left swipe right to return back here."
      );
      setSnackbarOpen(true);

      setTimeout(() => {
        window.location.href = `sms:${normalized}?body=${encodeURIComponent(
          messageBody
        )}`;
      }, 2000);
    },
    [isMobile]
  );

  const paginatedVoters = useMemo(
    () => voters.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [voters, page, rowsPerPage]
  );

  if (!isLoaded) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "70vh",
        }}
      >
        <CircularProgress color="primary" size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Header */}
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        Name Search
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Quickly find any voter by name or address
      </Typography>

      {/* Filter Selector — Name + Street only */}
      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isLoading}
        unrestrictedFilters={["name", "street"]}
      />

      {/* Results */}
      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          Search failed. Please try again.
        </Alert>
      )}

      {filters && !isLoading && voters.length === 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No voters found matching your search. Try broadening your criteria.
        </Alert>
      )}

      {filters && voters.length > 0 && (
        <Paper
          sx={{ mt: 4, borderRadius: 3, overflow: "hidden", boxShadow: 4 }}
        >
          <TableContainer>
            <Table size={isMobile ? "small" : "medium"}>
              <TableHead>
                <TableRow sx={{ bgcolor: "secondary.main" }}>
                  <TableCell
                    sx={{ color: "secondary.contrastText", fontWeight: "bold" }}
                  >
                    Voter
                  </TableCell>
                  <TableCell
                    sx={{ color: "secondary.contrastText", fontWeight: "bold" }}
                  >
                    Age
                  </TableCell>
                  <TableCell
                    sx={{ color: "secondary.contrastText", fontWeight: "bold" }}
                  >
                    Party
                  </TableCell>
                  <TableCell
                    sx={{ color: "secondary.contrastText", fontWeight: "bold" }}
                  >
                    Precinct
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: "secondary.contrastText", fontWeight: "bold" }}
                  >
                    Contact
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedVoters.map((voter: any) => {
                  const noteCount = notesCounts[voter.voter_id] || 0;

                  return (
                    <TableRow
                      key={voter.voter_id}
                      hover
                      sx={{ "&:hover": { bgcolor: "action.hover" } }}
                    >
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {voter.full_name || "Unknown"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {voter.address || "No address on file"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">
                          {voter.age ?? "?"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={voter.party || "N/A"}
                          size="small"
                          color={
                            voter.party === "R"
                              ? "error"
                              : voter.party === "D"
                              ? "primary"
                              : "default"
                          }
                          sx={{ minWidth: 60 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {voter.precinct || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="flex-end"
                        >
                          {/* Phone Call */}
                          {(voter.phone_mobile || voter.phone_home) &&
                            !isMobile && (
                              <Typography variant="body2">
                                {voter.phone_mobile || voter.phone_home || "—"}
                              </Typography>
                            )}
                          {(voter.phone_mobile || voter.phone_home) &&
                            isMobile && (
                              <Tooltip title="Opens Phone app — tap back arrow in top-left to return">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() =>
                                    handleCall(
                                      voter.phone_mobile || voter.phone_home
                                    )
                                  }
                                >
                                  <Phone fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                          {/* Text Message */}
                          {voter.phone_mobile && isMobile && (
                            <Tooltip title="Opens Messages app — tap back arrow in top-left to return">
                              <IconButton
                                size="small"
                                color="info"
                                onClick={() => handleText(voter.phone_mobile)}
                              >
                                <Message fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          {/* Notes Icon with Count Badge */}
                          <VoterNotes
                            voterId={voter.voter_id}
                            fullName={voter.full_name}
                            address={voter.address}
                          />
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={voters.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            sx={{
              borderTop: 1,
              borderColor: "divider",
            }}
          />
        </Paper>
      )}

      {/* Initial State */}
      {!filters && (
        <Box sx={{ textAlign: "center", py: 10, mt: 4 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Enter a name to begin searching
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Use at least 3 characters for best results.
          </Typography>
        </Box>
      )}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="info"
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
