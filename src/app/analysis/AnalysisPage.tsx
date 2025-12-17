// src/app/analysis/AnalysisPage.tsx
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
  IconButton,
  LinearProgress,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { styled } from "@mui/material/styles";
import { useVoters } from "../../hooks/useVoters";
import { useAuth } from "../../context/AuthContext"; // Integrated Auth
import { saveAs } from "file-saver";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";

// Styled Components for consistent professional branding
const ExpandMore = styled((props: any) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? "rotate(0deg)" : "rotate(180deg)",
  marginLeft: "auto",
  transition: theme.transitions.create("transform", {
    duration: theme.transitions.duration.shortest,
  }),
}));

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
    { value: "18-25", label: "18-25 Young Adult" },
    { value: "26-40", label: "26-40 Young Families" },
    { value: "41-70", label: "41-70 Established" },
    { value: "71+", label: "70+ Seniors" },
  ],
  has_mail_ballot: [
    { value: "", label: "All Mail Ballot Status" },
    { value: "true", label: "Has Mail Ballot" },
    { value: "false", label: "No Mail Ballot" },
  ],
  turnout_score_general: [
    { value: "", label: "All Turnout Scores" },
    { value: "0", label: "0 - Non-Voter" },
    { value: "1", label: "1 - Inactive" },
    { value: "2", label: "2 - Intermittent" },
    { value: "3", label: "3 - Frequent" },
    { value: "4", label: "4 - Active" },
  ],
  voted_2024_general: [
    { value: "", label: "All 2024 General Voters" },
    { value: "true", label: "Voted 2024 General" },
    { value: "false", label: "Did NOT Vote 2024" },
  ],
  precinct: [
    { value: "", label: "All Precincts" },
    { value: "5", label: "5 - Atglen" },
    { value: "225", label: "225 - East Fallowfield-E" },
    { value: "230", label: "230 - East Fallowfield-W" },
    { value: "290", label: "290 - Highland" },
    { value: "440", label: "440 - Parkesburg North" },
    { value: "445", label: "445 - Parkesburg South" },
    { value: "535", label: "535 - Sadsbury-North" },
    { value: "540", label: "540 - Sadsbury-South" },
    { value: "545", label: "545 - West Sadsbury" },
    { value: "235", label: "235 - West Fallowfield" },
  ],
};

