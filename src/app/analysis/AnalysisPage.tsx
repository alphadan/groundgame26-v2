// src/app/analysis/AnalysisPage.tsx — FINAL & ELITE: Full Pagination + Perfect Selects
import { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Collapse,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  TablePagination,
} from "@mui/material";
import { useVoters } from "../../hooks/useVoters";
import { saveAs } from "file-saver";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";

const FILTERS = {
  modeled_party: [
    { value: "", label: "All Modeled Party" },
    { value: "1 - Hard Republican", label: "1 - Hard Republican" },
    { value: "2 - Weak Republican", label: "2 - Weak Republican" },
    { value: "3 - Swing", label: "3 - Swing" },
    { value: "4 - Weak Democrat", label: "4 - Weak Democrat" },
    { value: "5 - Hard Democrat", label: "5 - Hard Democrat" },
  ],
  age_group: [
    { value: "", label: "All Ages" },
    { value: "18-25", label: "18-25 Young Adult Voters" },
    { value: "26-40", label: "26-40 Young Families" },
    { value: "41-70", label: "41-70 Established Voters" },
    { value: "71+", label: "70+ Seniors/Elderly" },
  ],
  has_mail_ballot: [
    { value: "", label: "All Mail Ballot Status" },
    { value: "true", label: "Has Mail Ballot" },
    { value: "false", label: "No Mail Ballot" },
  ],
  turnout_score_general: [
    { value: "", label: "All Turnout Scores" },
    { value: "0", label: "0 - Non-Voter" },
    { value: "1", label: "1 - Inactive Voter" },
    { value: "2", label: "2 - Intermittent" },
    { value: "3", label: "3 - Frequent Voter" },
    { value: "4", label: "4 - Active Voter" },
  ],
  voted_2024_general: [
    { value: "", label: "All 2024 General Voters" },
    { value: "true", label: "Voted 2024 General" },
    { value: "false", label: "Did NOT Vote 2024 General" },
  ],
  precinct: [
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
  ],
};

