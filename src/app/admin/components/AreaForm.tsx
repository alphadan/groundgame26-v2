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
  const { create, update, loading, error } = useAdminCRUD<Area>({
    collectionName: "areas",
  });

  const [formData, setFormData] = useState<Partial<Area>>({
    id: "",
    uid: "",
    name: "",
    area_district: "",
    county_id: "PA-C-15", // Default for Chester County
    active: true,
  });

  // Sync form state if initialData changes (when clicking Edit)
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        id: "",
        uid: "",
        name: "",
        area_district: "",
        county_id: "PA-C-15",
        active: true,
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = (formData.id || "").trim();

    const finalData = {
      ...formData,
      id: cleanId,
      uid: cleanId,
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
          disabled={!!initialData}
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          helperText="e.g. PA15-A-01"
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
          helperText="Two-digit district code"
        />

        <TextField
          label="County ID"
          fullWidth
          value={formData.county_id}
          disabled
          variant="filled"
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
          label="Active Status"
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          loading={loading}
          disabled={loading}
        >
          {initialData ? "Update Area" : "Create Area"}
        </Button>
      </Stack>
    </Box>
  );
};
