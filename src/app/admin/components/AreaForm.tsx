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
    name: "",
    area_district: "",
    county_id: "15", // Default for Chester County
    active: true,
  });

  // Sync form state if initialData changes (when clicking Edit)
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        id: "",
        name: "",
        area_district: "",
        county_id: "15",
        active: true,
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initialData?.id) {
        // Mode: EDIT
        await update(initialData.id, formData);
      } else {
        // Mode: CREATE
        // Note: we pass id inside the object because Areas often use custom IDs (like 'AREA-01')
        await create(formData as Area);
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
          label="Area ID (unique)"
          fullWidth
          required
          disabled={!!initialData} // IDs are usually immutable once created
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          placeholder="e.g. area_1"
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
          label="Area District"
          fullWidth
          required
          value={formData.area_district}
          onChange={(e) =>
            setFormData({ ...formData, area_district: e.target.value })
          }
          placeholder="e.g. District 5"
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
