// src/app/voters/NameSearchPage.tsx — FINAL & PERFECT
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
  TextField,
  Grid,
} from "@mui/material";
import { Phone, Message, MailOutline } from "@mui/icons-material";
import { useState } from "react";

export default function NameSearchPage() {
  const [nameInput, setNameInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Always call useVoters — but pass empty string when not ready
  const sqlQuery =
    submitted && nameInput.trim().length >= 3
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
    WHERE LOWER(full_name) LIKE LOWER('%${nameInput.trim()}%')
    ORDER BY turnout_score_general DESC
    LIMIT 1000
  `.trim()
      : "";

  // ALWAYS call useVoters — empty string = no query (your hook should handle this)
  const { data = [], isLoading, error } = useVoters(sqlQuery);

  const handleSearch = () => {
    if (nameInput.trim().length < 3) {
      alert("Please enter at least 3 characters");
      return;
    }
    setSubmitted(true);
    setPage(0);
  };

  const paginatedData = data.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const call = (phone: string) =>
    window.open(`tel:${phone.replace(/\D/g, "")}`);
  const text = (phone: string) =>
    window.open(`sms:${phone.replace(/\D/g, "")}`);

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Name Search — Find Any Voter
      </Typography>

      <Paper sx={{ p: 4, mb: 6 }}>
        <Typography variant="h6" gutterBottom color="#0A3161">
          Search by Name
        </Typography>

        <Grid container spacing={3} alignItems="center">
          <Grid>
            <TextField
              label="Enter Name"
              fullWidth
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. John Smith"
              helperText={`Type at least 3 characters (${nameInput.length}/3)`}
              inputProps={{ maxLength: 50 }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  "& fieldset": {
                    borderColor: nameInput.length >= 3 ? "#0A3161" : "#ccc",
                  },
                  "&:hover fieldset": {
                    borderColor: nameInput.length >= 3 ? "#0A3161" : "#ccc",
                  },
                  "&.Mui-focused fieldset": { borderColor: "#0A3161" },
                },
              }}
            />
          </Grid>
          <Grid>
            <Button
              variant="contained"
              size="large"
              sx={{
                bgcolor: nameInput.length >= 3 ? "#0A3161" : "#cccccc",
                "&:hover": {
                  bgcolor: nameInput.length >= 3 ? "#0d47a1" : "#cccccc",
                },
                px: 6,
              }}
              onClick={handleSearch}
              disabled={nameInput.length < 3 || isLoading}
            >
              {isLoading ? "Searching..." : "Search Voters"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* NO QUERY ON LOAD — useVoters("") returns empty safely */}
      {submitted && isLoading && (
        <Box textAlign="center" py={8}>
          <CircularProgress />
          <Typography mt={2}>Searching for "{nameInput}"...</Typography>
        </Box>
      )}

      {error && <Alert severity="error">Error loading data.</Alert>}

      {submitted && !isLoading && !error && data.length === 0 && (
        <Alert severity="info">No voters found matching "{nameInput}".</Alert>
      )}

      {submitted && !isLoading && !error && data.length > 0 && (
        <Paper>
          <Box p={3}>
            <Typography variant="h6">
              {data.length.toLocaleString()} Voter{data.length !== 1 ? "s" : ""}{" "}
              Found
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
                    Precinct
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((voter: any) => (
                  <TableRow key={voter.voter_id} hover>
                    <TableCell>{voter.full_name || "—"}</TableCell>
                    <TableCell>{voter.age || "—"}</TableCell>
                    <TableCell>
                      <Chip
                        label={voter.party || "—"}
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
                    <TableCell>{voter.precinct || "—"}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        {(voter.phone_mobile || voter.phone_home) && (
                          <>
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
                          </>
                        )}
                        {voter.email && (
                          <Button
                            size="small"
                            startIcon={<MailOutline />}
                            onClick={() => window.open(`mailto:${voter.email}`)}
                            sx={{ color: "#0A3161" }}
                          >
                            Email
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
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
    </Box>
  );
}
