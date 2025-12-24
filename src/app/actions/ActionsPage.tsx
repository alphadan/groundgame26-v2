// src/app/actions/ActionsPage.tsx
import { useState, useCallback } from "react";
import { useVoters } from "../../hooks/useVoters";
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Card,
  CardContent,
  CardActions,
  Collapse,
  IconButton,
  Grid,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
} from "@mui/material";
import { saveAs } from "file-saver";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { styled } from "@mui/material/styles";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";

// === Safe Number Coercion (prevents NaN or undefined crashes) ===
const safeNumber = (value: any): number => {
  const num = Number(value);
  return isNaN(num) || num === null || num === undefined ? 0 : num;
};

const ExpandMore = styled((props: { expand: boolean; [key: string]: any }) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? "rotate(0deg)" : "rotate(180deg)",
  marginLeft: "auto",
  transition: theme.transitions.create("transform", {
    duration: theme.transitions.duration.shortest,
  }),
}));

// Safe, configurable absentee query
const ABSENTEE_SQL = `
  SELECT
    COUNTIF(has_mail_ballot = true AND mail_ballot_returned = false) AS outstanding_absentee,
    COUNTIF(has_mail_ballot = true) AS total_requested,
    ROUND(100.0 * COUNTIF(mail_ballot_returned = true) / NULLIF(COUNTIF(has_mail_ballot = true), 0), 1) AS return_rate
  FROM \`groundgame26_voters.chester_county\`
  WHERE active = TRUE
`;

