// src/app/admin/components/CreateGroupsForm.tsx
import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Typography,
  Alert,
} from "@mui/material";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore"; // Assuming you have firebase initialized
import { useAuth } from "../../../context/AuthContext"; // Adjust path

export function CreateGroupsForm() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    active: true,
    code: "",
    county_id: "",
    hq_phone: "",
    name: "",
    short_name: "",
    social_facebook: "",
    social_instagram: "",
    social_x: "",
    website: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      const db = getFirestore();
      await addDoc(collection(db, "organizations"), {
        ...formData,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      setSuccess(true);
      // Optional: reset form
      setFormData({
        active: true,
        code: "",
        county_id: "",
        hq_phone: "",
        name: "",
        short_name: "",
        social_facebook: "",
        social_instagram: "",
        social_x: "",
        website: "",
      });
    } catch (err) {
      setError("Failed to create group. Please try again.");
      console.error(err);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: "flex", flexDirection: "column", gap: 3 }}
    >
      <Typography variant="h6">Create New Group</Typography>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">Group created successfully!</Alert>}

      <FormControlLabel
        control={
          <Switch
            checked={formData.active}
            onChange={handleChange}
            name="active"
            color="primary"
          />
        }
        label="Active"
      />

      <TextField
        label="Code"
        name="code"
        value={formData.code}
        onChange={handleChange}
        required
        fullWidth
      />
      <TextField
        label="County ID"
        name="county_id"
        value={formData.county_id}
        onChange={handleChange}
        required
        fullWidth
      />
      <TextField
        label="HQ Phone"
        name="hq_phone"
        value={formData.hq_phone}
        onChange={handleChange}
        fullWidth
      />
      <TextField
        label="Name"
        name="name"
        value={formData.name}
        onChange={handleChange}
        required
        fullWidth
      />
      <TextField
        label="Short Name"
        name="short_name"
        value={formData.short_name}
        onChange={handleChange}
        fullWidth
      />
      <TextField
        label="Facebook URL"
        name="social_facebook"
        value={formData.social_facebook}
        onChange={handleChange}
        fullWidth
      />
      <TextField
        label="Instagram URL"
        name="social_instagram"
        value={formData.social_instagram}
        onChange={handleChange}
        fullWidth
      />
      <TextField
        label="X URL"
        name="social_x"
        value={formData.social_x}
        onChange={handleChange}
        fullWidth
      />
      <TextField
        label="Website"
        name="website"
        value={formData.website}
        onChange={handleChange}
        fullWidth
      />

      <Button type="submit" variant="contained" color="primary" sx={{ mt: 2 }}>
        Create Group
      </Button>
    </Box>
  );
}
