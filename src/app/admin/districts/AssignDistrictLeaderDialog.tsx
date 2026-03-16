// src/app/admin/districts/AssignDistrictLeaderDialog.tsx
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Autocomplete,
  TextField,
  CircularProgress,
  Alert,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";

export default function AssignDistrictLeaderDialog({
  open,
  onClose,
  districtId,
  initialLeaders,
  onSuccess,
}: any) {
  const [selectedLeaders, setSelectedLeaders] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { callFunction } = useCloudFunctions();

  useEffect(() => {
    if (open && initialLeaders) {
      // Standardize the field names so Autocomplete recognizes them
      setSelectedLeaders(
        initialLeaders.map((l: any) => ({
          id: l.uid,
          nameOnly: l.name,
          label: l.name,
        })),
      );
    }
  }, [open, initialLeaders]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["assignableUsers"],
    queryFn: async () => {
      const q = query(collection(db, "users"), where("active", "==", true));
      const snap = await getDocs(q);
      return snap.docs.map((doc) => ({
        id: doc.id,
        nameOnly: doc.data().display_name || "Unknown",
        label: `${doc.data().display_name || "Unknown"} (${doc.data().email || ""})`,
      }));
    },
    enabled: open,
  });

  const handleAssign = async () => {
    setIsSubmitting(true);
    try {
      await callFunction("updateDistrictLeadership", {
        districtId,
        leaders: selectedLeaders.map((u) => ({ uid: u.id, name: u.nameOnly })),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Assign Leaders for {districtId}</DialogTitle>
      <DialogContent sx={{ pt: 2, mt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Autocomplete
          multiple
          options={users}
          loading={isLoading}
          value={selectedLeaders}
          getOptionDisabled={() => selectedLeaders.length >= 2}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          getOptionLabel={(o) => o.label || ""}
          onChange={(_, val) => setSelectedLeaders(val)}
          sx={{ mt: 1 }}
          renderInput={(params) => (
            <TextField {...params} label="Select Leaders (Max 2)" />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleAssign}
          disabled={isSubmitting}
        >
          Update
        </Button>
      </DialogActions>
    </Dialog>
  );
}