export default function ActionsPage() {
  const { user, isLoaded } = useAuth();

  // UI States
  const [expandedChase, setExpandedChase] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState(false);

  // Filters
  const [msgFilters, setMsgFilters] = useState({
    age_group: "",
    modeled_party: "",
    turnout_score_general: "",
    tags: "",
  });

  // Messages
  const [suggestedMessages, setSuggestedMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState("");

  // Feedback
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // Absentee stats
  const { data: absentee = [{}], isLoading: chaseLoading } = useVoters(
    expandedChase ? ABSENTEE_SQL : "SELECT 1 WHERE 1=0"
  );
  const stats = absentee[0] ?? {};

  // === Safe Clipboard Copy ===
  const copyToClipboard = useCallback(async (text: string) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setSnackbarMessage("Message copied to clipboard!");
      setSnackbarOpen(true);
    } catch (err) {
      console.warn("Clipboard access failed:", err);
      setSnackbarMessage("Copy failed — please select and copy manually");
      setSnackbarOpen(true);
    }
  }, []);

  // === Load Suggested Messages (Fully Defensive) ===
  const loadSuggestedMessages = useCallback(async () => {
    if (!user) {
      setMessageError("You must be logged in to load messages.");
      return;
    }

    if (!db) {
      setMessageError("Database not available. Please refresh.");
      return;
    }

    setLoadingMessages(true);
    setMessageError("");

    try {
      let q = query(
        collection(db, "message_templates"),
        where("active", "==", true)
      );

      if (msgFilters.age_group) {
        q = query(q, where("age_group", "==", msgFilters.age_group));
      }
      if (msgFilters.modeled_party) {
        q = query(q, where("modeled_party", "==", msgFilters.modeled_party));
      }
      if (msgFilters.turnout_score_general) {
        q = query(q, where("turnout_score_general", "==", msgFilters.turnout_score_general));
      }
      if (msgFilters.tags) {
        q = query(q, where("tags", "array-contains", msgFilters.tags));
      }

      const snapshot = await getDocs(q);

      const templates = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setSuggestedMessages(templates);

      if (templates.length === 0) {
        setMessageError("No messages match your filters.");
      }
    } catch (err: any) {
      console.error("Failed to load messages:", err);
      setMessageError(err.message || "Failed to load messages. Please try again.");
    } finally {
      setLoadingMessages(false);
    }
  }, [user, db, msgFilters]);

  // === Export (Safe CSV) ===
  const exportOutstanding = useCallback(() => {
    const csvContent = [
      ["Name", "Address", "Phone", "Precinct"],
      ["Sample Voter", "123 Main St", "555-0123", "001"],
      // Placeholder — real data would come from a secure endpoint
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `Outstanding_Mail_Ballots_${new Date().toISOString().slice(0, 10)}.csv`);
  }, []);

  if (!isLoaded) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="70vh">
        <CircularProgress sx={{ color: "#B22234" }} />
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Actions — Win the Ground Game
      </Typography>

      {/* Suggested Messages Card */}
      <Card sx={{ mb: 6 }}>
        <CardActions
          disableSpacing
          sx={{ bgcolor: "#D3D3D3", color: "black" }}
          onClick={() => setExpandedMessages(!expandedMessages)}
        >
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Suggested Messages — Personalized & Proven
            </Typography>
            <Typography variant="body2">
              Filter and load curated messages
            </Typography>
          </Box>
          <ExpandMore expand={expandedMessages}>
            <ExpandMoreIcon sx={{ color: "black" }} />
          </ExpandMore>
        </CardActions>

        <Collapse in={expandedMessages} timeout="auto" unmountOnExit>
          <CardContent>
            <Grid container spacing={3} mb={4}>
              <Grid>
                <FormControl fullWidth size="small">
                  <InputLabel>Age Group</InputLabel>
                  <Select
                    value={msgFilters.age_group}
                    label="Age Group"
                    onChange={(e) =>
                      setMsgFilters({ ...msgFilters, age_group: e.target.value })
                    }
                  >
                    <MenuItem value="">Any Age</MenuItem>
                    <MenuItem value="18-25">18-25 Young Adult</MenuItem>
                    <MenuItem value="26-40">26-40 Young Families</MenuItem>
                    <MenuItem value="41-70">41-70 Established</MenuItem>
                    <MenuItem value="71+">70+ Seniors</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid>
                <FormControl fullWidth size="small">
                  <InputLabel>Modeled Party</InputLabel>
                  <Select
                    value={msgFilters.modeled_party}
                    label="Modeled Party"
                    onChange={(e) =>
                      setMsgFilters({ ...msgFilters, modeled_party: e.target.value })
                    }
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="1 - Hard Republican">Hard Republican</MenuItem>
                    <MenuItem value="2 - Weak Republican">Weak Republican</MenuItem>
                    <MenuItem value="3 - Swing">Swing</MenuItem>
                    <MenuItem value="4 - Weak Democrat">Weak Democrat</MenuItem>
                    <MenuItem value="5 - Hard Democrat">Hard Democrat</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid>
                <FormControl fullWidth size="small">
                  <InputLabel>Turnout Score</InputLabel>
                  <Select
                    value={msgFilters.turnout_score_general}
                    label="Turnout Score"
                    onChange={(e) =>
                      setMsgFilters({
                        ...msgFilters,
                        turnout_score_general: e.target.value,
                      })
                    }
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="4">4 - Active</MenuItem>
                    <MenuItem value="3">3 - Frequent</MenuItem>
                    <MenuItem value="2">2 - Intermittent</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid>
                <FormControl fullWidth size="small">
                  <InputLabel>Tag</InputLabel>
                  <Select
                    value={msgFilters.tags}
                    label="Tag"
                    onChange={(e) =>
                      setMsgFilters({ ...msgFilters, tags: e.target.value })
                    }
                  >
                    <MenuItem value="">Any</MenuItem>
                    <MenuItem value="likely_mover">Likely Mover</MenuItem>
                    <MenuItem value="parent">Parent</MenuItem>
                    <MenuItem value="veteran">Veteran</MenuItem>
                    <MenuItem value="new_registrant">New Registrant</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box textAlign="center" mb={4}>
              <Button
                variant="contained"
                size="large"
                onClick={loadSuggestedMessages}
                disabled={loadingMessages}
                sx={{ bgcolor: "#B22234", "&:hover": { bgcolor: "#8B1A1A" } }}
              >
                {loadingMessages ? "Loading..." : "Get Suggested Messages"}
              </Button>
            </Box>

            {messageError && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                {messageError}
              </Alert>
            )}

            {loadingMessages ? (
              <Box textAlign="center" py={8}>
                <CircularProgress />
              </Box>
            ) : suggestedMessages.length === 0 ? (
              <Alert severity="info">
                No messages match your filters. Try adjusting them.
              </Alert>
            ) : (
              <Grid container spacing={3}>
                {suggestedMessages.map((msg) => (
                  <Grid key={msg.id}>
                    <Paper
                      sx={{
                        p: 3,
                        bgcolor: "#e3f2fd",
                        cursor: "pointer",
                        "&:hover": { bgcolor: "#bbdefb" },
                        borderLeft: "4px solid #1565c0",
                      }}
                      onClick={() => copyToClipboard(msg.body || "")}
                    >
                      <Typography variant="subtitle1" fontWeight="bold" color="#1565c0">
                        {msg.title || "Untitled"}
                      </Typography>
                      <Typography variant="body2" mt={1} sx={{ fontSize: "0.9rem" }}>
                        {msg.body?.substring(0, 160)}...
                      </Typography>
                      <Chip label="Click to Copy" size="small" color="primary" sx={{ mt: 2 }} />
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </CardContent>
        </Collapse>
      </Card>

      {/* Absentee Chase Card */}
      <Card>
        <CardActions
          disableSpacing
          sx={{ bgcolor: "#D3D3D3", color: "black" }}
          onClick={() => setExpandedChase(!expandedChase)}
        >
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Absentee Ballot Chase — {safeNumber(stats.outstanding_absentee)} Outstanding
            </Typography>
            <Typography variant="body2">Click to view live stats</Typography>
          </Box>
          <ExpandMore expand={expandedChase}>
            <ExpandMoreIcon sx={{ color: "black" }} />
          </ExpandMore>
        </CardActions>

        <Collapse in={expandedChase} timeout="auto" unmountOnExit>
          <CardContent>
            {chaseLoading ? (
              <Box textAlign="center" py={8}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <Grid container spacing={4} justifyContent="center" mb={4}>
                  <Grid>
                    <Paper sx={{ p: 4, textAlign: "center", bgcolor: "#ffebee" }}>
                      <Typography variant="h3" color="error">
                        {safeNumber(stats.outstanding_absentee)}
                      </Typography>
                      <Typography variant="h6">Outstanding</Typography>
                    </Paper>
                  </Grid>
                  <Grid>
                    <Paper sx={{ p: 4, textAlign: "center", bgcolor: "#e8f5e8" }}>
                      <Typography variant="h3" color="success">
                        {safeNumber(stats.return_rate)}%
                      </Typography>
                      <Typography variant="h6">Return Rate</Typography>
                    </Paper>
                  </Grid>
                  <Grid>
                    <Paper sx={{ p: 4, textAlign: "center" }}>
                      <Typography variant="h3">
                        {safeNumber(stats.total_requested)}
                      </Typography>
                      <Typography variant="h6">Requested</Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <Box textAlign="center">
                  <Button
                    variant="contained"
                    size="large"
                    onClick={exportOutstanding}
                    sx={{ bgcolor: "#B22234", "&:hover": { bgcolor: "#8B1A1A" } }}
                  >
                    Export Chase List (CSV)
                  </Button>
                </Box>
              </>
            )}
          </CardContent>
        </Collapse>
      </Card>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="success" variant="filled">
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}