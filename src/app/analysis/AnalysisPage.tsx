// src/app/analysis/AnalysisPage.tsx
import React, { useState, useCallback, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../lib/db";
import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query"; // ← FIXED: Missing import
import { saveAs } from "file-saver"; // ← FIXED: Proper import (no UMD error)
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
  LinearProgress, // ← FIXED: Missing import
  Snackbar,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { styled } from "@mui/material/styles";

// === Styled ExpandMore (with proper typing) ===
const ExpandMore = styled(
  (props: {
    expand: boolean;
    onClick?: React.MouseEventHandler<HTMLElement>;
    children?: React.ReactNode;
  }) => {
    const { expand, onClick, children, ...other } = props;
    return (
      <IconButton onClick={onClick} {...other}>
        {children}
      </IconButton>
    );
  }
)(({ theme, expand }) => ({
  transform: !expand ? "rotate(0deg)" : "rotate(180deg)",
  marginLeft: "auto",
  transition: theme.transitions.create("transform", {
    duration: theme.transitions.duration.shortest,
  }),
}));

// === Filter Options Hook (Dynamic Precincts) ===
const useFilterOptions = () => {
  const precincts =
    useLiveQuery(() =>
      indexedDb.precincts.where("active").equals(1).toArray()
    ) ?? [];

  return useMemo(
    () => ({
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
        { value: "", label: "All 2024 Voters" },
        { value: "true", label: "Voted 2024" },
        { value: "false", label: "Did NOT Vote 2024" },
      ],
      precinct: [
        { value: "", label: "All Precincts" },
        ...precincts.map((p) => ({
          value: p.precinct_code,
          label: `${p.precinct_code} - ${p.name}`,
        })),
      ],
    }),
    [precincts]
  );
};

export default function AnalysisPage() {
  const { isLoaded } = useAuth();

  const filterOptions = useFilterOptions();

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

  // Messages
  const [suggestedMessages, setSuggestedMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // === Parameterized Query via Cloud Function (safe) ===
  const {
    data: voters = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["analysis", filters, submitted],
    queryFn: async (): Promise<any[]> => {
      if (!submitted) return [];

      // Replace with your actual Cloud Function
      // Example: await callFunction("analyzeVoters", { filters });
      return []; // Placeholder
    },
    enabled: submitted,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const loadSuggestedMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      // Replace with your actual Cloud Function call
      setSuggestedMessages([]);
    } catch (err: any) {
      setSnackbarMessage("Failed to load messages");
      setSnackbarOpen(true);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const exportList = useCallback(() => {
    if (voters.length === 0) return;

    const headers = [
      "Name",
      "Age",
      "Party",
      "Precinct",
      "Phone",
      "Address",
      "Mail Ballot",
      "Turnout Score",
      "Voted 2024",
    ];

    const rows = voters.map((v: any) => [
      v.full_name || "",
      v.age ?? "",
      v.party || "",
      v.precinct || "",
      v.phone_mobile || v.phone_home || "",
      v.address || "",
      v.has_mail_ballot ? "Yes" : "No",
      v.turnout_score_general ?? "",
      v.voted_2024_general ? "Yes" : "No",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `Voter_Analysis_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [voters]);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    setPage(0);
  }, []);

  const paginatedData = useMemo(
    () => voters.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [voters, page, rowsPerPage]
  );

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
        Analysis — Voter Targeting Engine
      </Typography>

      <Paper sx={{ p: 4, mb: 4, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom color="#1E1E1E">
          Filter Your Target Universe
        </Typography>
        <Grid container spacing={3}>
          {Object.entries(filterOptions).map(([key, options]) => (
            <Grid key={key}>
              <FormControl fullWidth size="small">
                <InputLabel>{key.replace(/_/g, " ").toUpperCase()}</InputLabel>
                <Select
                  value={filters[key as keyof typeof filters]}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  label={key.replace(/_/g, " ")}
                >
                  {options.map((opt: any) => (
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
            onClick={handleSubmit}
            sx={{ bgcolor: "#B22234" }}
          >
            Run Analysis
          </Button>
        </Box>
      </Paper>

      {/* Messages Card */}
      <Card sx={{ mb: 4 }}>
        <CardActions sx={{ bgcolor: "#e9ecef" }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Curated Messaging Templates
          </Typography>
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
              <Box textAlign="center" py={4}>
                <CircularProgress />
              </Box>
            ) : suggestedMessages.length === 0 ? (
              <Alert severity="info">No templates match current filters.</Alert>
            ) : (
              <Grid container spacing={2}>
                {suggestedMessages.map((msg: any) => (
                  <Grid key={msg.id}>
                    <Paper
                      sx={{
                        p: 2,
                        borderLeft: "4px solid #B22234",
                        cursor: "pointer",
                        "&:hover": { bgcolor: "#f9f9f9" },
                      }}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(msg.body || "");
                          setSnackbarMessage("Message copied!");
                          setSnackbarOpen(true);
                        } catch {
                          setSnackbarMessage("Copy failed");
                          setSnackbarOpen(true);
                        }
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight="bold">
                        {msg.title}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {msg.body?.substring(0, 120)}...
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </CardContent>
        </Collapse>
      </Card>

      {/* Results */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Analysis failed. Please try again.
        </Alert>
      )}

      {submitted && !isLoading && voters.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No voters match your filters.
        </Alert>
      )}

      {submitted && voters.length > 0 && (
        <Paper sx={{ borderRadius: 2 }}>
          <Box
            p={3}
            display="flex"
            justifyContent="space-between"
            bgcolor="#f8f9fa"
          >
            <Typography variant="h6">
              {voters.length.toLocaleString()} Targeted Voters
            </Typography>
            <Button
              variant="contained"
              onClick={exportList}
              sx={{ bgcolor: "#B22234" }}
            >
              Export CSV
            </Button>
          </Box>

          {isLoading && <LinearProgress />}

          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#0A3161" }}>
                <TableRow>
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
                    Precinct
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Mail Ballot
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                    Turnout
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((voter: any) => (
                  <TableRow key={voter.voter_id}>
                    <TableCell>{voter.full_name || "Unknown"}</TableCell>
                    <TableCell>{voter.age ?? "?"}</TableCell>
                    <TableCell>{voter.party || "N/A"}</TableCell>
                    <TableCell>{voter.precinct || "-"}</TableCell>
                    <TableCell>
                      {voter.has_mail_ballot ? "Yes" : "No"}
                    </TableCell>
                    <TableCell>{voter.turnout_score_general ?? "?"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={voters.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </Paper>
      )}

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