export default function AnalysisPage() {
  const [filters, setFilters] = useState({
    precinct: "",
    modeled_party: "",
    age_group: "",
    has_mail_ballot: "",
    turnout_score_general: "",
    voted_2024_general: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [expandedMessages, setExpandedMessages] = useState(false);
  const [suggestedMessages, setSuggestedMessages] = useState<any[]>([]);

  const FILTERED_LIST_SQL = submitted
    ? `
    SELECT
      full_name,
      age,
      age_group,
      party,
      modeled_party,
      precinct,
      phone_mobile,
      phone_home,
      address,
      has_mail_ballot,
      turnout_score_general,
      voted_2024_general
    FROM \`groundgame26_voters.chester_county\`
    WHERE 1=1
      ${filters.precinct ? `AND precinct = '${filters.precinct}'` : ""}
      ${
        filters.modeled_party
          ? `AND modeled_party = '${filters.modeled_party}'`
          : ""
      }
      ${filters.age_group ? `AND age_group = '${filters.age_group}'` : ""}
      ${
        filters.has_mail_ballot !== ""
          ? `AND has_mail_ballot = ${filters.has_mail_ballot === "true"}`
          : ""
      }
      ${
        filters.turnout_score_general !== ""
          ? `AND turnout_score_general = ${filters.turnout_score_general}`
          : ""
      }
      ${
        filters.voted_2024_general !== ""
          ? `AND voted_2024_general = ${filters.voted_2024_general === "true"}`
          : ""
      }
    ORDER BY full_name
    LIMIT 1000
  `
    : "";

  const { data = [], isLoading, error } = useVoters(FILTERED_LIST_SQL);

  const handleSubmit = () => {
    setSubmitted(true);
    setPage(0);
  };

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const exportList = () => {
    if (!data.length) {
      alert("No voters match your filters");
      return;
    }

    const csv = [
      [
        "Name",
        "Age",
        "Age Group",
        "Party",
        "Modeled Party",
        "Precinct",
        "Phone",
        "Address",
        "Mail Ballot",
        "Turnout Score",
        "Voted 2024",
      ],
      ...data.map((v: any) => [
        v.full_name || "",
        v.age || "",
        v.age_group || "",
        v.party || "",
        v.modeled_party || "",
        v.precinct || "",
        v.phone_mobile || v.phone_home || "",
        v.address || "",
        v.has_mail_ballot ? "Yes" : "No",
        v.turnout_score_general || "",
        v.voted_2024_general ? "Yes" : "No",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    saveAs(
      new Blob([csv], { type: "text/csv" }),
      `Targeted_Voters_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const paginatedData = data.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const loadSuggestedMessages = async () => {
    const q = query(
      collection(db, "message_templates"),
      where("active", "==", true)
    );
    const snapshot = await getDocs(q);
    const templates = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Simple matching logic
    const matches = templates.filter((t: any) => {
      if (!t.filters) return true; // fallback

      const f = filters;
      if (
        t.filters.modeled_party &&
        !t.filters.modeled_party.includes(f.modeled_party)
      )
        return false;
      if (t.filters.age_group && !t.filters.age_group.includes(f.age_group))
        return false;
      if (
        t.filters.voted_2024_general !== undefined &&
        t.filters.voted_2024_general !== (f.voted_2024_general === "false")
      )
        return false;

      return true;
    });

    setSuggestedMessages(matches);
  };

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Analysis — Voter Targeting Engine
      </Typography>

      <Paper sx={{ p: 4, mb: 6 }}>
        <Typography variant="h6" gutterBottom color="#1E1E1E">
          Target Your Voters
        </Typography>

        <Grid container spacing={3}>
          {Object.entries(FILTERS).map(([key, options]) => (
            <Grid key={key}>
              <FormControl fullWidth size="small" sx={{ minWidth: 280, mb: 2 }}>
                <InputLabel
                  sx={{
                    color: "#0A3161",
                    fontWeight: "medium",
                    "&.Mui-focused": { color: "#0A3161" },
                  }}
                >
                  {key
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                </InputLabel>
                <Select
                  value={filters[key as keyof typeof filters]}
                  onChange={(e) =>
                    setFilters({ ...filters, [key]: e.target.value })
                  }
                  label={key
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
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
                  {options.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          ))}
        </Grid>

        <Box mt={4}>
          <Button
            variant="contained"
            size="large"
            sx={{
              bgcolor: "#B22234",
              "&:hover": { bgcolor: "#B22234DD" },
              px: 6,
            }}
            onClick={handleSubmit}
          >
            Run Analysis
          </Button>
        </Box>
      </Paper>

      {submitted && isLoading && (
        <Alert severity="info">Loading your targeted voters...</Alert>
      )}
      {error && (
        <Alert severity="error">Error: {(error as Error).message}</Alert>
      )}
      {submitted && !isLoading && !error && data.length === 0 && (
        <Alert severity="warning">
          No voters match your filters — try broadening them
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
              {data.length.toLocaleString()} voters found
            </Typography>
            <Button
              variant="contained"
              sx={{ bgcolor: "#0A3161", "&:hover": { bgcolor: "#0A3161DD" } }}
              onClick={exportList}
            >
              Download Full List
            </Button>
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
                    Phone
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Precinct
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Mail Ballot
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Turnout
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    2024 Vote
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((voter: any, i: number) => (
                  <TableRow key={i} hover>
                    <TableCell>{voter.full_name || "—"}</TableCell>
                    <TableCell>{voter.age || "—"}</TableCell>
                    <TableCell>{voter.party || "—"}</TableCell>
                    <TableCell>
                      {voter.phone_mobile || voter.phone_home || "—"}
                    </TableCell>
                    <TableCell>{voter.precinct || "—"}</TableCell>
                    <TableCell>
                      {voter.has_mail_ballot ? "Yes" : "No"}
                    </TableCell>
                    <TableCell>{voter.turnout_score_general || "—"}</TableCell>
                    <TableCell>
                      {voter.voted_2024_general ? "Yes" : "No"}
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
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="Rows per page:"
            sx={{
              "& .MuiTablePagination-toolbar": { color: "#0A3161" },
              "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
                { color: "#0A3161" },
            }}
          />
        </Paper>
      )}
    </Box>
  );
}
