// src/app/settings/SettingsPage.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Redeem } from "@mui/icons-material";
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
  useMediaQuery,
} from "@mui/material";
import {
  PhotoCamera,
  Save,
  LockReset,
  DarkMode,
  LightMode,
  Badge as BadgeIcon,
} from "@mui/icons-material";
import {
  updateProfile,
  updateEmail,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { auth, db, storage } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useThemeMode } from "../../context/ThemeContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db as indexedDb } from "../../lib/db";

export default function SettingsPage() {
  const theme = useTheme();
  const { mode, toggleTheme } = useThemeMode();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const navigate = useNavigate();

  const { user, isLoaded } = useAuth();

  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    photoFile: null as File | null,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const photoUrlRef = useRef<string | null>(null);

  // Fetch app_control from IndexedDB
  const appControl = useLiveQuery(() =>
    indexedDb.app_control.toArray().then((arr) => arr[0])
  );

  useEffect(() => {
    if (user) {
      setFormData({
        displayName: user.displayName || "",
        email: user.email || "",
        photoFile: null,
      });
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
      }
    };
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current);
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB");
      return;
    }

    setFormData((prev) => ({ ...prev, photoFile: file }));
    photoUrlRef.current = URL.createObjectURL(file);
  };

  const handleSave = useCallback(async () => {
    if (!user) {
      setError("Not authenticated");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      let photoURL = user.photoURL;

      if (formData.photoFile) {
        setPhotoUploading(true);
        const storageRef = ref(storage, `profile-photos/${user.uid}`);
        await uploadBytes(storageRef, formData.photoFile);
        photoURL = await getDownloadURL(storageRef);
      }

      await updateProfile(user, {
        displayName: formData.displayName.trim() || null,
        photoURL: photoURL || null,
      });

      const newEmail = formData.email.trim();
      if (newEmail && newEmail !== user.email) {
        await updateEmail(user, newEmail);
      }

      await updateDoc(doc(db, "users", user.uid), {
        display_name: formData.displayName.trim() || null,
        email: newEmail || null,
        photo_url: photoURL || null,
        updated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      if (err.code === "auth/requires-recent-login") {
        setError(
          "For security, please log out and log in again before changing email."
        );
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email address");
      } else {
        setError(err.message || "Failed to save changes");
      }
    } finally {
      setSaving(false);
      console.log("[Settings]", "Profile saved.");
      setPhotoUploading(false);
    }
  }, [user, formData]);

  const handlePasswordReset = useCallback(async () => {
    if (!user?.email) {
      setError("No email associated with account");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetSent(true);
      setError("");
    } catch (err: any) {
      setError("Failed to send reset email");
    }
  }, [user]);

  if (!isLoaded) {
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

  const currentPhotoUrl = formData.photoFile
    ? photoUrlRef.current
    : user?.photoURL || "";

  return (
    <Container maxWidth="lg">
      <Typography
        variant="h4"
        fontWeight="bold"
        color="primary"
        gutterBottom
        sx={{ mt: 4, mb: 3 }}
      >
        Settings
      </Typography>

      <Grid container spacing={4}>
        {/* Left Column: Profile */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 4, borderRadius: 3, height: "100%" }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Profile
            </Typography>

            <Box sx={{ textAlign: "center", my: 4 }}>
              <Avatar
                src={currentPhotoUrl || undefined}
                sx={{
                  width: 140,
                  height: 140,
                  mx: "auto",
                  border: 6,
                  borderColor: "background.paper",
                  bgcolor: currentPhotoUrl ? "transparent" : "gold.main",
                  color: "#FFFFFF",
                  fontSize: "3rem",
                  fontWeight: "bold",
                }}
              >
                {currentPhotoUrl
                  ? null
                  : (user?.displayName || user?.email || "U")[0].toUpperCase()}
              </Avatar>
              <Button
                variant="text"
                component="label"
                startIcon={<PhotoCamera />}
                sx={{ mt: 2, color: "primary.main", fontWeight: "medium" }}
                disabled={true}
              >
                {photoUploading ? "Uploading..." : "Change Photo"}
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handlePhotoChange}
                />
              </Button>
            </Box>

            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Full Name"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    displayName: e.target.value,
                  }))
                }
                disabled={loading}
              />

              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                helperText="Changing email requires permission."
                disabled={true}
              />

              {error && <Alert severity="error">{error}</Alert>}
              {resetSent && (
                <Alert severity="info">
                  Password reset email sent to {user?.email}
                </Alert>
              )}

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleSave}
                disabled={loading}
                sx={{ py: 1.5, fontWeight: "bold" }}
              >
                {saving ? "Saving..." : "Save Profile"}
              </Button>

              <Button
                fullWidth
                variant="outlined"
                startIcon={<LockReset />}
                onClick={handlePasswordReset}
                disabled={loading || !user?.email}
              >
                Send Password Reset Email
              </Button>
            </Stack>
          </Paper>
        </Grid>

        {/* Right Column: App Settings */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={4}>
            {/* Appearance */}
            <Paper sx={{ p: 4, borderRadius: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Appearance
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={mode === "dark"}
                    onChange={toggleTheme}
                    icon={<LightMode />}
                    checkedIcon={<DarkMode />}
                  />
                }
                label={
                  <Typography variant="body1" fontWeight="medium">
                    Dark Mode
                  </Typography>
                }
                sx={{ ml: 0 }}
              />
            </Paper>

            {/* Badges & Rewards */}
            {/* Badges & Rewards */}
            <Paper sx={{ p: 4, borderRadius: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Badges & Rewards
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>*** SAMPLE ***</strong>
              </Typography>

              <Alert severity="info" sx={{ borderRadius: 2, mb: 3 }}>
                Earn badges by completing canvassing goals. Redeem for exclusive
                GOP swag and early access to campaign updates.
              </Alert>

              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={<Redeem />}
                onClick={() => navigate("/rewards")}
                sx={{ py: 2, fontWeight: "bold" }}
              >
                Open Redemption Center
              </Button>
            </Paper>

            {/* App Information — now from IndexedDB */}
            <Paper sx={{ p: 4, borderRadius: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                App Information
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Version"
                    secondary={appControl?.current_app_version || "—"}
                    primaryTypographyProps={{
                      variant: "body2",
                      fontWeight: "medium",
                    }}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Database"
                    secondary={appControl?.current_db_version || "—"}
                    primaryTypographyProps={{
                      variant: "body2",
                      fontWeight: "medium",
                    }}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                </ListItem>
              </List>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
