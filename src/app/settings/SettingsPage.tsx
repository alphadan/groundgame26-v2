// src/app/settings/SettingsPage.tsx
import { useState } from "react";
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
} from "@mui/material";
import { PhotoCamera, Save } from "@mui/icons-material";
import {
  getAuth,
  updateProfile,
  updateEmail,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db, storage } from "../../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function SettingsPage() {
  const auth = getAuth();
  const user = auth.currentUser;

  const [formData, setFormData] = useState({
    displayName: user?.displayName || "",
    email: user?.email || "",
    phone: user?.phoneNumber || "",
    photoFile: null as File | null,
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

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

      if (formData.photoFile) {
        const storageRef = ref(storage, `profile-photos/${user.uid}`);
        await uploadBytes(storageRef, formData.photoFile);
        photoURL = await getDownloadURL(storageRef);
      }

      await updateProfile(user, {
        displayName: formData.displayName,
        photoURL: photoURL || undefined,
      });

      if (formData.email !== user.email) {
        await updateEmail(user, formData.email);
      }

      await updateDoc(doc(db, "users", user.uid), {
        display_name: formData.displayName,
        email: formData.email,
        phone: formData.phone || "",
        photo_url: photoURL || "",
        updated_at: new Date(),
      });

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <Typography>Please log in.</Typography>;

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          My Profile & Settings
        </Typography>

        <Box sx={{ textAlign: "center", my: 4 }}>
          <Avatar
            src={
              formData.photoFile
                ? URL.createObjectURL(formData.photoFile)
                : user.photoURL || ""
            }
            sx={{ width: 120, height: 120, mx: "auto" }}
          />
          <Button
            variant="outlined"
            component="label"
            startIcon={<PhotoCamera />}
            sx={{ mt: 2 }}
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

        <Box sx={{ "& > :not(style)": { my: 2 } }}>
          <TextField
            fullWidth
            label="Display Name"
            value={formData.displayName}
            onChange={(e) =>
              setFormData({ ...formData, displayName: e.target.value })
            }
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
          <TextField
            fullWidth
            label="Phone"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">+1</InputAdornment>
              ),
            }}
          />

          {success && <Alert severity="success">Saved successfully!</Alert>}
          {error && <Alert severity="error">{error}</Alert>}

          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <Save />}
            onClick={handleSave}
            disabled={loading}
            sx={{
              mt: 3,
              py: 1.5,
              backgroundColor: "#B22234",
              "&:hover": { bgcolor: "#8B1A1A" },
            }}
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
          <Box sx={{ mt: 3, textAlign: "center" }}>
            {user?.email ? (
              <Link
                component="button"
                variant="body2"
                onClick={() => sendPasswordResetEmail(auth, user.email!)}
                sx={{ color: "#B22234", fontWeight: "medium" }}
              >
                Send Password Reset Email
              </Link>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Email not available
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Container>
  );
}
