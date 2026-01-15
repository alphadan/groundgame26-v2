import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Button,
  CircularProgress,
  Typography,
  Box,
} from "@mui/material";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { awardBadgeToUser } from "../../../services/badgeService";
import { ibadge } from "../../../types";

interface AwardBadgeDialogProps {
  open: boolean;
  onClose: () => void;
  selectedBadge: ibadge | null;
  onSuccess: () => void;
}

export default function AwardBadgeDialog({
  open,
  onClose,
  selectedBadge,
  onSuccess,
}: AwardBadgeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const searchUsers = async () => {
      if (inputValue.length < 2) {
        setOptions([]);
        return;
      }

      setLoading(true);
      try {
        // Handle Case Sensitivity for Firestore
        const capitalized =
          inputValue.charAt(0).toUpperCase() + inputValue.slice(1);

        // UPDATED: Field name changed to display_name
        const q = query(
          collection(db, "users"),
          where("display_name", ">=", capitalized),
          where("display_name", "<=", capitalized + "\uf8ff"),
          limit(10)
        );

        const snap = await getDocs(q);
        const userList = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOptions(userList);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 500);
    return () => clearTimeout(timeoutId);
  }, [inputValue]);

  const handleAward = async () => {
    if (!selectedUser || !selectedBadge) return;
    setLoading(true);
    try {
      await awardBadgeToUser(selectedUser, selectedBadge);
      onSuccess();
      onClose();
      setSelectedUser(null);
      setInputValue("");
    } catch (err) {
      console.error("Award failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Award Badge</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Awarding:{" "}
            <strong>
              {selectedBadge?.unicode} {selectedBadge?.title}
            </strong>
          </Typography>
        </Box>

        <Autocomplete
          autoHighlight
          blurOnSelect
          handleHomeEndKeys
          isOptionEqualToValue={(option, value) => option.id === value.id}
          options={options}
          loading={loading}
          // UPDATED: Mapped to display_name
          getOptionLabel={(option) => option.display_name || option.email || ""}
          filterOptions={(x) => x} // Critical for server-side search
          onInputChange={(_, newInputValue) => {
            setInputValue(newInputValue);
          }}
          onChange={(_, newValue) => {
            setSelectedUser(newValue);
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search Volunteers"
              variant="outlined"
              placeholder="Start typing name..."
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <React.Fragment>
                    {loading ? (
                      <CircularProgress color="inherit" size={20} />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </React.Fragment>
                ),
              }}
            />
          )}
          renderOption={(props, option) => {
            const { key, ...optionProps } = props;
            return (
              <li key={option.id} {...optionProps}>
                <Box>
                  <Typography variant="body2">{option.display_name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.email}
                  </Typography>
                </Box>
              </li>
            );
          }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleAward}
          variant="contained"
          disabled={!selectedUser || loading}
        >
          {loading ? "Saving..." : "Confirm Award"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
