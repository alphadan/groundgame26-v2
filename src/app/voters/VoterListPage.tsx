// src/app/voters/VoterListPage.tsx
import { useState, useEffect } from "react";
import { useVoters } from "../../hooks/useVoters";
import { useAuth } from "../../context/AuthContext"; // Central Identity Gatekeeper
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
  TextField,
  Avatar,
  Collapse,
} from "@mui/material";
import {
  Phone,
  Message,
  MailOutline,
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

const PRECINCTS = [
  { value: "5", label: "5 - Atglen" },
  { value: "225", label: "225 - East Fallowfield-E" },
  { value: "230", label: "230 - East Fallowfield-W" },
  { value: "290", label: "290 - Highland Township" },
  { value: "440", label: "440 - Parkesburg North" },
  { value: "445", label: "445 - Parkesburg South" },
  { value: "535", label: "535 - Sadsbury-North" },
  { value: "540", label: "540 - Sadsbury-South" },
  { value: "545", label: "545 - West Sadsbury" },
  { value: "235", label: "235 - West Fallowfield" },
];

export default function VoterListPage() {
  const { user, isLoaded } = useAuth(); // Monitor stable identity state
  const [selectedPrecinct, setSelectedPrecinct] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Note-taking and UI state
  const [openNote, setOpenNote] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [voterNotes, setVoterNotes] = useState<Record<string, any[]>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>(
    {}
  );

  // Dynamic BigQuery SQL — remains empty until user hits "Generate"
  const VOTER_LIST_SQL =
    submitted && selectedPrecinct
      ? `
    SELECT
      voter_id, full_name, age, gender, party, modeled_party,
      phone_home, phone_mobile, address, turnout_score_general,
      mail_ballot_returned, likely_mover, precinct
    FROM \`groundgame26_voters.chester_county\`
    WHERE precinct = '${selectedPrecinct}'
    ORDER BY turnout_score_general DESC
    LIMIT 1000
  `
      : "";

  const { data = [], isLoading, error } = useVoters(VOTER_LIST_SQL);

  /**
   * 🚀 OPTIMIZED REAL-TIME LISTENER
   * Listens to the entire precinct's notes with ONE connection.
   * This is much faster and cheaper than listening to individual voters.
   */
  useEffect(() => {
    if (!selectedPrecinct || !submitted) return;

    console.log(`🚀 Firestore: Syncing notes for Precinct ${selectedPrecinct}`);
    const q = query(
      collection(db, "voter_notes"),
      where("precinct", "==", selectedPrecinct),
      orderBy("created_at", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const grouped: Record<string, any[]> = {};
      snapshot.docs.forEach((doc) => {
        const d = doc.data();
        if (!grouped[d.voter_id]) grouped[d.voter_id] = [];
        grouped[d.voter_id].push({ id: doc.id, ...d });
      });
      setVoterNotes(grouped);
    });

    return () => unsubscribe();
  }, [selectedPrecinct, submitted]);

  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedVoter || !user) return;

    try {
      await addDoc(collection(db, "voter_notes"), {
        voter_id: selectedVoter.voter_id,
        precinct: selectedVoter.precinct, // Required for the optimized listener above
        full_name: selectedVoter.full_name,
        note: noteText,
        created_by_uid: user.uid,
        created_by_name:
          user.displayName || user.email?.split("@")[0] || "User",
        created_at: new Date(),
      });

      setNoteText("");
      setOpenNote(false);
    } catch (err) {
      console.error("Note save failed:", err);
      alert("Permission denied: Check Firestore rules for voter_notes.");
    }
  };

  const paginatedData = data.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // --- RENDERING GATEKEEPER ---
  if (!isLoaded) {
    return (
      <Box display="flex" justifyContent="center" py={10}>
        <CircularProgress sx={{ color: "#B22234" }} />
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Voter Contact List
      </Typography>

      {/* FILTER SECTION */}
      <Paper sx={{ p: 3, mb: 4, bgcolor: "#f8f9fa", borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: "#0A3161" }}>Select Precinct</InputLabel>
              <Select
                value={selectedPrecinct}
                onChange={(e) => {
                  setSelectedPrecinct(e.target.value);
                  setSubmitted(false); // Reset to force new "Generate" click
                }}
                label="Select Precinct"
                sx={{
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#0A3161",
                  },
                }}
              >
                {PRECINCTS.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    {p.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid>
            <Button
              variant="contained"
              size="large"
              sx={{ bgcolor: "#0A3161", px: 4, fontWeight: "bold" }}
              onClick={() => {
                setSubmitted(true);
                setPage(0);
              }}
              disabled={!selectedPrecinct || isLoading}
            >
              {isLoading ? "Fetching BigQuery..." : "Generate List"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(error as Error).message}
        </Alert>
      )}

      {/* VOTER TABLE */}
      {submitted && !isLoading && data.length > 0 && (
        <TableContainer
          component={Paper}
          sx={{ borderRadius: 2, boxShadow: 3 }}
        >
          <Table size="small">
            <TableHead sx={{ bgcolor: "#0A3161" }}>
              <TableRow>
                {["Voter Name", "Age", "Party", "Contact", "Activity Log"].map(
                  (header) => (
                    <TableCell
                      key={header}
                      sx={{ color: "white", fontWeight: "bold" }}
                    >
                      {header}
                    </TableCell>
                  )
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.map((voter: any) => {
                const notes = voterNotes[voter.voter_id] || [];
                return (
                  <TableRow key={voter.voter_id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {voter.full_name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {voter.address}
                      </Typography>
                    </TableCell>
                    <TableCell>{voter.age}</TableCell>
                    <TableCell>
                      <Chip
                        label={voter.party}
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
                    <TableCell>
                      <IconButton
                        color="success"
                        onClick={() =>
                          window.open(
                            `tel:${voter.phone_mobile || voter.phone_home}`
                          )
                        }
                        disabled={!voter.phone_mobile && !voter.phone_home}
                      >
                        <Phone fontSize="small" />
                      </IconButton>
                      <IconButton
                        color="info"
                        onClick={() => window.open(`sms:${voter.phone_mobile}`)}
                        disabled={!voter.phone_mobile}
                      >
                        <Message fontSize="small" />
                      </IconButton>
                    </TableCell>
                    <TableCell sx={{ minWidth: 200 }}>
                      <Button
                        size="small"
                        startIcon={<AddComment />}
                        variant="outlined"
                        onClick={() => {
                          setSelectedVoter(voter);
                          setOpenNote(true);
                        }}
                        sx={{ mb: notes.length > 0 ? 1 : 0 }}
                      >
                        Add Note
                      </Button>

                      {notes.length > 0 && (
                        <>
                          <IconButton
                            size="small"
                            onClick={() =>
                              setExpandedNotes((p) => ({
                                ...p,
                                [voter.voter_id]: !p[voter.voter_id],
                              }))
                            }
                          >
                            {expandedNotes[voter.voter_id] ? (
                              <ExpandLess />
                            ) : (
                              <ExpandMore />
                            )}
                          </IconButton>
                          <Collapse in={expandedNotes[voter.voter_id]}>
                            {notes.map((n) => (
                              <Box
                                key={n.id}
                                sx={{
                                  p: 1,
                                  mt: 1,
                                  bgcolor: "#f0f4f8",
                                  borderRadius: 1,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  display="block"
                                  fontWeight="bold"
                                >
                                  {n.created_by_name}
                                </Typography>
                                <Typography variant="caption">
                                  {n.note}
                                </Typography>
                              </Box>
                            ))}
                          </Collapse>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={data.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </TableContainer>
      )}

      {/* --- ADD NOTE DIALOG --- */}
      <Dialog
        open={openNote}
        onClose={() => setOpenNote(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: "#0A3161", color: "white" }}>
          Voter Contact: {selectedVoter?.full_name}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Log interaction details below:
          </Typography>
          <TextField
            multiline
            rows={4}
            fullWidth
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="e.g. Strongly supportive, needs mail ballot application..."
            variant="outlined"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenNote(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddNote}
            disabled={!noteText.trim()}
            sx={{ bgcolor: "#B22234" }}
          >
            Save Interaction
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
