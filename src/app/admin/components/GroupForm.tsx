import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Grid,
  Alert,
  Typography,
  Divider,
  Stack,
} from "@mui/material";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";
import { Group } from "../../../types";

interface GroupFormProps {
  initialData?: Group | null;
  onSuccess?: () => void;
}

export const GroupForm: React.FC<GroupFormProps> = ({
  initialData,
  onSuccess,
}) => {
  const { create, update, loading, error } = useAdminCRUD<Group>({
    collectionName: "groups", // Ensure this matches your Firebase collection name exactly
  });

  const [formData, setFormData] = useState<Partial<Group>>({
    id: "",
    code: "",
    name: "",
    short_name: "",
    county_id: "15",
    category: "",
    hq_phone: "",
    website: "",
    active: true,
    social_facebook: "",
    social_x: "",
    social_instagram: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initialData?.id) {
        await update(initialData.id, formData);
      } else {
        await create(formData as Group);
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Group save failed:", err);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* SECTION 1: CORE IDENTITY */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle2" color="primary" fontWeight="bold">
            Identity & Coding
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Document ID (Unique)"
            fullWidth
            required
            disabled={!!initialData}
            value={formData.id}
            onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            placeholder="e.g. GOP_PA_15"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Internal Code"
            fullWidth
            required
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="e.g. G26-001"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <TextField
            label="Full Organization Name"
            fullWidth
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label="Short Name"
            fullWidth
            required
            value={formData.short_name}
            onChange={(e) =>
              setFormData({ ...formData, short_name: e.target.value })
            }
          />
        </Grid>

        {/* SECTION 2: CATEGORIZATION */}
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="County ID"
            fullWidth
            value={formData.county_id}
            onChange={(e) =>
              setFormData({ ...formData, county_id: e.target.value })
            }
          />
        </Grid>

        <Grid size={{ xs: 12 }} sx={{ my: 1 }}>
          <Divider />
        </Grid>

        {/* SECTION 3: CONTACT & WEB */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="subtitle2" color="primary" fontWeight="bold">
            Contact Information
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="HQ Phone"
            fullWidth
            value={formData.hq_phone || ""}
            onChange={(e) =>
              setFormData({ ...formData, hq_phone: e.target.value })
            }
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="Website URL"
            fullWidth
            value={formData.website || ""}
            onChange={(e) =>
              setFormData({ ...formData, website: e.target.value })
            }
          />
        </Grid>

        {/* SECTION 4: SOCIAL MEDIA */}
        <Grid size={{ xs: 12 }}>
          <TextField
            label="Facebook URL"
            fullWidth
            value={formData.social_facebook || ""}
            onChange={(e) =>
              setFormData({ ...formData, social_facebook: e.target.value })
            }
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField
            label="X (Twitter) URL"
            fullWidth
            value={formData.social_x || ""}
            onChange={(e) =>
              setFormData({ ...formData, social_x: e.target.value })
            }
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TextField
            label="Instagram URL"
            fullWidth
            value={formData.social_instagram || ""}
            onChange={(e) =>
              setFormData({ ...formData, social_instagram: e.target.value })
            }
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box
            sx={{
              bgcolor: "#f8f9fa",
              p: 2,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={formData.active}
                  onChange={(e) =>
                    setFormData({ ...formData, active: e.target.checked })
                  }
                />
              }
              label={formData.active ? "Group is Active" : "Group is Inactive"}
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ py: 1.5, fontWeight: "bold" }}
          >
            {loading
              ? "Processing..."
              : initialData
              ? "Update Organization"
              : "Create Organization"}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};
