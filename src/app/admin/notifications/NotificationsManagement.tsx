// src/app/admin/notifications/NotificationsManagement.tsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../../lib/db";
import { UserPermissions } from "../../../types";

// Navigation & UI
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

// Mock send (replace with real Cloud Function call later)
const sendNotification = async (payload: any) => {
  console.log("Sending notification:", payload);
  return { success: true, message: "Notification queued!" };
};

export default function NotificationsManagement() {
  const { user, claims, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  const localUser = useLiveQuery(async () => {
    if (!user?.uid) return null;
    return await indexedDb.users.get(user.uid);
  }, [user?.uid]);

  const permissions: UserPermissions = (localUser?.permissions ||
    {}) as UserPermissions;
  const canBroadcast = !!permissions.can_manage_resources; // Adjust if you have a specific broadcast perm

  const hasAccess = canBroadcast;

  // Get sender's role from claims (e.g. custom claim 'role')
  const senderRole = claims?.role as string | undefined; // e.g. 'county_chair', 'area_chair', etc.

  // === Role-based Audience Filtering ===
  const fullAudienceOptions = [
    { value: "all_users", label: "All Users" },
    { value: "state_rep_admins", label: "State Rep Admins" },
    { value: "area_chairs", label: "Area Chairs" },
    { value: "committeepersons", label: "Committeepersons" },
    { value: "candidates", label: "Candidates" },
    { value: "volunteers", label: "Volunteers" },
  ];

  // Filter options based on sender role
  const getAllowedAudiences = () => {
    if (senderRole === "county_chair") {
      return fullAudienceOptions; // Full access
    }
    if (senderRole === "state_rep_admin") {
      return fullAudienceOptions.filter((opt) =>
        [
          "area_chairs",
          "committeepersons",
          "candidates",
          "volunteers",
        ].includes(opt.value)
      );
    }
    if (senderRole === "area_chair") {
      return fullAudienceOptions.filter((opt) =>
        ["committeepersons", "candidates", "volunteers"].includes(opt.value)
      );
    }
    // Fallback: no options (shouldn't reach here due to hasAccess)
    return [];
  };

  const allowedAudiences = getAllowedAudiences();

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

  // Length calculations
  const titleLength = title.length;
  const bodyLength = body.length;
  const bodyWords = body.split(/\s+/).filter(Boolean).length;

  const isTitleTooLong = titleLength > 60;
  const isBodyTooLong = bodyLength > 200 || bodyWords > 100;

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

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim() || audience.length === 0) {
      setError("Please fill in all required fields");
      return;
    }

    if (isTitleTooLong) {
      setError("Title must be 60 characters or less");
      return;
    }

    if (bodyWords > 100) {
      setError("Body must be 100 words or fewer");
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
            Send targeted push notifications ({senderRole || "Unknown role"})
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
          {/* Title with strict limit */}
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Notification Title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 60))} // Enforce limit
              fullWidth
              required
              variant="outlined"
              inputProps={{ maxLength: 60 }}
              error={isTitleTooLong}
              helperText={
                <Box component="span">
                  {titleLength}/60 characters
                  {isTitleTooLong && (
                    <Box component="span" sx={{ color: "error.main", ml: 1 }}>
                      Too long!
                    </Box>
                  )}
                  {titleLength > 40 && titleLength <= 60 && (
                    <Box component="span" sx={{ color: "warning.main", ml: 1 }}>
                      May truncate on some devices
                    </Box>
                  )}
                </Box>
              }
            />
          </Grid>

          {/* Body with word & char limits */}
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Message Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              fullWidth
              required
              multiline
              rows={5}
              variant="outlined"
              error={bodyLength > 200 || bodyWords > 100}
              helperText={
                <Box component="span">
                  {bodyLength}/200 characters • {bodyWords} words
                  <br />
                  Target: 40-60 words for best engagement
                  {(bodyWords > 60 || bodyLength > 150) && (
                    <Box component="span" sx={{ color: "warning.main", ml: 1 }}>
                      Consider shortening
                    </Box>
                  )}
                  {(bodyWords > 100 || bodyLength > 200) && (
                    <Box component="span" sx={{ color: "error.main", ml: 1 }}>
                      Exceeds limits!
                    </Box>
                  )}
                </Box>
              }
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: "block" }}
            >
              Best practices: Clear CTA • Emojis sparingly • Personalize when
              possible
            </Typography>
          </Grid>

          {/* Audience – role-filtered */}
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
                renderValue={(selected) =>
                  selected
                    .map(
                      (v) =>
                        fullAudienceOptions.find((o) => o.value === v)?.label
                    )
                    .join(", ")
                }
              >
                {allowedAudiences.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    <Checkbox checked={audience.includes(opt.value)} />
                    <ListItemText primary={opt.label} />
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Available options limited by your role (
                {senderRole || "loading..."})
              </FormHelperText>
            </FormControl>
          </Grid>

          {/* Custom Group (stub) */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Custom Broadcast Group (optional)"
              value={customGroup}
              onChange={(e) => setCustomGroup(e.target.value)}
              fullWidth
              variant="outlined"
              helperText="Saved groups coming soon"
              disabled
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
                  minDateTime={new Date()}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      sx: { mt: 2 },
                      helperText: "Select date & time for scheduled send",
                    },
                  }}
                />
              </LocalizationProvider>
            )}
          </Grid>

          {/* Preview */}
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
                audience.length === 0 ||
                isTitleTooLong ||
                bodyWords > 100 ||
                bodyLength > 200
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
            Notification history & delivery analytics
          </Typography>
          <Typography component="li" variant="body1">
            Saved templates & custom groups
          </Typography>
          <Typography component="li" variant="body1">
            Milestone-triggered auto-notifications
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
