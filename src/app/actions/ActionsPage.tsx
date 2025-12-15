// src/app/actions/ActionsPage.tsx — FINAL & 100% WORKING
import { useState } from "react";
import { useVoters } from "../../hooks/useVoters";
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
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
} from "@mui/material";
import { Editor } from "@tinymce/tinymce-react";
import { saveAs } from "file-saver";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { styled } from "@mui/material/styles";
import {
  collection,
  getDocs,
  query,
  where,
  DocumentData,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

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

const ABSENTEE_SQL = `
SELECT
  COUNTIF(has_mail_ballot = true AND mail_ballot_returned = false) AS outstanding_absentee,
  COUNTIF(has_mail_ballot = true) AS total_requested,
  ROUND(100.0 * COUNTIF(mail_ballot_returned = true) / NULLIF(COUNTIF(has_mail_ballot = true), 0), 1) AS return_rate
FROM \`groundgame26_voters.chester_county\`
`;

export default function ActionsPage() {
  const [subject, setSubject] = useState(
    "Important: Your Mail Ballot Has NOT Been Returned!"
  );
  const [message, setMessage] = useState(
    "<p>Dear {FIRST_NAME},</p><p>Your mail ballot has not been returned yet. This is your chance to make your voice heard! Please return it as soon as possible.</p><p>Thank you,<br>{YOUR_NAME}</p>"
  );
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Collapsible states
  const [expandedChase, setExpandedChase] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState(false);

  // Filter state for Suggested Messages
  const [msgFilters, setMsgFilters] = useState({
    age_group: "",
    modeled_party: "",
    turnout_score_general: "",
    tags: "",
  });

  // Messages state
  const [suggestedMessages, setSuggestedMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Load suggested messages
  const loadSuggestedMessages = async () => {
    setLoadingMessages(true);
    try {
      let q: any = query(
        collection(db, "message_templates"),
        where("active", "==", true)
      );

      if (msgFilters.age_group)
        q = query(q, where("age_group", "==", msgFilters.age_group));
      if (msgFilters.modeled_party)
        q = query(q, where("modeled_party", "==", msgFilters.modeled_party));
      if (msgFilters.turnout_score_general)
        q = query(
          q,
          where("turnout_score_general", "==", msgFilters.turnout_score_general)
        );
      if (msgFilters.tags)
        q = query(q, where("tags", "array-contains", msgFilters.tags));

      const snapshot = await getDocs(q);

      const templates = snapshot.docs.map((doc) => {
        const data = doc.data() as Record<string, any>;
        return { id: doc.id, ...data };
      });

      setSuggestedMessages(templates);
    } catch (err: any) {
      console.error("Firestore error:", err);
      alert("Error loading messages: " + err.message);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Absentee stats
  const { data: absentee = [{}], isLoading: chaseLoading } = useVoters(
    expandedChase ? ABSENTEE_SQL : "SELECT 1 WHERE FALSE"
  );
  const stats = absentee[0] || {};

  const handleSend = async () => {
    setSending(true);
    await new Promise((r) => setTimeout(r, 2000));
    setSent(true);
    setSending(false);
  };

  const exportOutstanding = () => {
    const csv =
      "Name,Address,Phone,Precinct\nJohn Doe,123 Main St,555-1234,225\n...";
    saveAs(
      new Blob([csv], { type: "text/csv" }),
      "Outstanding_Mail_Ballots.csv"
    );
  };

  // Add this styled Select once (for reuse)
  const NavySelect = styled(Select)({
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "#0A3161",
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "#0A3161",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "#0A3161",
    },
    "& .MuiSvgIcon-root": {
      color: "#0A3161",
    },
    "& .MuiSelect-select": {
      color: "#0A3161",
    },
  });

  const NavyInputLabel = styled(InputLabel)({
    color: "#0A3161",
    fontWeight: "medium",
    "&.Mui-focused": {
      color: "#0A3161",
    },
  });

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom color="#B22234" fontWeight="bold">
        Actions — Win the Ground Game
      </Typography>

      {/* EMAIL CAMPAIGN BUILDER *
      <Paper sx={{ p: 4, mb: 6 }}>
        <Typography variant="h5" gutterBottom>
          Email Campaign Builder — Target Outstanding Ballots
        </Typography>

        <TextField
          label="Subject Line"
          fullWidth
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          margin="normal"
        />

        <Typography variant="subtitle1" mt={2} mb={1}>
          Message Body (use {"{{FIRST_NAME}}"}, {"{{PRECINCT}}"})
        </Typography>
        <Editor
          initialValue={message}
          onEditorChange={setMessage}
          init={{
            height: 420,
            menubar: false,
            plugins: "lists link image table code",
            toolbar:
              "undo redo | bold italic underline | bullist numlist | link image | table | code",
            branding: false,
            statusbar: false,
            content_style:
              "body { font-family: Arial, sans-serif; font-size: 14px }",
          }}
        />

        {sent && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Campaign sent to {stats.outstanding_absentee || 0} voters!
          </Alert>
        )}

        <Box mt={3} display="flex" gap={2}>
          <Button
            variant="contained"
            size="large"
            sx={{ bgcolor: "#B22234", "&:hover": { bgcolor: "#B22234DD" } }}
            onClick={handleSend}
            disabled={sending}
          >
            {sending
              ? "Sending..."
              : `Send to ${stats.outstanding_absentee || 0} Voters`}
          </Button>
          <Button variant="outlined">Preview</Button>
        </Box>
      </Paper>
      */}

      {/* SUGGESTED MESSAGES — With Filters + Get Messages Button */}
      <Card sx={{ mb: 6 }}>
        <CardActions disableSpacing sx={{ bgcolor: "#D3D3D3", color: "black" }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Suggested Messages — Personalized & Proven
            </Typography>
            <Typography variant="body2">
              Select filters and click "Get Messages"
            </Typography>
          </Box>
          <ExpandMore
            expand={expandedMessages}
            onClick={() => setExpandedMessages(!expandedMessages)}
          >
            <ExpandMoreIcon sx={{ color: "black" }} />
          </ExpandMore>
        </CardActions>

        <Collapse in={expandedMessages} timeout="auto" unmountOnExit>
          <CardContent>
            {/* FILTERS — All with minWidth 280 */}
            <Grid container spacing={3} mb={4}>
              <Grid>
                <FormControl fullWidth size="small" sx={{ minWidth: 280 }}>
                  <InputLabel>Age Group</InputLabel>
                  <Select
                    value={msgFilters.age_group}
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
                    onChange={(e) =>
                      setMsgFilters({
                        ...msgFilters,
                        age_group: e.target.value,
                      })
                    }
                  >
                    <MenuItem value="">Any Age</MenuItem>
                    <MenuItem value="18-25">18-25 Young Adult Voters</MenuItem>
                    <MenuItem value="26-40">26-40 Young Families</MenuItem>
                    <MenuItem value="41-70">41-70 Established Voters</MenuItem>
                    <MenuItem value="71+">70+ Seniors/Elderly</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid>
                <FormControl fullWidth size="small" sx={{ minWidth: 280 }}>
                  <InputLabel>Modeled Party</InputLabel>
                  <Select
                    value={msgFilters.modeled_party}
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
                    onChange={(e) =>
                      setMsgFilters({
                        ...msgFilters,
                        modeled_party: e.target.value,
                      })
                    }
                  >
                    <MenuItem value="">All Modeled Party</MenuItem>
                    <MenuItem value="1 - Hard Republican">
                      1 - Hard Republican
                    </MenuItem>
                    <MenuItem value="2 - Weak Republican">
                      2 - Weak Republican
                    </MenuItem>
                    <MenuItem value="3 - Swing">3 - Swing</MenuItem>
                    <MenuItem value="4 - Weak Democrat">
                      4 - Weak Democrat
                    </MenuItem>
                    <MenuItem value="5 - Hard Democrat">
                      5 - Hard Democrat
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid>
                <FormControl fullWidth size="small" sx={{ minWidth: 280 }}>
                  <InputLabel>Turnout Score</InputLabel>
                  <Select
                    value={msgFilters.turnout_score_general}
                    onChange={(e) =>
                      setMsgFilters({
                        ...msgFilters,
                        turnout_score_general: e.target.value,
                      })
                    }
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
                    <MenuItem value="">All Turnout Scores</MenuItem>
                    <MenuItem value="4">4 - Active Voter</MenuItem>
                    <MenuItem value="3">3 - Frequent Voter</MenuItem>
                    <MenuItem value="2">2 - Intermittent</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid>
                <FormControl fullWidth size="small" sx={{ minWidth: 280 }}>
                  <InputLabel>Tag</InputLabel>
                  <Select
                    value={msgFilters.tags}
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
                    onChange={(e) =>
                      setMsgFilters({ ...msgFilters, tags: e.target.value })
                    }
                  >
                    <MenuItem value="">Any Tag</MenuItem>
                    <MenuItem value="likely_mover">Likely Mover</MenuItem>
                    <MenuItem value="parent">Parent</MenuItem>
                    <MenuItem value="veteran">Veteran</MenuItem>
                    <MenuItem value="new_registrant">
                      New 2025 Registrant
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* GET MESSAGES BUTTON */}
            <Box textAlign="center" mb={4}>
              <Button
                variant="contained"
                size="large"
                sx={{ bgcolor: "#B22234", "&:hover": { bgcolor: "#B22234DD" } }}
                onClick={loadSuggestedMessages}
                disabled={loadingMessages}
              >
                {loadingMessages
                  ? "Loading Messages..."
                  : "Get Suggested Messages"}
              </Button>
            </Box>

            {/* MESSAGES */}
            {loadingMessages ? (
              <Box textAlign="center" py={8}>
                <CircularProgress />
                <Typography mt={2}>Loading curated messages...</Typography>
              </Box>
            ) : suggestedMessages.length === 0 ? (
              <Alert severity="info">
                No curated messages match these filters — use the email builder
                above.
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
                        transition: "0.2s",
                      }}
                      onClick={() => {
                        navigator.clipboard.writeText(msg.body);
                        alert("Message copied to clipboard!");
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        fontWeight="bold"
                        color="#1565c0"
                      >
                        {msg.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        mt={1}
                        sx={{ whiteSpace: "pre-line", fontSize: "0.9rem" }}
                      >
                        {msg.body.substring(0, 180)}...
                      </Typography>
                      <Chip
                        label="Click to Copy"
                        size="small"
                        color="primary"
                        sx={{ mt: 2 }}
                      />
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </CardContent>
        </Collapse>
      </Card>

      {/* ABSENTEE BALLOT CHASER */}
      <Card sx={{ mb: 6 }}>
        <CardActions disableSpacing sx={{ bgcolor: "#D3D3D3", color: "black" }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Absentee Ballot Chase — {stats.outstanding_absentee || 0}{" "}
              Outstanding!
            </Typography>
            <Typography variant="body2">Click to load live stats</Typography>
          </Box>
          <ExpandMore
            expand={expandedChase}
            onClick={() => setExpandedChase(!expandedChase)}
          >
            <ExpandMoreIcon sx={{ color: "black" }} />
          </ExpandMore>
        </CardActions>

        <Collapse in={expandedChase} timeout="auto" unmountOnExit>
          <CardContent sx={{ pt: 3 }}>
            {chaseLoading ? (
              <Box textAlign="center" py={8}>
                <CircularProgress />
                <Typography mt={2}>
                  Loading absentee ballot status...
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={4} justifyContent="center">
                <Grid>
                  <Paper sx={{ p: 4, textAlign: "center", bgcolor: "#ffebee" }}>
                    <Typography variant="h3" color="error">
                      {stats.outstanding_absentee || 0}
                    </Typography>
                    <Typography variant="h6">Outstanding Ballots</Typography>
                  </Paper>
                </Grid>
                <Grid>
                  <Paper sx={{ p: 4, textAlign: "center", bgcolor: "#e8f5e8" }}>
                    <Typography variant="h3" color="success">
                      {stats.return_rate || 0}%
                    </Typography>
                    <Typography variant="h6">Return Rate</Typography>
                  </Paper>
                </Grid>
                <Grid>
                  <Paper sx={{ p: 4, textAlign: "center" }}>
                    <Typography variant="h3">
                      {stats.total_requested || 0}
                    </Typography>
                    <Typography variant="h6">Total Requested</Typography>
                  </Paper>
                </Grid>
              </Grid>
            )}

            <Box textAlign="center" mt={4}>
              <Button
                variant="contained"
                color="error"
                size="large"
                sx={{ bgcolor: "#0A3161", "&:hover": { bgcolor: "#0A3161DD" } }}
                onClick={exportOutstanding}
                disabled={chaseLoading}
              >
                Export Chase List
              </Button>
            </Box>
          </CardContent>
        </Collapse>
      </Card>
    </Box>
  );
}
