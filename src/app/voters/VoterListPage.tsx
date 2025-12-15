// src/app/voters/VoterListPage.tsx — FINAL & 100% WORKING
import { useVoters } from "../../hooks/useVoters";
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
import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

const PRECINCTS = [
  { value: "", label: "All Precincts" },
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
  const [selectedPrecinct, setSelectedPrecinct] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Note-taking state
  const [openNote, setOpenNote] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [voterNotes, setVoterNotes] = useState<Record<string, any[]>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>(
    {}
  );

  // Dynamic query — includes voter_id
  const VOTER_LIST_SQL = selectedPrecinct
    ? `
    SELECT
      voter_id,
      full_name,
      age,
      gender,
      party,
      modeled_party,
      phone_home,
      phone_mobile,
      address,
      turnout_score_general,
      mail_ballot_returned,
      likely_mover,
      precinct
    FROM \`groundgame26_voters.chester_county\`
    WHERE precinct = '${selectedPrecinct}'
    ORDER BY turnout_score_general DESC
    LIMIT 1000
  `
    : `
    SELECT
      voter_id,
      full_name,
      age,
      gender,
      party,
      modeled_party,
      phone_home,
      phone_mobile,
      address,
      turnout_score_general,
      mail_ballot_returned,
      likely_mover,
      precinct
    FROM \`groundgame26_voters.chester_county\`
    ORDER BY turnout_score_general DESC
    LIMIT 1000
  `;

  const { data = [], isLoading, error } = useVoters(VOTER_LIST_SQL);

  const handleGenerateList = () => {
    if (!selectedPrecinct) {
      alert("Please select a precinct first");
      return;
    }
    setSubmitted(true);
    setPage(0);
  };

  // Call & Text functions
  const call = (phone: string) =>
    window.open(`tel:${phone.replace(/\D/g, "")}`);
  const text = (phone: string) =>
    window.open(`sms:${phone.replace(/\D/g, "")}`);

  // Real-time notes using voter_id
  useEffect(() => {
    if (!data.length) return;

    const unsubscribes: Unsubscribe[] = data.map((voter: any) => {
      if (!voter.voter_id) return () => {};

      const q = query(
        collection(db, "voter_notes"),
        where("voter_id", "==", voter.voter_id),
        orderBy("created_at", "desc")
      );

      return onSnapshot(q, (snapshot) => {
        const notes = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setVoterNotes((prev) => ({ ...prev, [voter.voter_id]: notes }));
      });
    });

    return () => unsubscribes.forEach((unsub) => unsub?.());
  }, [data]);

  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedVoter || !auth.currentUser) return;

    try {
      await addDoc(collection(db, "voter_notes"), {
        voter_id: selectedVoter.voter_id,
        full_name: selectedVoter.full_name,
        address: selectedVoter.address,
        note: noteText,
        created_by_uid: auth.currentUser.uid,
        created_by_name:
          auth.currentUser.displayName ||
          auth.currentUser.email?.split("@")[0] ||
          "User",
        created_at: new Date(),
      });

      setNoteText("");
      setOpenNote(false);
    } catch (err) {
      console.error("Failed to save note", err);
      alert("Failed to save note");
    }
  };

  const paginatedData = data.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Voter Contact List — Your Precincts
      </Typography>

      {/* PRECINCT FILTER */}
      <Paper sx={{ p: 3, mb: 4, bgcolor: "#f5f5f5" }}>
        <Grid container spacing={2} alignItems="center">
          <Grid>
            <FormControl fullWidth size="small" sx={{ minWidth: 300 }}>
              <InputLabel
                sx={{ color: "#0A3161", "&.Mui-focused": { color: "#0A3161" } }}
              >
                Filter by Precinct
              </InputLabel>
              <Select
                value={selectedPrecinct}
                onChange={(e) => {
                  setSelectedPrecinct(e.target.value);
                  setPage(0);
                }}
                sx={{
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#0A3161",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#0A3161",
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#0A3161",
                  },
                  "& .MuiSvgIcon-root": { color: "#0A3161" },
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
              sx={{
                bgcolor: selectedPrecinct ? "#0A3161" : "#cccccc",
                "&:hover": {
                  bgcolor: selectedPrecinct ? "#0d47a1" : "#cccccc",
                },
                px: 6,
              }}
              onClick={handleGenerateList}
              disabled={!selectedPrecinct || isLoading}
            >
              {isLoading ? "Loading..." : "Generate List"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {submitted && isLoading && (
        <Box textAlign="center" py={8}>
          <CircularProgress />
          <Typography mt={2}>
            Loading voters for precinct {selectedPrecinct}...
          </Typography>
        </Box>
      )}
      {error && <Alert severity="error">{(error as Error).message}</Alert>}

      {submitted && !isLoading && data.length === 0 && (
        <Alert severity="info">
          No voters found in precinct {selectedPrecinct}.
        </Alert>
      )}

      {submitted && !isLoading && !error && data.length > 0 && (
        <Paper>
          <Box
            p={3}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">
              {data.length.toLocaleString()} Total Voters
            </Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: "#0A3161" }}>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Name
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Age
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Party
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Modeled Party
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Phone
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Turnout
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Mail Ballot
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((voter: any) => {
                  const notes = voterNotes[voter.voter_id] || [];

                  return (
                    <TableRow key={voter.voter_id} hover>
                      <TableCell>{voter.full_name || "—"}</TableCell>
                      <TableCell>{voter.age || "—"}</TableCell>

                      {/* PARTY */}
                      <TableCell>
                        <Chip
                          label={voter.party || "NF"}
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

                      {/* MODELED PARTY */}
                      <TableCell>
                        <Chip
                          label={voter.modeled_party || "—"}
                          size="small"
                          color={
                            voter.modeled_party?.includes("Hard R")
                              ? "error"
                              : voter.modeled_party?.includes("Weak R")
                              ? "warning"
                              : voter.modeled_party?.includes("Swing")
                              ? "default"
                              : voter.modeled_party?.includes("Weak D")
                              ? "info"
                              : voter.modeled_party?.includes("Hard D")
                              ? "primary"
                              : "default"
                          }
                        />
                      </TableCell>

                      <TableCell>
                        {voter.phone_mobile || voter.phone_home || "—"}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={voter.turnout_score_general || 0}
                          color="success"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {voter.mail_ballot_returned ? "Yes" : "No"}
                      </TableCell>

                      {/* ACTIONS + NOTES */}
                      <TableCell>
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            mb: notes.length > 0 ? 3 : 1,
                          }}
                        >
                          {(voter.phone_mobile || voter.phone_home) && (
                            <Box
                              sx={{
                                display: "flex",
                                gap: 1,
                                alignItems: "center",
                                flexWrap: "wrap",
                              }}
                            >
                              <Button
                                component="a"
                                href={`tel:${(
                                  voter.phone_mobile ||
                                  voter.phone_home ||
                                  ""
                                ).replace(/\D/g, "")}`}
                                startIcon={<Phone />}
                                size="small"
                                variant="outlined"
                                sx={{
                                  minWidth: { xs: "40px", sm: "auto" },
                                  px: { xs: 1, sm: 2 },
                                  backgroundColor: "white",
                                  color: "#2e7d32",
                                  borderColor: "#2e7d32",
                                  "&:hover": {
                                    backgroundColor: "#f1f8e9",
                                    borderColor: "#2e7d32",
                                    color: "#2e7d32",
                                  },
                                  "& .MuiSvgIcon-root": {
                                    color: "#2e7d32",
                                  },
                                }}
                              >
                                <Box
                                  component="span"
                                  sx={{ display: { xs: "none", sm: "inline" } }}
                                >
                                  Call
                                </Box>
                              </Button>

                              <Button
                                component="a"
                                href={`sms:${(
                                  voter.phone_mobile ||
                                  voter.phone_home ||
                                  ""
                                ).replace(/\D/g, "")}`}
                                startIcon={<Message />}
                                size="small"
                                variant="outlined"
                                sx={{
                                  minWidth: { xs: "40px", sm: "auto" },
                                  px: { xs: 1, sm: 2 },
                                  backgroundColor: "white",
                                  color: "#1976d2",
                                  borderColor: "#1976d2",
                                  "&:hover": {
                                    backgroundColor: "#e3f2fd",
                                    borderColor: "#1565c0",
                                    color: "#1565c0",
                                  },
                                  "& .MuiSvgIcon-root": {
                                    color: "#1976d2",
                                  },
                                  "&:hover .MuiSvgIcon-root": {
                                    color: "#1565c0",
                                  },
                                }}
                              >
                                <Box
                                  component="span"
                                  sx={{ display: { xs: "none", sm: "inline" } }}
                                >
                                  Text
                                </Box>
                              </Button>
                            </Box>
                          )}
                          {voter.email && (
                            <Button
                              size="small"
                              startIcon={<MailOutline />}
                              onClick={() =>
                                window.open(`mailto:${voter.email}`)
                              }
                              sx={{ color: "#0A3161" }}
                            >
                              Email
                            </Button>
                          )}
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => {
                              setSelectedVoter(voter);
                              setOpenNote(true);
                            }}
                          >
                            <AddComment />
                          </IconButton>
                        </Box>

                        {/* TOGGLE NOTES BUTTON */}
                        {notes.length > 0 && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={
                              expandedNotes[voter.voter_id] ? (
                                <ExpandLess />
                              ) : (
                                <ExpandMore />
                              )
                            }
                            onClick={() =>
                              setExpandedNotes((prev) => ({
                                ...prev,
                                [voter.voter_id]: !prev[voter.voter_id],
                              }))
                            }
                            sx={{ mt: 1 }}
                          >
                            {expandedNotes[voter.voter_id]
                              ? "Hide"
                              : `Show Notes (${notes.length})`}
                          </Button>
                        )}

                        {/* COLLAPSIBLE NOTES */}
                        <Collapse
                          in={expandedNotes[voter.voter_id]}
                          timeout="auto"
                          unmountOnExit
                        >
                          <Box sx={{ mt: 2 }}>
                            {notes.map((note: any) => (
                              <Paper
                                key={note.id}
                                sx={{
                                  p: 2,
                                  mb: 2,
                                  bgcolor: "#f0f7ff",
                                  borderLeft: "4px solid #0A3161",
                                }}
                              >
                                <Box
                                  display="flex"
                                  alignItems="center"
                                  gap={1}
                                  mb={1}
                                >
                                  <Avatar
                                    sx={{
                                      width: 28,
                                      height: 28,
                                      fontSize: "0.8rem",
                                    }}
                                  >
                                    {note.created_by_name?.[0] || "U"}
                                  </Avatar>
                                  <Box>
                                    <Typography
                                      variant="caption"
                                      fontWeight="bold"
                                    >
                                      {note.created_by_name}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      display="block"
                                    >
                                      {new Date(
                                        note.created_at?.seconds * 1000
                                      ).toLocaleString()}
                                    </Typography>
                                  </Box>
                                </Box>
                                <Typography variant="body2">
                                  {note.note}
                                </Typography>
                              </Paper>
                            ))}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

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
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Paper>
      )}

      {/* ADD NOTE DIALOG */}
      <Dialog
        open={openNote}
        onClose={() => setOpenNote(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Note for {selectedVoter?.full_name}</DialogTitle>
        <DialogContent>
          <TextField
            multiline
            rows={6}
            fullWidth
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="e.g. Spoke to wife — very supportive, will vote R"
            variant="outlined"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNote(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddNote}
            disabled={!noteText.trim()}
          >
            Save Note
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
