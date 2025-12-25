// src/app/voters/VoterListPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../lib/db";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  Snackbar,
} from "@mui/material";
import {
  Phone,
  Message,
  Home,
  AddComment,
  ExpandLess,
  ExpandMore,
} from "@mui/icons-material";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

// === Custom hook for parameterized voter list ===
const useVoterList = (precinctCode: string | null) => {
  const { callFunction } = useCloudFunctions();

  return useQuery({
    queryKey: ["voterList", precinctCode],
    queryFn: async (): Promise<any[]> => {
      if (!precinctCode) return [];

      const result = await callFunction<{ voters: any[] }>(
        "getVotersByPrecinct",
        {
          precinctCode,
        }
      );

      return result.voters ?? [];
    },
    enabled: !!precinctCode,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

export default function VoterListPage() {
  const { user, isLoaded } = useAuth();
  const { callFunction } = useCloudFunctions();

  const [selectedPrecinctCode, setSelectedPrecinctCode] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Note dialog
  const [openNote, setOpenNote] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // Real-time notes
  const [voterNotes, setVoterNotes] = useState<Record<string, any[]>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>(
    {}
  );

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // === Load precincts from IndexedDB ===
  const precincts =
    useLiveQuery(() =>
      indexedDb.precincts.where("active").equals(1).toArray()
    ) ?? [];

  const precinctOptions = useMemo(
    () =>
      precincts.map((p) => ({
        value: p.precinct_code,
        label: `${p.precinct_code} - ${p.name}`,
      })),
    [precincts]
  );

  // === Parameterized voter data ===
  const {
    data: voters = [],
    isLoading,
    error,
  } = useVoterList(submitted ? selectedPrecinctCode : null);

  // === Real-time notes ===
  useEffect(() => {
    if (!selectedPrecinctCode || !submitted) {
      setVoterNotes({});
      return;
    }

    const q = query(
      collection(db, "voter_notes"),
      where("precinct", "==", selectedPrecinctCode),
      orderBy("created_at", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const grouped: Record<string, any[]> = {};
        snapshot.forEach((doc) => {
          const d = doc.data();
          const vid = d.voter_id;
          if (vid) {
            if (!grouped[vid]) grouped[vid] = [];
            grouped[vid].push({ id: doc.id, ...d });
          }
        });
        setVoterNotes(grouped);
      },
      (err) => {
        console.error("Notes sync error:", err);
        setSnackbarMessage("Failed to sync notes");
        setSnackbarOpen(true);
      }
    );

    return unsubscribe;
  }, [selectedPrecinctCode, submitted]);

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
    if (!user || !selectedVoter || !noteText.trim()) return;

    setNoteSaving(true);
    try {
      await addDoc(collection(db, "voter_notes"), {
        voter_id: selectedVoter.voter_id ?? null,
        precinct: selectedPrecinctCode,
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
    } catch (err: any) {
      console.error("Note save failed:", err);
      setSnackbarMessage("Failed to save note");
      setSnackbarOpen(true);
    } finally {
      setNoteSaving(false);
    }
  }, [user, selectedVoter, noteText, selectedPrecinctCode]);

  const handleGenerate = useCallback(() => {
    if (!selectedPrecinctCode) {
      setSnackbarMessage("Please select a precinct");
      setSnackbarOpen(true);
      return;
    }
    setSubmitted(true);
    setPage(0);
  }, [selectedPrecinctCode]);

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
        Voter Contact List
      </Typography>

      <Paper sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="end">
          <Grid>
            <FormControl fullWidth>
              <InputLabel>Select Precinct</InputLabel>
              <Select
                value={selectedPrecinctCode}
                onChange={(e) => setSelectedPrecinctCode(e.target.value)}
                label="Select Precinct"
              >
                <MenuItem value="">
                  <em>Choose a precinct...</em>
                </MenuItem>
                {precinctOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid>
            <Button
              variant="contained"
              fullWidth
              onClick={handleGenerate}
              disabled={isLoading || !selectedPrecinctCode}
              sx={{ bgcolor: "#B22234", height: 56 }}
            >
              {isLoading ? "Loading..." : "Generate List"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {(error as Error).message}
        </Alert>
      )}

      {submitted && !isLoading && voters.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No voters found for this precinct.
        </Alert>
      )}

      {submitted && voters.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            {/* Your table header and body – same as before */}
            {/* Use 'voters' instead of 'data' */}
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
      )}

      {/* Note Dialog and Snackbar – same as previous */}
      {/* ... */}

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
