// src/app/voters/NameSearchPage.tsx
import { useState } from "react";
import { useVoters } from "../../hooks/useVoters";
import { useAuth } from "../../context/AuthContext"; // Integrated Auth
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
} from "@mui/material";
import { Phone, Message, MailOutline } from "@mui/icons-material";

export default function NameSearchPage() {
  // 1. Monitor stable identity state
  const { isLoaded } = useAuth();
  const [nameInput, setNameInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  /**
   * 2. SQL Construction
   * We sanitize the input by removing single quotes to prevent injection.
   */
  const sanitizedInput = nameInput.trim().replace(/'/g, "''");

  const sqlQuery =
    submitted && sanitizedInput.length >= 3
      ? `
    SELECT voter_id, full_name, age, gender, party, modeled_party, phone_home, phone_mobile, address, turnout_score_general, mail_ballot_returned, likely_mover, precinct
    FROM \`groundgame26-v2.groundgame26_voters.chester_county\`
    WHERE LOWER(full_name) LIKE LOWER('%${sanitizedInput}%')
    ORDER BY turnout_score_general DESC
    LIMIT 1000
    `.trim()
      : "";

  console.log("[NameSearchPage]sqlQuery: ", sqlQuery);

  const { data = [], isLoading, error } = useVoters(sqlQuery);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault(); // Handle enter key support
    if (nameInput.trim().length < 3) return;
    setSubmitted(true);
    setPage(0);
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
        <Grid container spacing={3} alignItems="flex-start">
          <Grid>
            <TextField
              label="Voter Name"
              fullWidth
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                setSubmitted(false);
              }}
              placeholder="e.g. John Smith"
              helperText={`Enter at least 3 characters. Currently: ${nameInput.length}`}
              autoComplete="off"
            />
          </Grid>
          <Grid>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ bgcolor: "#0A3161", py: 1.8, fontWeight: "bold" }}
              disabled={nameInput.trim().length < 3 || isLoading}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Execute Search"
              )}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(error as Error).message}
        </Alert>
      )}

      {submitted && !isLoading && data.length === 0 && (
        <Alert severity="info">
          No matching records found for "{nameInput}". Try checking spelling or
          using a partial name.
        </Alert>
      )}

      {submitted && data.length > 0 && (
        <Paper sx={{ borderRadius: 2, overflow: "hidden", boxShadow: 3 }}>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#0A3161" }}>
                <TableRow>
                  {["Name", "Age", "Party", "Precinct", "Contact"].map((h) => (
                    <TableCell
                      key={h}
                      sx={{ color: "white", fontWeight: "bold" }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((voter: any) => (
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
                        color={voter.party === "R" ? "error" : "primary"}
                      />
                    </TableCell>
                    <TableCell>{voter.precinct}</TableCell>
                    <TableCell>
                      <IconButton
                        color="success"
                        onClick={() => window.open(`tel:${voter.phone_mobile}`)}
                      >
                        <Phone fontSize="small" />
                      </IconButton>
                      <IconButton
                        color="info"
                        onClick={() => window.open(`sms:${voter.phone_mobile}`)}
                      >
                        <Message fontSize="small" />
                      </IconButton>
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
          />
        </Paper>
      )}
    </Box>
  );
}
