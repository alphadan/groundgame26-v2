import React, { useState } from "react";
import { updatePassword, getIdToken } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Stack,
  Alert,
  CircularProgress,
  Container,
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

export default function UpdatePasswordScreen() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic Validation
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (!user) throw new Error("Session lost. Please log in again.");

      // 1. Update the password in Firebase Auth
      // This keeps the user signed in.
      await updatePassword(user, newPassword);

      // 2. Update Firestore flag
      // This is what the App.tsx "Gate" is watching.
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        requires_password_update: false,
        updated_at: Date.now(),
      });

      // 3. Force a token refresh (Optional but recommended)
      // This ensures any claims or session states are fresh.
      await getIdToken(user, true);

      setSuccess(true);

      // We don't need a navigate() here because App.tsx
      // reacts to userProfile.requires_password_update changing to false.
    } catch (err: any) {
      console.error("Password update error:", err);
      if (err.code === "auth/requires-recent-login") {
        setError(
          "For security, please log out and log back in before setting a new password.",
        );
      } else {
        setError(
          err.message || "An error occurred while updating your password.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Container maxWidth="xs">
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
          <Paper
            elevation={4}
            sx={{ p: 4, borderRadius: 4, width: "100%", textAlign: "center" }}
          >
            <CheckCircleOutlineIcon
              color="success"
              sx={{ fontSize: 60, mb: 2 }}
            />
            <Typography variant="h5" fontWeight="bold">
              Success!
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
              Your private password has been set.
            </Typography>
            <CircularProgress size={24} sx={{ mt: 3 }} />
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Redirecting to dashboard...
            </Typography>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xs">
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
        <Paper
          elevation={4}
          sx={{ p: 4, borderRadius: 4, width: "100%", textAlign: "center" }}
        >
          <LockResetIcon color="primary" sx={{ fontSize: 60, mb: 2 }} />
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Create Private Password
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            To protect voter data, you must replace your temporary password with
            a private one.
          </Typography>

          <form onSubmit={handleUpdate}>
            <Stack spacing={2.5}>
              <TextField
                label="New Private Password"
                type="password"
                fullWidth
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                helperText="Minimum 8 characters"
              />
              <TextField
                label="Confirm Password"
                type="password"
                fullWidth
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />

              {error && (
                <Alert severity="error" sx={{ textAlign: "left" }}>
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={loading || !newPassword}
                sx={{ py: 1.5, fontWeight: "bold", fontSize: "1rem" }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Set Password & Continue"
                )}
              </Button>
            </Stack>
          </form>
        </Paper>
      </Box>
    </Container>
  );
}