export default function AnalysisPage() {
  const { user, isLoaded } = useAuth(); // Monitor identity state
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
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Dynamic SQL Generation
  const FILTERED_LIST_SQL = submitted
    ? `
    SELECT full_name, age, age_group, party, modeled_party, precinct, phone_mobile, phone_home, address, has_mail_ballot, turnout_score_general, voted_2024_general
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
    ORDER BY full_name LIMIT 1000`
    : "";

  const { data = [], isLoading, error } = useVoters(FILTERED_LIST_SQL);

  const handleSubmit = () => {
    setSubmitted(true);
    setPage(0);
  };

  const loadSuggestedMessages = async () => {
    console.log("🚀 Firestore: Starting curated template fetch...");
    setLoadingMessages(true);
    try {
      // Identity Check to prevent SDK connection hang
      if (!auth.currentUser) throw new Error("Authentication required.");

      const q = query(
        collection(db, "message_templates"),
        where("active", "==", true)
      );

      const snapshot = await getDocs(q);
      console.log(`✅ Firestore: Retrieved ${snapshot.size} messages.`);

      const templates = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // In-memory matching logic for personalized suggestions
      const matches = templates.filter((t: any) => {
        if (!t.filters) return true;
        const f = filters;
        if (
          t.filters.modeled_party &&
          !t.filters.modeled_party.includes(f.modeled_party)
        )
          return false;
        if (t.filters.age_group && !t.filters.age_group.includes(f.age_group))
          return false;
        return true;
      });

      setSuggestedMessages(matches);
    } catch (err: any) {
      console.error("❌ Firestore Load Error:", err);
      alert("Error loading curated messages: " + err.message);
    } finally {
      setLoadingMessages(false);
    }
  };

  const exportList = () => {
    if (!data.length) return;
    const csvHeader =
      "Name,Age,Age Group,Party,Modeled Party,Precinct,Phone,Address,Mail Ballot,Turnout,Voted 2024\n";
    const csvRows = data
      .map((v: any) =>
        [
          v.full_name,
          v.age,
          v.age_group,
          v.party,
          v.modeled_party,
          v.precinct,
          v.phone_mobile || v.phone_home,
          v.address,
          v.has_mail_ballot,
          v.turnout_score_general,
          v.voted_2024_general,
        ].join(",")
      )
      .join("\n");

    saveAs(
      new Blob([csvHeader + csvRows], { type: "text/csv" }),
      `Voter_Targeting_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const paginatedData = data.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Analysis — Voter Targeting Engine
      </Typography>

      <Paper sx={{ p: 4, mb: 4, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom color="#1E1E1E">
          Filter Your Target Universe
        </Typography>
        <Grid container spacing={3}>
          {Object.entries(FILTERS).map(([key, options]) => (
            <Grid key={key}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: "#0A3161" }}>
                  {key.replace(/_/g, " ").toUpperCase()}
                </InputLabel>
                <Select
                  value={filters[key as keyof typeof filters]}
                  onChange={(e) =>
                    setFilters({ ...filters, [key]: e.target.value })
                  }
                  label={key.replace(/_/g, " ")}
                  sx={{
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "#0A3161",
                    },
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
            sx={{ bgcolor: "#B22234", px: 6, fontWeight: "bold" }}
            onClick={handleSubmit}
          >
            Run Analysis
          </Button>
        </Box>
      </Paper>

      {/* Suggested Messages Component */}
      <Card sx={{ mb: 4, bgcolor: "#f8f9fa" }}>
        <CardActions sx={{ bgcolor: "#e9ecef" }}>
          <Box ml={1}>
            <Typography variant="subtitle1" fontWeight="bold">
              Curated Messaging Templates
            </Typography>
          </Box>
          <ExpandMore
            expand={expandedMessages}
            onClick={() => {
              setExpandedMessages(!expandedMessages);
              if (!expandedMessages) loadSuggestedMessages();
            }}
          >
            <ExpandMoreIcon />
          </ExpandMore>
        </CardActions>
        <Collapse in={expandedMessages} timeout="auto" unmountOnExit>
          <CardContent>
            {loadingMessages ? (
              <Box textAlign="center">
                <CircularProgress size={30} />
              </Box>
            ) : suggestedMessages.length === 0 ? (
              <Alert severity="info">
                No templates found for this criteria.
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {suggestedMessages.map((msg) => (
                  <Grid key={msg.id}>
                    <Paper
                      sx={{
                        p: 2,
                        borderLeft: "5px solid #0A3161",
                        cursor: "pointer",
                        "&:hover": { bgcolor: "#f1f3f5" },
                      }}
                      onClick={() => {
                        navigator.clipboard.writeText(msg.body);
                        alert("Copied!");
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        fontWeight="bold"
                        color="#0A3161"
                      >
                        {msg.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ mt: 1, color: "#495057" }}
                      >
                        {msg.body.substring(0, 100)}...
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </CardContent>
        </Collapse>
      </Card>

      {/* Results Table */}
      {submitted && (
        <Paper sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Box
            p={3}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            bgcolor="#f8f9fa"
          >
            <Typography variant="h6">
              {data.length.toLocaleString()} Voters Targeted
            </Typography>
            <Button
              variant="contained"
              sx={{ bgcolor: "#0A3161" }}
              onClick={exportList}
            >
              Export CSV
            </Button>
          </Box>
          {isLoading ? (
            <LinearProgress />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: "#0A3161" }}>
                  <TableRow>
                    {[
                      "Name",
                      "Age",
                      "Party",
                      "Precinct",
                      "Mail Ballot",
                      "Turnout",
                    ].map((h) => (
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
                  {paginatedData.map((voter: any, i: number) => (
                    <TableRow key={i} hover>
                      <TableCell>{voter.full_name}</TableCell>
                      <TableCell>{voter.age}</TableCell>
                      <TableCell>{voter.party}</TableCell>
                      <TableCell>{voter.precinct}</TableCell>
                      <TableCell>
                        {voter.has_mail_ballot ? "Yes" : "No"}
                      </TableCell>
                      <TableCell>{voter.turnout_score_general}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
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
