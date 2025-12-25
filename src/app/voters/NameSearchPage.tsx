// src/app/voters/NameSearchPage.tsx
import React, { useState, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCloudFunctions } from "../../hooks/useCloudFunctions";
import { useQuery } from "@tanstack/react-query";
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
  Button,
  Chip,
  Alert,
  TablePagination,
  CircularProgress,
  TextField,
  Grid,
  IconButton,
  Snackbar,
} from "@mui/material";
import { Phone, Message } from "@mui/icons-material";

// === Safe Name Search Hook (Parameterized) ===
const useNameSearch = (searchTerm: string | null) => {
  const { callFunction } = useCloudFunctions();

  return useQuery({
    queryKey: ["nameSearch", searchTerm],
    queryFn: async (): Promise<any[]> => {
      if (!searchTerm || searchTerm.length < 3) return [];

      try {
        const result = await callFunction<{ voters: any[] }>(
          "searchVotersByName",
          {
            name: searchTerm,
          }
        );

        return result.voters ?? [];
      } catch (err) {
        console.error("Name search failed:", err);
        return [];
      }
    },
    enabled: !!searchTerm && searchTerm.length >= 3,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

export default function NameSearchPage() {
  const { isLoaded } = useAuth();

  const [nameInput, setNameInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // === Parameterized search ===
  const trimmedInput = nameInput.trim();
  const {
    data: voters = [],
    isLoading,
    error,
  } = useNameSearch(submitted ? trimmedInput : null);

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

  const handleSearch = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      if (trimmedInput.length < 3) {
        setSnackbarMessage("Please enter at least 3 characters");
        setSnackbarOpen(true);
        return;
      }

      setSubmitted(true);
      setPage(0);
    },
    [trimmedInput]
  );

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

      <Paper
        component="form"
        onSubmit={handleSearch}
        sx={{ p: 4, mb: 4, borderRadius: 2 }}
      >
        <Typography variant="h6" gutterBottom color="#0A3161">
          Global Directory Search
        </Typography>
        <Grid container spacing={3} alignItems="flex-end">
          <Grid>
            <TextField
              label="Voter Name"
              fullWidth
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                setSubmitted(false); // Reset on typing
              }}
              placeholder="e.g. John Smith"
              helperText={`Enter at least 3 characters (${nameInput.length}/3)`}
              autoComplete="off"
              inputProps={{ maxLength: 100 }}
            />
          </Grid>
          <Grid>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={trimmedInput.length < 3 || isLoading}
              sx={{ bgcolor: "#B22234", py: 1.8 }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Search"
              )}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Search failed. Please try again.
        </Alert>
      )}

      {submitted && !isLoading && voters.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No voters found for "{trimmedInput}". Try a partial name or different
          spelling.
        </Alert>
      )}

      {submitted && voters.length > 0 && (
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

      {/* Snackbar */}
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
