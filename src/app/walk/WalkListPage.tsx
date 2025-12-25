// src/app/walk/WalkListPage.tsx
import React, { useState, useMemo, useCallback } from "react";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  Badge,
  Snackbar,
} from "@mui/material";
import {
  Phone,
  Home,
  ExpandMore,
  ExpandLess,
  AddComment,
} from "@mui/icons-material";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useVoters } from "../../hooks/useVoters";
import { useAuth } from "../../context/AuthContext";

export default function WalkListPage() {
  const { user, isLoaded } = useAuth();

  const [zipCode, setZipCode] = useState("");
  const [streetFilter, setStreetFilter] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [expandedHouse, setExpandedHouse] = useState<string>("");

  // Note dialog
  const [openNote, setOpenNote] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // === Safe Input Validation ===
  const isValidZip = (zip: string): boolean => /^\d{5}$/.test(zip);
  const isValidStreet = (street: string): boolean => street.trim().length >= 2;

  // === Safe SQL Builder (NO INJECTION) ===
  const sqlQuery = useMemo<string>(() => {
    if (!submitted) return "";

    const conditions: string[] = [];

    if (isValidZip(zipCode)) {
      conditions.push(`zip_code = ${parseInt(zipCode, 10)}`);
    }

    if (isValidStreet(streetFilter)) {
      // Use parameterized-style safe regex (no user interpolation)
      const safeStreet = streetFilter.trim().toLowerCase();
      conditions.push(
        `REGEXP_CONTAINS(LOWER(address), r'(?i)\\b${safeStreet}\\b')`
      );
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return `
      SELECT voter_id, full_name, age, party, phone_mobile, phone_home, address, city, zip_code, turnout_score_general, precinct
      FROM \`groundgame26_voters.chester_county\`
      ${whereClause}
      ORDER BY address, turnout_score_general DESC
      LIMIT 1000
    `.trim();
  }, [submitted, zipCode, streetFilter]);

  const { data = [], isLoading, error } = useVoters(sqlQuery);

  // === Safe Household Grouping ===
  const households = useMemo(() => {
    const groups: Record<string, any[]> = {};

    data.forEach((voter: any) => {
      if (!voter || typeof voter !== "object") return;
      const addr = voter.address?.trim() || "Unknown Address";
      if (!groups[addr]) groups[addr] = [];
      groups[addr].push(voter);
    });

    return Object.entries(groups)
      .map(([address, voters]) => ({
        address,
        city: voters[0]?.city ?? "Unknown",
        zip_code: voters[0]?.zip_code ?? "",
        voters: voters
          .filter((v): v is any => !!v)
          .sort(
            (a, b) =>
              (b.turnout_score_general ?? 0) - (a.turnout_score_general ?? 0)
          ),
      }))
      .sort((a, b) => a.address.localeCompare(b.address));
  }, [data]);

  // === Safe Phone Call ===
  const safeCall = useCallback((phone: string | null | undefined) => {
    if (!phone || typeof phone !== "string") return;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10 || cleaned.length === 11) {
      window.location.href = `tel:${
        cleaned.startsWith("1") ? cleaned : "1" + cleaned
      }`;
    }
  }, []);

  // === Safe Note Save ===
  const handleAddNote = useCallback(async () => {
    if (!user || !selectedVoter || !noteText.trim()) return;

    setNoteSaving(true);
    try {
      await addDoc(collection(db, "voter_notes"), {
        voter_id: selectedVoter.voter_id ?? null,
        precinct: selectedVoter.precinct ?? null,
        full_name: selectedVoter.full_name ?? "Unknown",
        address: selectedVoter.address ?? "Unknown",
        note: noteText.trim(),
        created_by_uid: user.uid,
        created_by_name: user.displayName || user.email || "Unknown",
        created_at: serverTimestamp(),
      });

      setSnackbarMessage("Note saved successfully");
      setSnackbarOpen(true);
      setNoteText("");
      setOpenNote(false);
    } catch (err: any) {
      console.error("Failed to save note:", err);
      setSnackbarMessage("Failed to save note – please try again");
      setSnackbarOpen(true);
    } finally {
      setNoteSaving(false);
    }
  }, [user, selectedVoter, noteText]);

  // === Generate List with Validation ===
  const handleGenerate = useCallback(() => {
    if (!isValidZip(zipCode) && !isValidStreet(streetFilter)) {
      setSnackbarMessage(
        "Enter a valid 5-digit zip code or street name (2+ chars)"
      );
      setSnackbarOpen(true);
      return;
    }
    setSubmitted(true);
    setPage(0);
  }, [zipCode, streetFilter]);

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
        Canvassing Walk List
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Grouped by address for efficient door-knocking.
      </Typography>

      <Paper sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="end">
          <Grid>
            <TextField
              label="Zip Code"
              fullWidth
              value={zipCode}
              onChange={(e) =>
                setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))
              }
              placeholder="19380"
              helperText="5 digits"
              size="small"
            />
          </Grid>
          <Grid>
            <TextField
              label="Street Name"
              fullWidth
              value={streetFilter}
              onChange={(e) => setStreetFilter(e.target.value)}
              placeholder="Main St"
              helperText="Partial match"
              size="small"
            />
          </Grid>
          <Grid>
            <Button
              variant="contained"
              fullWidth
              onClick={handleGenerate}
              disabled={isLoading}
              sx={{ bgcolor: "#B22234", height: 40 }}
            >
              {isLoading ? "Loading..." : "Generate List"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load data: {(error as Error).message}
        </Alert>
      )}

      {submitted && households.length === 0 && !isLoading && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No voters found for the selected filters.
        </Alert>
      )}

      {submitted && households.length > 0 && (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ bgcolor: "#0A3161" }}>
              <TableRow>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                  Address
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                  Voters
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ color: "white", fontWeight: "bold" }}
                ></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {households
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((house) => (
                  <React.Fragment key={house.address}>
                    <TableRow
                      hover
                      onClick={() =>
                        setExpandedHouse(
                          expandedHouse === house.address ? "" : house.address
                        )
                      }
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Home color="action" />
                          <Box>
                            <Typography fontWeight="medium">
                              {house.address}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {house.city} {house.zip_code}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Badge badgeContent={house.voters.length} color="error">
                          <Chip label="Registered" size="small" />
                        </Badge>
                      </TableCell>
                      <TableCell align="right">
                        {expandedHouse === house.address ? (
                          <ExpandLess />
                        ) : (
                          <ExpandMore />
                        )}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell colSpan={3} sx={{ py: 0 }}>
                        <Collapse
                          in={expandedHouse === house.address}
                          timeout="auto"
                          unmountOnExit
                        >
                          <Box sx={{ p: 3, bgcolor: "#f8f9fa" }}>
                            {house.voters.map((voter: any) => (
                              <Box
                                key={voter.voter_id}
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                sx={{
                                  py: 1.5,
                                  borderBottom: 1,
                                  borderColor: "divider",
                                }}
                              >
                                <Box>
                                  <Typography
                                    variant="body1"
                                    fontWeight="medium"
                                  >
                                    {voter.full_name || "Unknown"} (
                                    {voter.age ?? "?"})
                                  </Typography>
                                  <Box display="flex" gap={1} mt={0.5}>
                                    <Chip
                                      label={voter.party || "N/A"}
                                      size="small"
                                      color={
                                        voter.party === "R"
                                          ? "error"
                                          : "primary"
                                      }
                                    />
                                    <Chip
                                      label={`Score: ${
                                        voter.turnout_score_general ?? "?"
                                      }`}
                                      size="small"
                                    />
                                  </Box>
                                </Box>

                                <Box>
                                  {voter.phone_mobile && (
                                    <IconButton
                                      color="success"
                                      onClick={() =>
                                        safeCall(voter.phone_mobile)
                                      }
                                    >
                                      <Phone />
                                    </IconButton>
                                  )}
                                  <IconButton
                                    color="primary"
                                    onClick={() => {
                                      setSelectedVoter(voter);
                                      setOpenNote(true);
                                    }}
                                  >
                                    <AddComment />
                                  </IconButton>
                                </Box>
                              </Box>
                            ))}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
            </TableBody>
          </Table>

          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={households.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </TableContainer>
      )}

      {/* Note Dialog */}
      <Dialog
        open={openNote}
        onClose={() => setOpenNote(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Canvass Note</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" gutterBottom>
            {selectedVoter?.full_name || "Unknown Voter"} •{" "}
            {selectedVoter?.address || "Unknown Address"}
          </Typography>
          <TextField
            multiline
            rows={4}
            fullWidth
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="e.g., Not home, supportive, requested yard sign..."
            sx={{ mt: 2 }}
            disabled={noteSaving}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNote(false)} disabled={noteSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddNote}
            disabled={noteSaving || !noteText.trim()}
            sx={{ bgcolor: "#B22234" }}
          >
            {noteSaving ? <CircularProgress size={20} /> : "Save Note"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="info">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
