import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Stack,
  Alert,
} from "@mui/material";
import { useAdminCRUD } from "../../../hooks/useAdminCRUD";
import { useAuth } from "../../../context/AuthContext"; // Import Auth

interface Area {
  id: string;
  uid: string;
  name: string;
  area_district: string;
  county_id: string;
  active: boolean;
}

interface AreaFormProps {
  initialData?: Area | null;
  onSuccess?: () => void;
}

export const AreaForm: React.FC<AreaFormProps> = ({
  initialData,
  onSuccess,
}) => {
  // 1. Get the admin's assigned county from claims
  const { claims } = useAuth();
  const assignedCounty = claims?.counties?.[0] || "PA-C-15";

  const { create, update, loading, error } = useAdminCRUD<Area>({
    collectionName: "areas",
  });

  const [formData, setFormData] = useState<Partial<Area>>({
    id: "",
    uid: "",
    name: "",
    area_district: "",
    county_id: assignedCounty, // Use the dynamic ID
    active: true,
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        id: "",
        uid: "",
        name: "",
        area_district: "",
        county_id: assignedCounty,
        active: true,
      });
    }
  }, [initialData, assignedCounty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Safety check: Don't allow submission without a county_id
    if (!formData.county_id) {
      console.error("No county ID assigned to admin.");
      return;
    }

    const cleanId = (formData.id || "").trim();

    const finalData = {
      ...formData,
      id: cleanId,
      uid: cleanId,
      // Ensure the district code is always two digits (e.g., "5" becomes "05")
      area_district: String(formData.area_district || "").padStart(2, "0"),
    };

    try {
      if (initialData?.id) {
        await update(initialData.id, finalData);
      } else {
        await create(finalData as Area);
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Submission failed:", err);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack spacing={3}>
        <TextField
          label="Area ID (e.g. PA15-A-01)"
          fullWidth
          required
          disabled={!!initialData} // IDs should be immutable once created
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          helperText="Immutable unique identifier for this area"
        />

        <TextField
          label="Display Name"
          fullWidth
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g. West Chester North"
        />

        <TextField
          label="Area District Code"
          fullWidth
          required
          value={formData.area_district}
          onChange={(e) =>
            setFormData({ ...formData, area_district: e.target.value })
          }
          placeholder="e.g. 05"
          helperText="Two-digit code for reporting"
        />

        <TextField
          label="Assigned County"
          fullWidth
          value={formData.county_id}
          disabled
          variant="filled"
          helperText="Areas are automatically assigned to your primary county"
        />

        <FormControlLabel
          control={
            <Switch
              checked={formData.active}
              onChange={(e) =>
                setFormData({ ...formData, active: e.target.checked })
              }
            />
          }
          label="Active (Visible in field lists)"
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={loading}
        >
          {loading ? "Saving..." : initialData ? "Update Area" : "Create Area"}
        </Button>
      </Stack>
    </Box>
  );
};
