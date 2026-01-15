// src/app/admin/roles/AssignUserDialog.tsx
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
import { db } from "../../../lib/firebase";
import { useCloudFunctions } from "../../../hooks/useCloudFunctions";
import { recordEvent } from "../../../lib/firebase"; // Check path to your firebase.ts
import { useAuth } from "../../../context/AuthContext"; // Import your hook

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
  const { userProfile } = useAuth();
  const { callFunction } = useCloudFunctions();

  // 1. Fetch all active users for the selection list
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["assignableUsers"],
    queryFn: async () => {
      const q = query(collection(db, "users"), where("active", "==", true));
      const snap = await getDocs(q);
      return snap.docs.map((doc) => ({
        id: doc.id,
        label: `${doc.data().display_name} (${doc.data().email})`,
      }));
    },
    enabled: open,
  });

  const handleAssign = async () => {
    if (!selectedUid) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // 2. Call the Cloud Function to perform the atomic assignment
      await callFunction("adminAssignUserToRole", {
        roleDocId: roleId,
        targetUid: selectedUid,
      });
      recordEvent("role_assigned", {
        role_id: roleId,
        assigned_by: userProfile?.uid,
      });
      onSuccess();
      onClose();
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
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search Users"
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
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleAssign}
          disabled={!selectedUid || isSubmitting}
        >
          {isSubmitting ? <CircularProgress size={24} /> : "Confirm Assignment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
