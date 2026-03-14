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
  doc,
  deleteDoc,
  setDoc,
  updateDoc,
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
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Stack,
  ListSubheader,
  OutlinedInput,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import {
  ArrowBack as ArrowBackIcon,
  History as HistoryIcon,
  Send as SendIcon,
  Description as TemplateIcon,
  Save as SaveIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from "@mui/icons-material";

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
  const [dynamicTopics, setDynamicTopics] = useState<any[]>([]);

  // Topic CRUD State
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<any>(null);

  const organizedAudience = useMemo(() => {
    const roles = dynamicTopics
      .filter((t) => t.type === "role" && t.active !== false)
      .sort((a, b) => a.label.localeCompare(b.label));

    const interests = dynamicTopics
      .filter((t) => t.type === "interest" && t.active !== false)
      .sort((a, b) => a.label.localeCompare(b.label));

    return { roles, interests };
  }, [dynamicTopics]);

  // 2. Best Practice Limiters
  const MAX_TITLE = 60;
  const MAX_BODY = 170;

  // --- DATA FETCHING ---
  useEffect(() => {
    if (!user) return;

    // 1. Listen to History
    const historyQuery = query(
      collection(db, "notifications_history"),
      orderBy("created_at", "desc"),
      limit(100),
    );
    const unsubHistory = onSnapshot(historyQuery, (snap) => {
      setHistory(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    // 2. Listen to Templates
    const templateQuery = query(
      collection(db, "notification_templates"),
      orderBy("created_at", "desc"),
    );
    const unsubTemplates = onSnapshot(templateQuery, (snap) => {
      setTemplates(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    // 3. Listen to Dynamic Topics
    const topicsQuery = query(
      collection(db, "notification_topics"),
      orderBy("label", "asc"),
    );
    const unsubTopics = onSnapshot(topicsQuery, (snap) => {
      setDynamicTopics(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubHistory();
      unsubTemplates();
      unsubTopics();
    };
  }, [user]);

  // --- HANDLERS ---
  const handleSend = async () => {
    if (!title || !body || audience.length === 0) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "notifications_history"), {
        title: title.trim(),
        body: body.trim(),
        audience,
        status: "queued",
        created_at: Date.now(),
        sender_uid: user?.uid,
      });
      setSuccess("Notification queued for delivery.");
      setTitle("");
      setBody("");
      setAudience([]);
    } catch (err) {
      setError("Failed to queue notification.");
    } finally {
      setLoading(false);
    }
  };

  const handleTopicSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget as HTMLFormElement);
    const label = data.get("label") as string;
    const desc = data.get("desc") as string;
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const topicId = editingTopic?.id || `top-${slug}`;

    try {
      await setDoc(
        doc(db, "notification_topics", topicId),
        {
          label,
          description: desc,
          active: true,
        },
        { merge: true },
      );
      setTopicModalOpen(false);
      setEditingTopic(null);
    } catch (err) {
      setError("Failed to save topic.");
    }
  };

  // --- DATAGRID COLUMNS ---
  const historyColumns: GridColDef[] = [
    {
      field: "created_at",
      headerName: "Sent At",
      width: 180,
      valueGetter: (params: any) => new Date(params).toLocaleString(),
    },
    { field: "title", headerName: "Subject", flex: 1 },
    {
      field: "audience",
      headerName: "Targeting",
      width: 250,
      renderCell: (params) => (
        <Box sx={{ display: "flex", gap: 0.5, overflow: "hidden" }}>
          {params.value?.map((a: string) => (
            <Chip key={a} label={a} size="small" variant="outlined" />
          ))}
        </Box>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === "delivered" ? "success" : "warning"}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      type: "actions",
      width: 80,
      getActions: (params) => [
        <Tooltip title="Resend / Reload">
          <IconButton
            size="small"
            onClick={() => {
              setTitle(params.row.title);
              setBody(params.row.body);
              setAudience(params.row.audience);
              setActiveTab(0);
            }}
          >
            <SendIcon fontSize="small" color="primary" />
          </IconButton>
        </Tooltip>,
      ],
    },
  ];

  const topicColumns: GridColDef[] = [
    { field: "id", headerName: "Topic ID", width: 200 },
    { field: "label", headerName: "Display Label", flex: 1 },
    {
      field: "actions",
      headerName: "Actions",
      type: "actions",
      width: 120,
      getActions: (params) => [
        <IconButton
          size="small"
          onClick={() => {
            setEditingTopic(params.row);
            setTopicModalOpen(true);
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>,
        <IconButton
          size="small"
          color="error"
          onClick={() =>
            deleteDoc(doc(db, "notification_topics", params.id as string))
          }
        >
          <DeleteIcon fontSize="small" />
        </IconButton>,
      ],
    },
  ];

  if (!authLoaded)
    return <CircularProgress sx={{ display: "block", mx: "auto", mt: 10 }} />;

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack direction="row" spacing={2} alignItems="center" mb={4}>
        <IconButton onClick={() => navigate("/admin")} color="primary">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Notification Center
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Targeted messaging and topic management
          </Typography>
        </Box>
      </Stack>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 3 }}
      >
        <Tab icon={<SendIcon />} iconPosition="start" label="Composer" />
        <Tab icon={<HistoryIcon />} iconPosition="start" label="History" />
        <Tab icon={<TemplateIcon />} iconPosition="start" label="Templates" />
        <Tab icon={<SettingsIcon />} iconPosition="start" label="Topics" />
      </Tabs>

      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      {/* COMPOSER */}
      {activeTab === 0 && (
        <Paper sx={{ p: 4, borderRadius: 3 }} elevation={3}>
          <Stack spacing={3}>
            <TextField
              label="Subject Line"
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
              error={title.length >= MAX_TITLE}
              helperText={`${title.length}/${MAX_TITLE} characters (Optimal for mobile screens)`}
            />
            <TextField
              label="Message Body"
              fullWidth
              multiline
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
              error={body.length >= MAX_BODY}
              helperText={`${body.length}/${MAX_BODY} characters (Prevents notification truncation)`}
            />

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
                    {selected.map((val) => {
                      const topic = dynamicTopics.find((t) => t.id === val);
                      return (
                        <Chip
                          key={val}
                          size="small"
                          label={topic?.label || val}
                          color={
                            topic?.type === "role" ? "primary" : "secondary"
                          }
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {/* Dynamic Official Roles Section */}
                <ListSubheader
                  sx={{ fontWeight: "bold", color: "primary.main" }}
                >
                  Official Roles
                </ListSubheader>
                {organizedAudience.roles.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    <Checkbox checked={audience.includes(r.id)} />
                    <ListItemText primary={r.label} />
                  </MenuItem>
                ))}

                {/* Dynamic Interest Topics Section */}
                <ListSubheader
                  sx={{ fontWeight: "bold", color: "secondary.main" }}
                >
                  Interest Topics
                </ListSubheader>
                {organizedAudience.interests.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    <Checkbox checked={audience.includes(t.id)} />
                    <ListItemText primary={t.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                size="large"
                onClick={handleSend}
                disabled={loading || !title || audience.length === 0}
              >
                Send Notification
              </Button>
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={() => {
                  /* Existing Template Logic */
                }}
              >
                Save as Template
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* HISTORY DATAGRID */}
      {activeTab === 1 && (
        <Paper sx={{ height: 600, width: "100%", borderRadius: 3 }}>
          <DataGrid
            rows={history}
            columns={historyColumns}
            pageSizeOptions={[10, 20]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          />
        </Paper>
      )}

      {/* TOPICS MANAGEMENT */}
      {activeTab === 3 && (
        <Box>
          <Button
            variant="contained"
            startIcon={<SettingsIcon />}
            sx={{ mb: 2 }}
            onClick={() => {
              setEditingTopic(null);
              setTopicModalOpen(true);
            }}
          >
            Add New Topic
          </Button>
          <Paper sx={{ height: 500, width: "100%", borderRadius: 3 }}>
            <DataGrid
              rows={dynamicTopics}
              columns={topicColumns}
              hideFooterPagination
            />
          </Paper>
        </Box>
      )}

      {/* TOPIC CRUD MODAL */}
      <Dialog
        open={topicModalOpen}
        onClose={() => setTopicModalOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <form onSubmit={handleTopicSave}>
          <DialogTitle>
            {editingTopic ? "Edit Topic" : "Create New Topic"}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                name="label"
                label="Display Label"
                fullWidth
                required
                defaultValue={editingTopic?.label}
              />
              <TextField
                name="desc"
                label="Description"
                fullWidth
                multiline
                rows={2}
                defaultValue={editingTopic?.description}
              />
              <Typography variant="caption" color="text.secondary">
                Note: IDs are automatically prefixed with 'top-'
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTopicModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Save Topic
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
