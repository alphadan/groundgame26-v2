import React, { useState, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCloudFunctions } from "../../hooks/useCloudFunctions";
import { useQuery } from "@tanstack/react-query";
import { FilterSelector } from "../../components/FilterSelector";
import { VoterNotes } from "../../components/VoterNotes";
import { useDncMap } from "../../hooks/useDncMap";
import { awardPoints } from "../../services/rewardsService";
import { functions } from "../../lib/firebase";
import { httpsCallable } from "firebase/functions";
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
  Divider,
} from "@mui/material";
import { Phone, Message, Block, MailOutline } from "@mui/icons-material";

const REWARD_PURPLE = "#673ab7";

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
          filters,
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
  const { user, isLoaded: authLoaded } = useAuth();
  const dncMap = useDncMap();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [isRewardToast, setIsRewardToast] = useState(false);

  const { data: voters = [], isLoading, error } = useDynamicVoters(filters);

  // --- REWARDED ACTION HANDLER ---
  const handleContactAction = async (
    type: "sms" | "email" | "phone",
    voterName: string,
    protocolUrl: string,
  ) => {
    if (!user?.uid) return;

    try {
      // Award 1 point for digital outreach (phone calls log as sms/comms action)
      await awardPoints(user.uid, type === "phone" ? "sms" : type, 1);

      setIsRewardToast(true);
      setSnackbarMessage(`+1 point earned for contacting ${voterName}!`);
      setSnackbarOpen(true);

      // Delay execution slightly so the user sees the purple reward feedback
      setTimeout(() => {
        window.location.href = protocolUrl;
      }, 800);
    } catch (err) {
      console.error("Reward service error:", err);
      window.location.href = protocolUrl;
    }
  };

  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    if (!submittedFilters.name || submittedFilters.name.trim().length < 3) {
      setIsRewardToast(false);
      setSnackbarMessage("Please enter at least 3 characters to search");
      setSnackbarOpen(true);
      return;
    }
    setFilters(submittedFilters);
    setPage(0);
  }, []);

  const paginatedVoters = useMemo(
    () => voters.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [voters, page, rowsPerPage],
  );

  if (!authLoaded) {
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
      <Typography variant="h4" gutterBottom fontWeight="900" color="primary">
        Name Search
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Search the county database by voter name or address
      </Typography>

      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isLoading}
        demographicFilters={["name", "street"]}
      />

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          Search failed. Please check your connection and try again.
        </Alert>
      )}

      {filters && voters.length > 0 && (
        <Paper
          sx={{ mt: 4, borderRadius: 3, overflow: "hidden", boxShadow: 4 }}
        >
          <TableContainer>
            <Table size={isMobile ? "small" : "medium"}>
              <TableHead>
                <TableRow sx={{ bgcolor: "grey.100" }}>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Voter / Address
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Party</TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold" }}>
                    Contact & Rewards
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedVoters.map((voter: any) => {
                  const phone = voter.phone_mobile || voter.phone_home;
                  const normalizedPhone = phone?.replace(/\D/g, "") || "";
                  const isDnc =
                    dncMap.has(voter.voter_id) ||
                    (normalizedPhone && dncMap.has(normalizedPhone));

                  return (
                    <TableRow key={voter.voter_id} hover>
                      <TableCell>
                        <Typography variant="body1" fontWeight="bold">
                          {voter.full_name || "Unknown"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {voter.address || "No address"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={voter.party || "U"}
                          size="small"
                          sx={{
                            fontWeight: "bold",
                            bgcolor:
                              voter.party === "R"
                                ? "#B22234"
                                : voter.party === "D"
                                  ? "#3C3B6E"
                                  : "grey.400",
                            color: "white",
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                          alignItems="center"
                        >
                          {isDnc ? (
                            <Tooltip title="Voter has requested no contact (DNC)">
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
                              {isMobile && phone && (
                                <Tooltip title="Call Voter (+1 pt)">
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() =>
                                      handleContactAction(
                                        "phone",
                                        voter.full_name,
                                        `tel:${normalizedPhone}`,
                                      )
                                    }
                                  >
                                    <Phone fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {isMobile && voter.phone_mobile && (
                                <Tooltip title="Text Voter (+1 pt)">
                                  <IconButton
                                    size="small"
                                    color="info"
                                    onClick={() =>
                                      handleContactAction(
                                        "sms",
                                        voter.full_name,
                                        `sms:${normalizedPhone}`,
                                      )
                                    }
                                  >
                                    <Message fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {voter.email && (
                                <Tooltip title="Email Voter (+1 pt)">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() =>
                                      handleContactAction(
                                        "email",
                                        voter.full_name,
                                        `mailto:${voter.email}`,
                                      )
                                    }
                                  >
                                    <MailOutline fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </>
                          )}
                          <Divider
                            orientation="vertical"
                            flexItem
                            sx={{ mx: 0.5 }}
                          />
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
        <Box
          sx={{
            textAlign: "center",
            py: 10,
            mt: 4,
            bgcolor: "grey.50",
            borderRadius: 4,
            border: "1px dashed grey",
          }}
        >
          <Typography variant="h6" color="text.secondary">
            Enter a voter name (min. 3 characters) to begin search
          </Typography>
        </Box>
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={isRewardToast ? "success" : "info"}
          variant="filled"
          sx={{
            bgcolor: isRewardToast ? REWARD_PURPLE : undefined,
            fontWeight: "bold",
          }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
