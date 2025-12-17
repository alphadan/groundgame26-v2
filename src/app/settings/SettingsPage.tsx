import { useState, useEffect } from "react";
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
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Unified Imports
import { auth, db, storage } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";

export default function SettingsPage() {
  // 1. Source identity from our reactive Gatekeeper
  const { user, isLoaded } = useAuth();

  const [formData, setFormData] = useState({
    displayName: user?.displayName || "",
    email: user?.email || "",
    phone: "", // Will be populated from users_meta
    photoFile: null as File | null,
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFormData({ ...formData, photoFile: e.target.files[0] });
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      let photoURL = user.photoURL;

      // 2. Handle Profile Photo Upload
      if (formData.photoFile) {
        const storageRef = ref(storage, `profile-photos/${user.uid}`);
        await uploadBytes(storageRef, formData.photoFile);
        photoURL = await getDownloadURL(storageRef);
      }

      // 3. Update Firebase Auth Profile (Global State)
      await updateProfile(user, {
        displayName: formData.displayName,
        photoURL: photoURL || undefined,
      });

      // 4. Update Email (Requires recent login - may throw error)
      if (formData.email !== user.email && formData.email) {
        await updateEmail(user, formData.email);
      }

      // 5. Update Central Metadata (Sync with ManageTeam/Dashboard)
      await updateDoc(doc(db, "users", user.uid), {
        display_name: formData.displayName,
        email: formData.email,
        photo_url: photoURL || "",
        updated_at: new Date().toISOString(),
      });

      setSuccess(true);
    } catch (err: any) {
      console.error("Settings Update Error:", err);
      // Handle the "Requires Recent Login" error specifically
      if (err.code === "auth/requires-recent-login") {
        setError(
          "For security, please log out and back in before changing your email."
        );
      } else {
        setError(err.message || "Failed to save changes.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetSent(true);
    } catch (err: any) {
      setError("Failed to send reset email.");
    }
  };

  if (!isLoaded)
    return (
      <Box p={10} textAlign="center">
        <CircularProgress />
      </Box>
    );

  return (
    <Container maxWidth="sm">
      <Paper sx={{ p: 4, mt: 4, borderRadius: 3, boxShadow: 3 }}>
        <Typography variant="h4" fontWeight="bold" color="#B22234" gutterBottom>
          Profile Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={4}>
          Manage your identity and contact information across the GroundGame26
          network.
        </Typography>

        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Avatar
            src={
              formData.photoFile
                ? URL.createObjectURL(formData.photoFile)
                : user?.photoURL || ""
            }
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
          >
            Change Photo
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
            variant="outlined"
            value={formData.displayName}
            onChange={(e) =>
              setFormData({ ...formData, displayName: e.target.value })
            }
          />
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            helperText="Changing your email requires a secure session."
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
            {loading ? "Updating..." : "Save Profile"}
          </Button>

          <Box sx={{ textAlign: "center", pt: 2 }}>
            <Button
              startIcon={<LockReset />}
              onClick={handlePasswordReset}
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
