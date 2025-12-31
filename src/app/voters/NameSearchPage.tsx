// src/app/voters/NameSearchPage.tsx
import React, { useState, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCloudFunctions } from "../../hooks/useCloudFunctions";
import { useQuery } from "@tanstack/react-query";
import { FilterSelector } from "../../components/FilterSelector";
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

  // Device capabilities
  const canCall = isMobile;
  const canText = isMobile;

  const { isLoaded } = useAuth();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const { data: voters = [], isLoading, error } = useDynamicVoters(filters);

  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    if (!submittedFilters.name || submittedFilters.name.trim().length < 3) {
      // Feedback handled in FilterSelector via snackbar
      return;
    }
    setFilters(submittedFilters);
    setPage(0);
  }, []);

  const handleCall = useCallback((phone?: string) => {
    if (!phone) return;
    const cleaned = phone.replace(/\D/g, "");
    const normalized =
      cleaned.length === 11 && cleaned.startsWith("1")
        ? cleaned
        : "1" + cleaned;
    window.location.href = `tel:${normalized}`;
  }, []);

  const handleText = useCallback(
    async (phone?: string) => {
      if (!phone || !canText) return;

      setShowReturnHint(true);

      const cleaned = phone.replace(/\D/g, "");
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;

      let messageBody = "";

      try {
        // Try to read from clipboard
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText.trim()) {
          messageBody = clipboardText.trim();
        }
      } catch (err) {
        console.log("Clipboard access denied or empty — using default message");
      }

      // Open SMS with the message
      setTimeout(() => {
        window.location.href = `sms:${normalized}?body=${encodeURIComponent(
          messageBody
        )}`;
      }, 1500);

      setShowReturnHint(false);
    },
    [canText]
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

      {showReturnHint && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bgcolor: "primary.main",
            color: "white",
            p: 2,
            textAlign: "center",
            zIndex: 9999,
          }}
        >
          Opening Messages... Tap back when finished!
        </Box>
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
                {paginatedVoters.map((voter: any) => (
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
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
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
    </Box>
  );
}
