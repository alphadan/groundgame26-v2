// src/app/voters/NameSearchPage.tsx
import React, { useState, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCloudFunctions } from "../../hooks/useCloudFunctions";
import { useQuery } from "@tanstack/react-query";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
import { useDncMap } from "../../hooks/useDncMap"; // Integrated DNC Hook
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
import { Phone, Message, Block } from "@mui/icons-material";

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
  const { isLoaded } = useAuth();
  const dncMap = useDncMap();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const { data: voters = [], isLoading, error } = useDynamicVoters(filters);

  const voterIds = useMemo(
    () => voters.map((v: any) => v.voter_id).filter(Boolean),
    [voters]
  );

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
    if (!submittedFilters.name || submittedFilters.name.trim().length < 3)
      return;
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
      setSnackbarMessage("Opening Phone app...");
      setSnackbarOpen(true);
      setTimeout(() => {
        window.location.href = `tel:${normalized}`;
      }, 1500);
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
      setSnackbarMessage("Opening Messages app...");
      setSnackbarOpen(true);
      setTimeout(() => {
        window.location.href = `sms:${normalized}`;
      }, 1500);
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
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        Name Search
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Find any voter by name or address
      </Typography>

      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isLoading}
        demographicFilters={["name", "street"]}
      />

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          Search failed. Please try again.
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
                  // DNC Logic Check
                  const normalizedPhone =
                    voter.phone_mobile?.replace(/\D/g, "") || "";
                  const isDnc =
                    dncMap.has(voter.voter_id) || dncMap.has(normalizedPhone);

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
                          {voter.address || "No address"}
                        </Typography>
                      </TableCell>
                      <TableCell>{voter.age ?? "?"}</TableCell>
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
                        />
                      </TableCell>
                      <TableCell>{voter.precinct || "—"}</TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                          alignItems="center"
                        >
                          {isDnc ? (
                            <Tooltip title="Do Not Contact Requested">
                              <Chip
                                icon={
                                  <Block sx={{ fontSize: "14px !important" }} />
                                }
                                label="DNC"
                                color="error"
                                size="small"
                                variant="outlined"
                              />
                            </Tooltip>
                          ) : (
                            <>
                              {(voter.phone_mobile || voter.phone_home) &&
                                !isMobile && (
                                  <Typography variant="body2">
                                    {voter.phone_mobile || voter.phone_home}
                                  </Typography>
                                )}
                              {isMobile &&
                                (voter.phone_mobile || voter.phone_home) && (
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
                                )}
                              {isMobile && voter.phone_mobile && (
                                <IconButton
                                  size="small"
                                  color="info"
                                  onClick={() => handleText(voter.phone_mobile)}
                                >
                                  <Message fontSize="small" />
                                </IconButton>
                              )}
                            </>
                          )}
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
            component="div"
            count={voters.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </Paper>
      )}

      {!filters && (
        <Box sx={{ textAlign: "center", py: 10, mt: 4 }}>
          <Typography variant="h6" color="text.secondary">
            Enter a name to begin searching
          </Typography>
        </Box>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert severity="info" variant="filled">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
