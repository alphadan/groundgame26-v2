import React, { useState } from "react";
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
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, recordEvent } from "../../../lib/firebase";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import { useAuth } from "../../../context/AuthContext";

interface AssignUserDialogProps {
  open: boolean;
  onClose: () => void;
  roleId: string; // The ID of the org_role document
  onSuccess: () => void;
}

export default function AssignUserDialog({
  open,
  onClose,
  roleId,
  onSuccess,
}: AssignUserDialogProps) {
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth(); // Using user for the recordEvent
  const { callFunction } = useCloudFunctions();

  // 1. Fetch all active users for the selection list
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["assignableUsers"],
    queryFn: async () => {
      const q = query(collection(db, "users"), where("active", "==", true));
      const snap = await getDocs(q);
      return snap.docs.map((doc) => ({
        id: doc.id,
        label: `${doc.data().display_name || "No Name"} (${doc.data().email})`,
      }));
    },
    enabled: open,
  });

  const handleAssign = async () => {
    if (!selectedUid) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await callFunction("adminAssignUserToRole", {
        roleDocId: roleId,
        targetUid: selectedUid,
      });

      recordEvent("role_assigned", {
        role_id: roleId,
        assigned_by: user?.uid,
        target_uid: selectedUid,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to assign user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Assign User to Position</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Autocomplete
          options={users}
          loading={isLoading}
          onChange={(_, val) => setSelectedUid(val?.id || null)}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search Users"
              placeholder="Start typing name or email..."
              helperText="Only active users are shown"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {isLoading ? (
                      <CircularProgress color="inherit" size={20} />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleAssign}
          disabled={!selectedUid || isSubmitting}
        >
          {isSubmitting ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            "Confirm Assignment"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
