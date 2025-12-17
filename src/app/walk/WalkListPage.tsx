import React, { useState, useMemo } from "react";
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
} from "@mui/material";
import {
  Phone,
  Message,
  Home,
  ExpandMore,
  ExpandLess,
  AddComment,
} from "@mui/icons-material";
import { collection, addDoc } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { useVoters } from "../../hooks/useVoters";
import { useAuth } from "../../context/AuthContext"; // Integrated Auth

export default function WalkListPage() {
  const { user, isLoaded } = useAuth(); // Monitor identity state
  const [zipCode, setZipCode] = useState("");
  const [streetFilter, setStreetFilter] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [expandedHouse, setExpandedHouse] = useState("");

  const [openNote, setOpenNote] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<any>(null);
  const [noteText, setNoteText] = useState("");

  // 1. MEMOIZED SQL GENERATION
  const sqlQuery = useMemo(() => {
    if (!submitted) return "";

    const conditions: string[] = [];
    if (zipCode.length === 5) {
      conditions.push(
        `zip_code = CAST(${zipCode.replace(/\D/g, "")} AS INT64)`
      );
    }

    if (streetFilter.trim()) {
      const clean = streetFilter.trim().replace(/'/g, "\\'"); // Basic SQL Escaping
      conditions.push(`REGEXP_CONTAINS(LOWER(address), r'(?i)\\b${clean}')`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return `
      SELECT voter_id, full_name, age, party, phone_mobile, phone_home, address, city, zip_code, turnout_score_general, precinct
      FROM \`groundgame26_voters.chester_county\`
      ${whereClause}
      ORDER BY address, turnout_score_general DESC
      LIMIT 2000
    `.trim();
  }, [submitted, zipCode, streetFilter]);

  const { data = [], isLoading, error } = useVoters(sqlQuery);

  // 2. HOUSEHOLD GROUPING LOGIC
  const households = useMemo(() => {
    const groups: Record<string, any[]> = {};
    data.forEach((voter: any) => {
      const addr = voter.address?.trim() || "Unknown Address";
      if (!groups[addr]) groups[addr] = [];
      groups[addr].push(voter);
    });

    return Object.keys(groups)
      .map((address) => ({
        address,
        city: groups[address][0]?.city,
        zip_code: groups[address][0]?.zip_code,
        voters: groups[address].sort(
          (a, b) =>
            (b.turnout_score_general || 0) - (a.turnout_score_general || 0)
        ),
      }))
      .sort((a, b) => a.address.localeCompare(b.address));
  }, [data]);

  const handleGenerate = () => {
    if (zipCode.length < 5 && !streetFilter.trim()) {
      alert("Please provide a 5-digit zip code or a street name.");
      return;
    }
    setSubmitted(true);
    setPage(0);
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedVoter || !user) return;
    try {
      await addDoc(collection(db, "voter_notes"), {
        voter_id: selectedVoter.voter_id,
        precinct: selectedVoter.precinct,
        full_name: selectedVoter.full_name,
        address: selectedVoter.address,
        note: noteText,
        created_by_uid: user.uid,
        created_by_name: user.displayName || user.email,
        created_at: new Date(),
      });
      setNoteText("");
      setOpenNote(false);
    } catch (err) {
      alert("Failed to save note. Check permissions.");
    }
  };

  // --- RENDERING GATEKEEPER ---
  if (!isLoaded)
    return (
      <Box display="flex" justifyContent="center" py={10}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Canvassing Walk List
      </Typography>
      <Typography variant="body2" color="textSecondary" mb={4}>
        Grouped by address for efficient door-knocking.
      </Typography>

      <Paper sx={{ p: 3, mb: 4, bgcolor: "#f8f9fa", borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid>
            <TextField
              label="Zip Code"
              fullWidth
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.slice(0, 5))}
              size="small"
            />
          </Grid>
          <Grid>
            <TextField
              label="Street Name"
              fullWidth
              value={streetFilter}
              onChange={(e) => setStreetFilter(e.target.value)}
              size="small"
              placeholder="e.g. Main St"
            />
          </Grid>
          <Grid>
            <Button
              variant="contained"
              fullWidth
              sx={{ bgcolor: "#0A3161", height: 40 }}
              onClick={handleGenerate}
              disabled={isLoading}
            >
              {isLoading ? "Fetching..." : "Generate List"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading walk list: {(error as Error).message}
        </Alert>
      )}

      {submitted && households.length > 0 && (
        <TableContainer
          component={Paper}
          sx={{ borderRadius: 2, boxShadow: 3 }}
        >
          <Table>
            <TableHead sx={{ bgcolor: "#0A3161" }}>
              <TableRow>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                  Property Address
                </TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                  Households
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ color: "white", fontWeight: "bold" }}
                >
                  Actions
                </TableCell>
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
                          <Typography fontWeight="bold">
                            {house.address}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Badge
                          badgeContent={house.voters.length}
                          color="error"
                          overlap="circular"
                        >
                          <Chip label="Voters" size="small" />
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
                          <Box sx={{ p: 2, bgcolor: "#f1f3f5" }}>
                            {house.voters.map((v: any) => (
                              <Box
                                key={v.voter_id}
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                sx={{
                                  py: 1,
                                  borderBottom: "1px solid #dee2e6",
                                }}
                              >
                                <Box>
                                  <Typography variant="body2" fontWeight="bold">
                                    {v.full_name} ({v.age})
                                  </Typography>
                                  <Chip
                                    label={v.party}
                                    size="small"
                                    color={
                                      v.party === "R" ? "error" : "primary"
                                    }
                                    sx={{ height: 20, fontSize: 10, mt: 0.5 }}
                                  />
                                </Box>
                                <Box>
                                  <IconButton
                                    color="success"
                                    onClick={() =>
                                      window.open(`tel:${v.phone_mobile}`)
                                    }
                                  >
                                    <Phone />
                                  </IconButton>
                                  <IconButton
                                    color="primary"
                                    onClick={() => {
                                      setSelectedVoter(v);
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
            component="div"
            count={households.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => setRowsPerPage(+e.target.value)}
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
        <DialogTitle>Canvass Note: {selectedVoter?.full_name}</DialogTitle>
        <DialogContent>
          <TextField
            multiline
            rows={4}
            fullWidth
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Door knocked, voter was..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNote(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddNote}
            disabled={!noteText.trim()}
            sx={{ bgcolor: "#B22234" }}
          >
            Save Entry
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
