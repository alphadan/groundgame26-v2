// src/app/voters/VoterListPage.tsx
import React, { useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDynamicVoters } from "../../hooks/useDynamicVoters"; // ← Shared hook
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  TextField,
  Button,
} from "@mui/material";
import { Phone, Message, AddComment } from "@mui/icons-material";
import DownloadIcon from "@mui/icons-material/Download";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { FilterValues } from "../../types";

export default function VoterListPage() {
  const { user, isLoaded: authLoaded } = useAuth();

  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Note dialog
  const [openNote, setOpenNote] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // === Voter data from dynamic query ===
  const { data: voters = [], isLoading, error } = useDynamicVoters(filters);

  // === Submit handler ===
  const handleSubmit = useCallback((submittedFilters: FilterValues) => {
    // Optional: require precinct for VoterList
    if (!submittedFilters.precinct) {
      setSnackbarMessage("Please select a precinct");
      setSnackbarOpen(true);
      return;
    }

    setFilters(submittedFilters);
    setIsSubmitting(true);
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

  // === Save note ===
  const handleAddNote = useCallback(async () => {
    if (!user || !selectedVoter || !noteText.trim() || !filters?.precinct)
      return;

    setNoteSaving(true);
    try {
      await addDoc(collection(db, "voter_notes"), {
        voter_id: selectedVoter.voter_id ?? null,
        precinct: filters.precinct,
        full_name: selectedVoter.full_name ?? "Unknown",
        address: selectedVoter.address ?? "Unknown",
        note: noteText.trim(),
        created_by_uid: user.uid,
        created_by_name:
          user.displayName || user.email?.split("@")[0] || "User",
        created_at: new Date(),
      });

      setSnackbarMessage("Note saved successfully");
      setSnackbarOpen(true);
      setNoteText("");
      setOpenNote(false);
    } catch (err) {
      console.error("Note save failed:", err);
      setSnackbarMessage("Failed to save note");
      setSnackbarOpen(true);
    } finally {
      setNoteSaving(false);
    }
  }, [user, selectedVoter, noteText, filters?.precinct]);

  const handleDownloadCSV = useCallback(() => {
    if (!voters || voters.length === 0) return;

    const headers = [
      "Full Name",
      "Age",
      "Party",
      "Address",
      "City",
      "Zip Code",
      "Phone Mobile",
      "Phone Home",
      "Precinct",
      "Modeled Party",
      "Turnout Score",
      "Has Mail Ballot",
    ];

    const rows = voters.map((voter: any) => [
      voter.full_name || "",
      voter.age || "",
      voter.party || "",
      voter.address || "",
      voter.city || "",
      voter.zip_code || "",
      voter.phone_mobile || "",
      voter.phone_home || "",
      voter.precinct || "",
      voter.modeled_party || "",
      voter.turnout_score_general || "",
      voter.has_mail_ballot ? "Yes" : "No",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((field) => `"${(field + "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `voter_list_${new Date().toISOString().slice(0, 10)}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSnackbarMessage(`Downloaded ${voters.length} voters as CSV`);
    setSnackbarOpen(true);
  }, [voters]);

  if (!authLoaded) {
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
        Voter Contact List
      </Typography>

      {/* === FilterSelector with advanced filters === */}
      <FilterSelector
        onSubmit={handleSubmit}
        isLoading={isSubmitting && isLoading}
        unrestrictedFilters={[
          "modeledParty",
          "turnout",
          "ageGroup",
          "mailBallot",
        ]}
      />

      {/* === Error / Empty States === */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load voters. Please try again.
        </Alert>
      )}

      {filters && !isLoading && voters.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No voters found matching your filters.
        </Alert>
      )}

      {/* === Voter Table === */}
      {filters && voters.length > 0 && (
        <>
          {/* Download Button */}
          <Box sx={{ mb: 3, textAlign: "right" }}>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadCSV}
              sx={{ bgcolor: "#B22234", "&:hover": { bgcolor: "#8B1A1A" } }}
            >
              Download CSV
            </Button>
          </Box>
          <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
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
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Note
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {voters
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((voter: any) => (
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
                      <TableCell>
                        <IconButton
                          onClick={() => {
                            setSelectedVoter(voter);
                            setOpenNote(true);
                          }}
                        >
                          <AddComment fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

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
          </TableContainer>
        </>
      )}

      {/* === Note Dialog === */}
      <Dialog
        open={openNote}
        onClose={() => setOpenNote(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Note for {selectedVoter?.full_name}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Note"
            fullWidth
            multiline
            rows={4}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNote(false)}>Cancel</Button>
          <Button
            onClick={handleAddNote}
            disabled={noteSaving || !noteText.trim()}
            color="primary"
          >
            {noteSaving ? "Saving..." : "Save Note"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* === Snackbar === */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="info">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
