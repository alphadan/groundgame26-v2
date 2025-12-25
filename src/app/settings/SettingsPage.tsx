// src/app/settings/SettingsPage.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Container,
  Avatar,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  InputAdornment,
  Link,
  Paper,
} from "@mui/material";
import { PhotoCamera, Save, LockReset } from "@mui/icons-material";
import {
  updateProfile,
  updateEmail,
  sendPasswordResetEmail,
  User,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { auth, db, storage } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";

export default function SettingsPage() {
  const { user, isLoaded } = useAuth();

  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    photoFile: null as File | null,
  });

  const [loading, setLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Track current photo preview URL for cleanup
  const photoUrlRef = useRef<string | null>(null);

  // === Sync form with current user (defensive) ===
  useEffect(() => {
    if (user) {
      setFormData({
        displayName: user.displayName || "",
        email: user.email || "",
        photoFile: null,
      });
    }
  }, [user]);

  // === Cleanup object URL on unmount or change ===
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

    // Revoke previous preview
    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current);
    }

    // Validate file type/size
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
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

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      let photoURL = user.photoURL;

      // === Photo Upload (isolated) ===
      if (formData.photoFile) {
        setPhotoUploading(true);
        const storageRef = ref(storage, `profile-photos/${user.uid}`);
        await uploadBytes(storageRef, formData.photoFile);
        photoURL = await getDownloadURL(storageRef);
        setPhotoUploading(false);
      }

      // === Update Auth Profile ===
      await updateProfile(user, {
        displayName: formData.displayName.trim() || null,
        photoURL: photoURL || null,
      });

      // === Update Email (with validation) ===
      const newEmail = formData.email.trim();
      if (newEmail && newEmail !== user.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
          throw new Error("Invalid email format");
        }
        await updateEmail(user, newEmail);
      }

      // === Update Firestore Meta ===
      await updateDoc(doc(db, "users", user.uid), {
        display_name: formData.displayName.trim() || null,
        email: newEmail || null,
        photo_url: photoURL || null,
        updated_at: new Date().toISOString(),
      });

      setSuccess(true);
    } catch (err: any) {
      console.error("Profile update failed:", err);
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
      setLoading(false);
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
      console.error("Password reset failed:", err);
      setError("Failed to send reset email");
    }
  }, [user]);

  // === Loading Guard ===
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

  const currentPhotoUrl = formData.photoFile
    ? photoUrlRef.current
    : user?.photoURL || "";

  return (
    <Container maxWidth="sm">
      <Paper sx={{ p: 4, mt: 4, borderRadius: 3, boxShadow: 3 }}>
        <Typography variant="h4" fontWeight="bold" color="#B22234" gutterBottom>
          Profile Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={4}>
          Manage your identity and contact information.
        </Typography>

        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Avatar
            src={currentPhotoUrl || undefined}
            sx={{
              width: 120,
              height: 120,
              mx: "auto",
              border: "4px solid #f0f0f0",
            }}
          />
          <Button
            variant="text"
            component="label"
            startIcon={<PhotoCamera />}
            sx={{ mt: 1, color: "#B22234" }}
            disabled={photoUploading}
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

        <Box sx={{ "& > :not(style)": { mb: 3 } }}>
          <TextField
            fullWidth
            label="Full Name"
            value={formData.displayName}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, displayName: e.target.value }))
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
            helperText="Changing email requires recent login"
            disabled={loading}
          />

          {success && (
            <Alert severity="success">Profile updated successfully!</Alert>
          )}
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
            startIcon={
              loading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <Save />
              )
            }
            onClick={handleSave}
            disabled={loading}
            sx={{
              bgcolor: "#B22234",
              py: 1.5,
              fontWeight: "bold",
              "&:hover": { bgcolor: "#8B1A1A" },
            }}
          >
            {loading ? "Saving..." : "Save Profile"}
          </Button>

          <Box textAlign="center" pt={2}>
            <Button
              startIcon={<LockReset />}
              onClick={handlePasswordReset}
              disabled={loading || !user?.email}
              sx={{ color: "#666", textTransform: "none" }}
            >
              Send Password Reset Link
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
