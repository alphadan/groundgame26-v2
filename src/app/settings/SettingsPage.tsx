import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Redeem,
  Save,
  LockReset,
  DarkMode,
  LightMode,
  History,
  Gavel,
  DirectionsWalk,
  Email,
  Info,
  Message,
  MilitaryTech,
} from "@mui/icons-material";
import {
  Box,
  Container,
  Avatar,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Stack,
  Divider,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Grid,
  useTheme,
  Chip,
  ListItemIcon as MuiListItemIcon,
} from "@mui/material";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { CommunicationPreferences } from "./components/CommunicationPreferences";
import { auth, db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useThemeMode } from "../../context/ThemeContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../lib/db";

export default function SettingsPage() {
  const theme = useTheme();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const { user, userProfile, claims, isLoaded } = useAuth();

  const [formData, setFormData] = useState({
    displayName: "",
    preferredName: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const appControl = useLiveQuery(() =>
    indexedDb.app_control.toArray().then((arr) => arr[0]),
  );

  useEffect(() => {
    if (userProfile) {
      setFormData({
        displayName: userProfile.display_name || "",
        preferredName: userProfile.preferred_name || "",
      });
    }
  }, [userProfile]);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      await updateProfile(user, { displayName: formData.displayName.trim() });
      await updateDoc(doc(db, "users", user.uid), {
        display_name: formData.displayName.trim(),
        preferred_name: formData.preferredName.trim(),
        updated_at: new Date().toISOString(),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }, [user, formData]);

  if (!isLoaded)
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "70vh",
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="900" color="primary" gutterBottom>
        Account Settings
      </Typography>

      <Grid container spacing={3}>
        {/* IDENTITY SECTION */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 4, borderRadius: 3, height: "100%" }}>
            <Stack alignItems="center" spacing={2} sx={{ mb: 4 }}>
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  bgcolor: "gold.main",
                  color: "gold.contrastText",
                  border: `4px solid ${theme.palette.background.paper}`,
                  boxShadow: 3,
                  fontSize: "3rem",
                  fontWeight: "bold",
                }}
              >
                {(formData.displayName || user?.email || "U")[0].toUpperCase()}
              </Avatar>
              <Box textAlign="center">
                <Typography variant="h6" fontWeight="bold">
                  {formData.displayName || "User"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {user?.email}
                </Typography>
              </Box>
            </Stack>

            <Stack spacing={2.5}>
              <TextField
                fullWidth
                label="Public Display Name"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    displayName: e.target.value,
                  }))
                }
              />
              <TextField
                fullWidth
                label="Preferred Name (Internal)"
                value={formData.preferredName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    preferredName: e.target.value,
                  }))
                }
              />

              {success && <Alert severity="success">Profile updated!</Alert>}
              {error && <Alert severity="error">{error}</Alert>}

              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={saving}
                sx={{ fontWeight: "bold", py: 1.5 }}
              >
                {saving ? "Saving..." : "Update Profile"}
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* REWARDS CENTER */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={3}>
            {/* Points Summary Card */}
            <Paper
              sx={{
                p: 3,
                borderRadius: 3,
                border: "2px solid",
                borderColor: "#4527a0",
                bgcolor:
                  mode === "dark" ? "rgba(103, 58, 183, 0.1)" : "primary.50",
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Box>
                  <Typography
                    variant="subtitle2"
                    color="primary"
                    fontWeight="bold"
                    sx={{ textTransform: "uppercase" }}
                  >
                    Available Balance
                  </Typography>
                  <Typography
                    variant="h3"
                    fontWeight="900"
                    sx={{ fontFamily: "'Roboto Mono', monospace" }}
                  >
                    {userProfile?.points_balance?.toLocaleString() || 0} pts
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<Redeem />}
                  onClick={() => navigate("/rewards")}
                >
                  Redeem
                </Button>
              </Stack>
            </Paper>

            {/* Points History List */}
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Typography
                variant="h6"
                fontWeight="bold"
                gutterBottom
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <History fontSize="small" /> Points History
              </Typography>
              <List
                sx={{
                  maxHeight: 300,
                  overflow: "auto",
                  bgcolor: "background.default",
                  borderRadius: 2,
                }}
              >
                {userProfile?.points_history &&
                userProfile.points_history.length > 0 ? (
                  [...userProfile.points_history]
                    .reverse()
                    .map((log: any, i: number) => (
                      <ListItem
                        key={i}
                        divider={i !== userProfile.points_history!.length - 1}
                      >
                        <MuiListItemIcon sx={{ minWidth: 40 }}>
                          {log.action === "walk" ? (
                            <DirectionsWalk color="primary" />
                          ) : log.action === "email" ? (
                            <Email color="info" />
                          ) : (
                            <Message color="success" />
                          )}
                        </MuiListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight="bold">
                              +{log.amount} points: {log.action.toUpperCase()}
                            </Typography>
                          }
                          secondary={new Date(log.timestamp).toLocaleString()}
                        />
                      </ListItem>
                    ))
                ) : (
                  <ListItem>
                    <ListItemText secondary="No points earned yet. Start canvassing to earn rewards!" />
                  </ListItem>
                )}
              </List>
            </Paper>
          </Stack>
        </Grid>

        {/* PREFERENCES & SECURITY */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography
              variant="h6"
              fontWeight="bold"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <MilitaryTech fontSize="small" /> Preferences & Security
            </Typography>
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch checked={mode === "dark"} onChange={toggleTheme} />
                }
                label={
                  mode === "dark" ? "Dark Mode Active" : "Light Mode Active"
                }
              />
              <Divider />
              <Button
                variant="outlined"
                color="primary"
                startIcon={<LockReset />}
                onClick={() =>
                  auth.currentUser?.email && navigate("/reset-password")
                }
              >
                Reset Password
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* LEGAL & COMPLIANCE (READ ONLY) */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              variant="h6"
              fontWeight="bold"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <Gavel fontSize="small" /> Legal Consent
            </Typography>
            <Stack spacing={2}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography variant="body2">Privacy Policy & Terms:</Typography>
                <Chip
                  size="small"
                  label={
                    userProfile?.has_agreed_to_terms
                      ? "Accepted"
                      : "Not Accepted"
                  }
                  color={
                    userProfile?.has_agreed_to_terms ? "success" : "warning"
                  }
                />
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  <strong>Agreed at:</strong>{" "}
                  {userProfile?.legal_consent?.agreed_at_ms
                    ? new Date(
                        userProfile.legal_consent.agreed_at_ms,
                      ).toLocaleString()
                    : "N/A"}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  <strong>Verification:</strong> IP/Device Logged
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    wordBreak: "break-all",
                    opacity: 0.7,
                    display: "block",
                    mt: 1,
                  }}
                >
                  <strong>Client:</strong>{" "}
                  {userProfile?.legal_consent?.user_agent || "System Native"}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={3}>
            <Paper> {/* Points Summary */} </Paper>

            {/* NEW IMPORTED MODULE */}
            <CommunicationPreferences
              uid={user?.uid ?? ""}
              userProfile={userProfile}
              claims={claims}
            />

            <Paper> {/* Points History */} </Paper>
          </Stack>
        </Grid>

        {/* FOOTER INFO */}
        <Grid size={{ xs: 12 }}>
          <Box sx={{ textAlign: "center", mt: 2, opacity: 0.6 }}>
            <Typography
              variant="caption"
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Info sx={{ fontSize: 14 }} />
              App Version {appControl?.current_app_version || "2.1.0"} |
              Database {appControl?.current_db_version || "2026.Q1"}
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}
