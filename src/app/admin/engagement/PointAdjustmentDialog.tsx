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
    if (!userId || amount <= 0) return;

    const userRef = doc(db, "users", userId);
    const change = mode === "add" ? amount : -amount;

    await updateDoc(userRef, {
      points_balance: increment(change),
      last_points_update: Date.now(),
    });

    setAmount(0);
    onClose();
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
