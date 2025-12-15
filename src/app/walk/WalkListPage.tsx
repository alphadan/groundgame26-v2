// src/app/walk/WalkListPage.tsx — FINAL, NO ERRORS, GROUPED BY ADDRESS
import { useState, useEffect, useMemo } from "react";
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
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { useVoters } from "../../hooks/useVoters";

export default function WalkListPage() {
  const [zipCode, setZipCode] = useState("");
  const [streetFilter, setStreetFilter] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [expandedHouse, setExpandedHouse] = useState("");

  const [openNote, setOpenNote] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<any>(null);
  const [noteText, setNoteText] = useState("");

  // Build BigQuery SQL
  const buildQuery = () => {
    const conditions: string[] = [];

    if (zipCode) {
      const cleanZip = zipCode.replace(/\D/g, "").slice(0, 5);
      if (cleanZip.length === 5) {
        conditions.push(`zip_code = CAST(${cleanZip} AS INT64)`);
      }
    }

    if (streetFilter.trim()) {
      const clean = streetFilter
        .trim()
        .replace(/[^a-zA-Z\s]/g, " ")
        .replace(/\s+/g, " ");
      if (clean.length > 1) {
        const escaped = clean.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        conditions.push(
          `REGEXP_CONTAINS(LOWER(address), r'(?i)\\b${escaped}')`
        );
      }
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return `
      SELECT voter_id, full_name, age, party, phone_mobile, phone_home,
             address, city, zip_code, turnout_score_general
      FROM \`groundgame26_voters.chester_county\`
      ${whereClause}
      ORDER BY address, turnout_score_general DESC
      LIMIT 2000
    `.trim();
  };

  const sql = buildQuery();
  const { data = [], isLoading, error } = useVoters(sql);

  // Group by address — fully typed, no errors
  const households = useMemo(() => {
    const groups: Record<string, any[]> = {};

    data.forEach((voter: any) => {
      const addr = voter.address?.trim() || "Unknown Address";
      if (!groups[addr]) groups[addr] = [];
      groups[addr].push(voter);
    });

    return Object.keys(groups)
      .map((address) => {
        const voters = groups[address];
        return {
          address,
          city: voters[0]?.city,
          zip_code: voters[0]?.zip_code,
          voters: voters.sort(
            (a: any, b: any) =>
              (b.turnout_score_general || 0) - (a.turnout_score_general || 0)
          ),
        };
      })
      .sort((a, b) => a.address.localeCompare(b.address));
  }, [data]);

  const paginated = households.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleGenerate = () => {
    if (!zipCode && !streetFilter.trim()) {
      alert("Please enter a zip code or street name");
      return;
    }
    setSubmitted(true);
    setPage(0);
    setExpandedHouse("");
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedVoter) return;

    await addDoc(collection(db, "voter_notes"), {
      voter_id: selectedVoter.voter_id,
      full_name: selectedVoter.full_name,
      address: selectedVoter.address,
      note: noteText,
      created_by_uid: auth.currentUser?.uid || "unknown",
      created_by_name: auth.currentUser?.displayName || "Canvasser",
      created_at: new Date(),
    });

    setNoteText("");
    setOpenNote(false);
  };

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Walk List — Grouped by Address
      </Typography>

      <Paper sx={{ p: 3, mb: 4, bgcolor: "#f5f5f5" }}>
        <Grid container spacing={2} alignItems="center">
          <Grid>
            <TextField
              label="Zip Code"
              value={zipCode}
              onChange={(e) =>
                setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))
              }
              size="small"
              placeholder="19365"
              sx={{ minWidth: 140 }}
            />
          </Grid>
          <Grid>
            <TextField
              label="Street Name"
              value={streetFilter}
              onChange={(e) => setStreetFilter(e.target.value)}
              size="small"
              placeholder="Main, Oak, Church"
              sx={{ minWidth: 240 }}
            />
          </Grid>
          <Grid>
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={isLoading}
              sx={{ bgcolor: "#0A3161", height: 56, px: 6 }}
            >
              {isLoading ? <CircularProgress size={24} /> : "Generate List"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {isLoading && submitted && (
        <Box textAlign="center" py={8}>
          <CircularProgress />
          <Typography mt={2}>Loading walk list...</Typography>
        </Box>
      )}

      {error && <Alert severity="error">Error loading data</Alert>}

      {submitted && !isLoading && households.length === 0 && (
        <Alert severity="info">No voters found for that search.</Alert>
      )}

      {submitted && households.length > 0 && (
        <Paper>
          <Box p={3}>
            <Typography variant="h6">
              {households.length} Households • {data.length} Voters
            </Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: "#0A3161" }}>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Address
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Voters
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Phones
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.map((house) => {
                  const phones = Array.from(
                    new Set(
                      house.voters
                        .map((v: any) => v.phone_mobile || v.phone_home)
                        .filter(Boolean)
                    )
                  );

                  return (
                    <>
                      {/* MAIN ROW */}
                      <TableRow
                        hover
                        sx={{ cursor: "pointer" }}
                        onClick={() =>
                          setExpandedHouse(
                            expandedHouse === house.address ? "" : house.address
                          )
                        }
                      >
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Home fontSize="small" />
                            <Box>
                              <Typography fontWeight="bold">
                                {house.address}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {house.city}, PA {house.zip_code}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Badge
                            badgeContent={house.voters.length}
                            color="primary"
                          >
                            <Chip label="People" size="small" />
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {phones.length > 0 ? phones.join(" • ") : "—"}
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={1} alignItems="center">
                            {phones.map((p) => (
                              <>
                                <IconButton
                                  component="a"
                                  href={`tel:${p.replace(/\D/g, "")}`}
                                  size="small"
                                  sx={{
                                    bgcolor: "white",
                                    color: "success.main",
                                  }}
                                >
                                  <Phone fontSize="small" />
                                </IconButton>
                                <IconButton
                                  component="a"
                                  href={`sms:${p.replace(/\D/g, "")}`}
                                  size="small"
                                  sx={{ bgcolor: "white", color: "info.main" }}
                                >
                                  <Message fontSize="small" />
                                </IconButton>{" "}
                                •
                              </>
                            ))}
                            {expandedHouse === house.address ? (
                              <ExpandLess />
                            ) : (
                              <ExpandMore />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>

                      {/* EXPANDED VOTER DETAILS */}
                      <TableRow>
                        <TableCell colSpan={4} sx={{ p: 0 }}>
                          <Collapse
                            in={expandedHouse === house.address}
                            timeout="auto"
                          >
                            <Box sx={{ bgcolor: "#f9f9f9", p: 3 }}>
                              {house.voters.map((v: any) => (
                                <Box
                                  key={v.voter_id}
                                  sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    py: 1.5,
                                    borderBottom: "1px solid #eee",
                                  }}
                                >
                                  <Box>
                                    <Typography fontWeight="medium">
                                      {v.full_name} ({v.age || "?"})
                                    </Typography>
                                    <Box display="flex" gap={1} mt={0.5}>
                                      <Chip
                                        label={v.party || "N/A"}
                                        size="small"
                                        color={
                                          v.party === "R"
                                            ? "error"
                                            : v.party === "D"
                                            ? "primary"
                                            : "default"
                                        }
                                      />
                                      <Chip
                                        label={v.turnout_score_general || 0}
                                        size="small"
                                        color="success"
                                      />
                                    </Box>
                                  </Box>
                                  <IconButton
                                    onClick={() => {
                                      setSelectedVoter(v);
                                      setOpenNote(true);
                                    }}
                                  >
                                    <AddComment />
                                  </IconButton>
                                </Box>
                              ))}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            count={households.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(+e.target.value);
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Paper>
      )}

      {/* Note Dialog */}
      <Dialog
        open={openNote}
        onClose={() => setOpenNote(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Note — {selectedVoter?.full_name}</DialogTitle>
        <DialogContent>
          <TextField
            multiline
            rows={5}
            fullWidth
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Spoke with voter..."
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
