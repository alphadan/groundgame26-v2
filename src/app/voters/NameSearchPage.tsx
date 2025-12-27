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

// Shared hook using the dynamic query function
const useDynamicVoters = (filters: FilterValues | null) => {
  const { callFunction } = useCloudFunctions();

  return useQuery({
    queryKey: ["dynamicVoters", filters],
    queryFn: async (): Promise<any[]> => {
      if (!filters) return [];

      // Only require name for NameSearch
      if (!filters.name || filters.name.trim().length < 3) return [];

      try {
        const result = await callFunction<{ voters: any[] }>(
          "queryVotersDynamic",
          filters
        );

        return result.voters ?? [];
      } catch (err) {
        console.error("Dynamic voter query failed:", err);
        return [];
      }
    },
    enabled: !!filters && !!filters.name && filters.name.trim().length >= 3,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

export default function NameSearchPage() {
  const { isLoaded } = useAuth();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // === Voter data from dynamic query ===
  const { data: voters = [], isLoading, error } = useDynamicVoters(filters);

  // === Submit handler with name validation ===
  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    if (!submittedFilters.name || submittedFilters.name.trim().length < 3) {
      setSnackbarMessage(
        "Please enter at least 3 characters in the name field"
      );
      setSnackbarOpen(true);
      return;
    }

    setFilters(submittedFilters);
    setPage(0);
  }, []);

  // === Safe contact actions ===
  const safeCall = useCallback((phone?: string) => {
    if (!phone || typeof phone !== "string") return;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length >= 10) {
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;
      window.location.href = `tel:${normalized}`;
    }
  }, []);

  const safeText = useCallback((phone?: string) => {
    if (!phone || typeof phone !== "string") return;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length >= 10) {
      const normalized =
        cleaned.length === 11 && cleaned.startsWith("1")
          ? cleaned
          : "1" + cleaned;
      window.location.href = `sms:${normalized}`;
    }
  }, []);

  const paginatedData = useMemo(
    () => voters.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [voters, page, rowsPerPage]
  );

  if (!isLoaded) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="70vh"
      >
        <CircularProgress sx={{ color: "#B22234" }} />
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Name Search — Find Any Voter
      </Typography>

      {/* === FilterSelector — Name + Street only === */}
      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isLoading}
        unrestrictedFilters={["name", "street"]}
      />

      {/* === Results === */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Search failed. Please try again.
        </Alert>
      )}

      {filters && !isLoading && voters.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No voters found matching your search.
        </Alert>
      )}

      {filters && voters.length > 0 && (
        <Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#0A3161" }}>
                <TableRow>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Name & Address
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Age
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Party
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Precinct
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Contact
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((voter: any) => (
                  <TableRow key={voter.voter_id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {voter.full_name || "Unknown"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
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
                    <TableCell>{voter.precinct || "-"}</TableCell>
                    <TableCell>
                      {voter.phone_mobile && (
                        <>
                          <IconButton
                            color="success"
                            onClick={() => safeCall(voter.phone_mobile)}
                          >
                            <Phone fontSize="small" />
                          </IconButton>
                          <IconButton
                            color="info"
                            onClick={() => safeText(voter.phone_mobile)}
                          >
                            <Message fontSize="small" />
                          </IconButton>
                        </>
                      )}
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
          />
        </Paper>
      )}

      {/* === Snackbar === */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="warning">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
