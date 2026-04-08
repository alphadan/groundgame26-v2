// src/app/admin/engagement/PointAdjustmentDialog.tsx
import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from "@mui/material";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../../../lib/firebase";

export default function PointAdjustmentDialog({
  open,
  userId,
  mode,
  onClose,
}: any) {
  const [amount, setAmount] = useState<number>(0);

  const handleUpdate = async () => {
    // 1. Validate userId exists
    if (!userId) return;

    // 2. Take the Absolute Value to strip any minus signs the user typed
    const cleanAmount = Math.abs(amount);

    // 3. Prevent zero-value updates
    if (cleanAmount === 0) return;

    const userRef = doc(db, "users", userId);

    // 4. Determine the direction based on the mode prop
    const change = mode === "add" ? cleanAmount : -cleanAmount;

    try {
      await updateDoc(userRef, {
        points_balance: increment(change),
        last_points_update: Date.now(),
      });

      setAmount(0);
      onClose();
    } catch (err) {
      console.error("❌ Failed to adjust points:", err);
      // You could set an error state here to show in the Dialog UI
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{mode === "add" ? "Add" : "Deduct"} Points</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Point Amount"
          type="number"
          fullWidth
          variant="standard"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleUpdate}
          variant="contained"
          color={mode === "add" ? "success" : "error"}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}
