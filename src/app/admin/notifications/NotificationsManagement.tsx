// src/app/admin/notifications/NotificationsManagement.tsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext"; // adjust path
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db"; // adjust path
import { UserPermissions } from "../../../types"; // adjust path

// Navigation & UI imports
import { useNavigate } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Tooltip from "@mui/material/Tooltip";
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
  FormControlLabel,
  Switch,
  FormHelperText,
  Chip,
  Grid,
} from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";

// Mock Cloud Function call (replace with real HTTPS callable later)
const sendNotification = async (payload: any) => {
  console.log("Sending notification:", payload);
  // TODO: Call Cloud Function
  return { success: true, message: "Notification queued!" };
};

export default function NotificationsManagement() {
  const { user, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  const localUser = useLiveQuery(async () => {
    if (!user?.uid) return null;
    return await indexedDb.users.get(user.uid);
  }, [user?.uid]);

  const permissions: UserPermissions = (localUser?.permissions ||
    {}) as UserPermissions;
  const canBroadcast = !!permissions.can_manage_resources; // Adjust to your broadcast-specific permission

  const hasAccess = canBroadcast;

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<string[]>([]);
  const [customGroup, setCustomGroup] = useState<string>("");
  const [schedule, setSchedule] = useState<Date | null>(null);
  const [isImmediate, setIsImmediate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Available audiences (based on your roles)
  const availableAudiences = [
    "all_users",
    "state_rep_admins",
    "area_chairs",
    "committeepersons",
    "candidates",
    "ambassadors",
  ];

  // Prevent cursor blinking
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  if (!authLoaded) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "70vh",
        }}
      >
        <CircularProgress color="primary" size={60} />
      </Box>
    );
  }

  if (authLoaded && !hasAccess) {
    return (
      <Box p={6} textAlign="center">
        <Alert severity="error" variant="filled">
          <Typography variant="h6">Access Denied</Typography>
          <Typography variant="body1" mt={1}>
            You do not have permission to send notifications.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const bodyLength = body.length;
  const isBodyTooLong = bodyLength > 200;

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim() || audience.length === 0) {
      setError("Please fill in all required fields");
      return;
    }

    if (isBodyTooLong) {
      setError("Message body is too long (max 200 characters)");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        title,
        body,
        audience,
        customGroup: customGroup || null,
        schedule: isImmediate ? null : schedule?.toISOString(),
        senderUid: user?.uid,
      };

      const result = await sendNotification(payload);
      setSuccess(result.message || "Notification sent successfully!");
      // Reset form
      setTitle("");
      setBody("");
      setAudience([]);
      setCustomGroup("");
      setSchedule(null);
      setIsImmediate(true);
    } catch (err) {
      setError("Failed to send notification. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Back Button + Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Tooltip title="Back to Admin Dashboard" arrow>
          <IconButton
            onClick={() => navigate("/admin")}
            color="primary"
            size="large"
            sx={{ mr: 2 }}
            aria-label="back to dashboard"
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
        </Tooltip>

        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Manage Notifications
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Send targeted push notifications to users
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Paper elevation={3} sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Title */}
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Notification Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
              variant="outlined"
              helperText="Keep it short and attention-grabbing (e.g., 'New Milestone Challenge!')"
            />
          </Grid>

          {/* Body */}
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Message Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              fullWidth
              required
              multiline
              rows={4}
              variant="outlined"
              error={isBodyTooLong}
              helperText={
                isBodyTooLong
                  ? `Too long (${bodyLength}/200 characters)`
                  : `${bodyLength}/200 characters recommended`
              }
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: "block" }}
            >
              Best practices: Keep under 100 words • Use emojis sparingly •
              Include clear CTA (e.g., "View Now")
            </Typography>
          </Grid>

          {/* Audience */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth required>
              <InputLabel>Audience</InputLabel>
              <Select
                multiple
                value={audience}
                onChange={(e) =>
                  setAudience(
                    typeof e.target.value === "string"
                      ? [e.target.value]
                      : e.target.value
                  )
                }
                renderValue={(selected) => selected.join(", ")}
              >
                {availableAudiences.map((role) => (
                  <MenuItem key={role} value={role}>
                    <Checkbox checked={audience.includes(role)} />
                    <ListItemText primary={role.replace(/_/g, " ")} />
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Select who will receive this notification
              </FormHelperText>
            </FormControl>
          </Grid>

          {/* Custom Group (stub - expand later) */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Custom Broadcast Group (optional)"
              value={customGroup}
              onChange={(e) => setCustomGroup(e.target.value)}
              fullWidth
              variant="outlined"
              helperText="Select or create a saved group (coming soon)"
              disabled // Enable when you add group management
            />
          </Grid>

          {/* Schedule */}
          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={isImmediate}
                  onChange={(e) => setIsImmediate(e.target.checked)}
                  color="primary"
                />
              }
              label="Send immediately"
            />
            {!isImmediate && (
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateTimePicker
                  label="Schedule for"
                  value={schedule}
                  onChange={(newValue) => setSchedule(newValue)}
                  renderInput={(params) => (
                    <TextField {...params} fullWidth sx={{ mt: 2 }} />
                  )}
                  minDateTime={new Date()}
                />
              </LocalizationProvider>
            )}
          </Grid>

          {/* Preview (simple text mockup) */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Preview
            </Typography>
            <Paper
              variant="outlined"
              sx={{ p: 2, bgcolor: "background.default" }}
            >
              <Typography variant="subtitle2" color="primary">
                {title || "Notification Title"}
              </Typography>
              <Typography variant="body2">
                {body || "Your message body will appear here..."}
              </Typography>
            </Paper>
          </Grid>

          {/* Submit */}
          <Grid size={{ xs: 12 }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleSubmit}
              disabled={
                loading ||
                !title.trim() ||
                !body.trim() ||
                audience.length === 0
              }
              fullWidth
            >
              {loading
                ? "Sending..."
                : isImmediate
                ? "Send Now"
                : "Schedule Notification"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Future Features */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          Planned Features
        </Typography>
        <Box component="ul" sx={{ pl: 3, mt: 1 }}>
          <Typography component="li" variant="body1">
            Full notification history & analytics
          </Typography>
          <Typography component="li" variant="body1">
            Saved templates
          </Typography>
          <Typography component="li" variant="body1">
            Custom audience groups
          </Typography>
          <Typography component="li" variant="body1">
            Milestone-triggered automation
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
