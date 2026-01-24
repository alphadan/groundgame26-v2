import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "../../../lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  getDocs,
} from "firebase/firestore";

// UI Components
import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Button,
  Chip,
  Grid,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Stack,
  ListSubheader,
  OutlinedInput,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  History as HistoryIcon,
  Send as SendIcon,
  Description as TemplateIcon,
  Save as SaveIcon,
} from "@mui/icons-material";

// --- CONFIGURATION & TYPES ---

const ROLE_AUDIENCES = [
  { value: "all_users", label: "All Users" },
  { value: "state_rep_admins", label: "State Rep Admins" },
  { value: "area_chairs", label: "Area Chairs" },
  { value: "committeepersons", label: "Committeepersons" },
  { value: "candidates", label: "Candidates" },
  { value: "volunteers", label: "Volunteers" },
];

const TOPIC_AUDIENCES = [
  { value: "pref_urgent_gotv", label: "Urgent GOTV Alerts" },
  { value: "pref_social_events", label: "Social Events" },
  { value: "pref_training_tips", label: "Daily Training Tips" },
];

const ALL_OPTIONS = [...ROLE_AUDIENCES, ...TOPIC_AUDIENCES];

// --- MAIN COMPONENT ---

export default function NotificationsManagement() {
  const { user, claims, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  // View State
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<string[]>([]);

  // Data State
  const [history, setHistory] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  const senderRole = claims?.role as string | undefined;

  // --- DATA FETCHING ---

  useEffect(() => {
    if (!user) return;

    // Listen to History (Last 50)
    const historyQuery = query(
      collection(db, "notifications_history"),
      orderBy("sent_at", "desc"),
      limit(50),
    );
    const unsubHistory = onSnapshot(historyQuery, (snap) => {
      setHistory(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to Templates
    const templateQuery = query(
      collection(db, "notification_templates"),
      orderBy("created_at", "desc"),
    );
    const unsubTemplates = onSnapshot(templateQuery, (snap) => {
      setTemplates(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubHistory();
      unsubTemplates();
    };
  }, [user]);

  // --- HANDLERS ---

  const handleSend = async () => {
    if (!title || !body || audience.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Create the document that triggers the v2 Cloud Function
      const payload = {
        title: title.trim(),
        body: body.trim(),
        audience: audience, // This array of topics/roles
        sent_at: Date.now(), // Your preferred Unix format
        sender_uid: user?.uid,
        sender_name: user?.displayName || "Admin",
        status: "queued", // The function will change this to 'delivered'
      };

      // This write is the "trigger"
      await addDoc(collection(db, "notifications_history"), payload);

      setSuccess(
        "Notification queued! Check the History tab for status updates.",
      );

      // 2. Reset the form
      setTitle("");
      setBody("");
      setAudience([]);
    } catch (err: any) {
      console.error("Error queueing notification:", err);
      setError("Failed to queue notification.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    const templateName = prompt("Enter a name for this template:");
    if (!templateName) return;

    try {
      await addDoc(collection(db, "notification_templates"), {
        template_name: templateName,
        title,
        body,
        created_at: Date.now(),
        created_by: user?.uid,
      });
      setSuccess("Template saved successfully.");
    } catch (err) {
      setError("Failed to save template.");
    }
  };

  const handleReSend = (row: any) => {
    setTitle(row.title || "");
    setBody(row.body || "");
    setAudience(row.audience || []);
    setActiveTab(0); // Switch to Composer Tab
    setSuccess(
      "Message loaded from history. You can now edit or send it again.",
    );
  };

  const loadTemplate = (temp: any) => {
    setTitle(temp.title);
    setBody(temp.body);
    setActiveTab(0);
  };

  if (!authLoaded)
    return <CircularProgress sx={{ display: "block", mx: "auto", mt: 10 }} />;

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="center" mb={4}>
        <IconButton onClick={() => navigate("/admin")} color="primary">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Notification Center
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Targeted outreach for {senderRole || "authorized staff"}
          </Typography>
        </Box>
      </Stack>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          icon={<SendIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label="Composer"
        />
        <Tab
          icon={<HistoryIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label="History"
        />
        <Tab
          icon={<TemplateIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label="Templates"
        />
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      {/* COMPOSER TAB */}
      {activeTab === 0 && (
        <Paper sx={{ p: 4, borderRadius: 3 }} elevation={3}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Subject Line"
                fullWidth
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 60))}
                helperText={`${title.length}/60 characters`}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Message Body"
                fullWidth
                multiline
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Target Audience</InputLabel>
                <Select
                  multiple
                  value={audience}
                  onChange={(e) =>
                    setAudience(
                      typeof e.target.value === "string"
                        ? e.target.value.split(",")
                        : e.target.value,
                    )
                  }
                  input={<OutlinedInput label="Target Audience" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {selected.map((val) => (
                        <Chip
                          key={val}
                          size="small"
                          label={
                            ALL_OPTIONS.find((o) => o.value === val)?.label ||
                            val
                          }
                          color={
                            val.startsWith("pref_") ? "secondary" : "primary"
                          }
                        />
                      ))}
                    </Box>
                  )}
                >
                  <ListSubheader
                    sx={{ fontWeight: "bold", bgcolor: "background.paper" }}
                  >
                    Official Roles
                  </ListSubheader>
                  {ROLE_AUDIENCES.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      <Checkbox checked={audience.indexOf(opt.value) > -1} />
                      <ListItemText primary={opt.label} />
                    </MenuItem>
                  ))}
                  <ListSubheader
                    sx={{ fontWeight: "bold", bgcolor: "background.paper" }}
                  >
                    Interest Topics
                  </ListSubheader>
                  {TOPIC_AUDIENCES.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      <Checkbox checked={audience.indexOf(opt.value) > -1} />
                      <ListItemText primary={opt.label} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleSend}
                  disabled={loading || !title || audience.length === 0}
                  startIcon={<SendIcon />}
                >
                  {loading ? "Processing..." : "Send Now"}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveAsTemplate}
                  disabled={!title || !body}
                >
                  Save as Template
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* HISTORY TAB */}
      {activeTab === 1 && (
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead sx={{ bgcolor: "grey.100" }}>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Audiences</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((row) => (
                <TableRow key={row.id}>
                  <TableCell variant="head" sx={{ width: 180 }}>
                    {row.sent_at
                      ? new Date(row.sent_at).toLocaleString()
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {row.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ maxWidth: 300, display: "block" }}
                    >
                      {row.body}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {row.audience?.map((a: string) => (
                      <Chip
                        key={a}
                        label={a}
                        size="small"
                        sx={{ mr: 0.5, fontSize: "0.7rem" }}
                      />
                    ))}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={row.status}
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Load into Composer">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleReSend(row)}
                      >
                        <SendIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* TEMPLATES TAB UI */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          {templates.map((temp) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={temp.id}>
              <Paper
                sx={{
                  p: 3,
                  borderRadius: 3,
                  position: "relative",
                  border: "1px solid #eee",
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  mb={1}
                >
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    noWrap
                    sx={{ maxWidth: "80%" }}
                  >
                    {temp.template_name}
                  </Typography>
                  <TemplateIcon color="disabled" fontSize="small" />
                </Stack>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  mb={2}
                >
                  Created:{" "}
                  {temp.created_at
                    ? new Date(temp.created_at).toLocaleDateString()
                    : "N/A"}
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 3,
                    height: 40,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {temp.body}
                </Typography>

                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={() => loadTemplate(temp)}
                  sx={{ borderRadius: 2 }}
                >
                  Load Template
                </Button>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
