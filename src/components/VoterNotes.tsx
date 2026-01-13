// src/components/VoterNotes.tsx
import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Stack,
  Divider,
  Alert,
  Chip,
} from "@mui/material";
import { Comment } from "@mui/icons-material";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
import { VoterNotesProps, VoterNote } from "../types";

const getVoterNotes = httpsCallable(functions, "getVoterNotes");
const addVoterNote = httpsCallable(functions, "addVoterNote");

export const VoterNotes: React.FC<VoterNotesProps> = ({
  voterId,
  fullName,
  address,
}) => {
  const [open, setOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [notes, setNotes] = useState<VoterNote[]>([]);
  const [noteCount, setNoteCount] = useState(0); // For badge on icon
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  // Fetch note count on mount (lightweight)
  useEffect(() => {
    if (!voterId) {
      setNoteCount(0);
      return;
    }

    const fetchCount = async () => {
      try {
        const result = await getVoterNotes({ voterIds: [voterId] });
        const fetchedNotes = (result.data as any).notes || [];
        setNoteCount(fetchedNotes.length);
      } catch (err) {
        console.error("Failed to fetch note count:", err);
        setNoteCount(0);
      }
    };

    fetchCount();
  }, [voterId]);

  // Fetch full notes when dialog opens
  useEffect(() => {
    if (!open || !voterId) {
      setNotes([]);
      return;
    }

    const fetchNotes = async () => {
      setLoadingNotes(true);
      setNotesError(null);

      try {
        const result = await getVoterNotes({ voterIds: [voterId] });
        const fetchedNotes = (result.data as any).notes || [];
        setNotes(fetchedNotes);
      } catch (err: any) {
        console.error("Failed to load notes:", err);
        setNotesError("Failed to load notes");
        setNotes([]);
      } finally {
        setLoadingNotes(false);
      }
    };

    fetchNotes();
  }, [open, voterId]);

  const handleSave = async () => {
    if (!noteText.trim() || !voterId) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      await addVoterNote({
        voter_id: voterId,
        full_name: fullName,
        address: address,
        note: noteText.trim(),
      });

      setNoteText("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Refresh both count and full notes
      const result = await getVoterNotes({ voterIds: [voterId] });
      const fetchedNotes = (result.data as any).notes || [];
      setNotes(fetchedNotes);
      setNoteCount(fetchedNotes.length);
    } catch (err) {
      console.error("Failed to save note:", err);
      alert("Failed to save note — please try again");
    } finally {
      setSaving(false);
    }
  };

  // Robust date formatting
  const formatDate = (created_at: any): string => {
    if (!created_at) return "Unknown date";

    if (typeof created_at === "object" && created_at._seconds != null) {
      const date = new Date(
        created_at._seconds * 1000 + created_at._nanoseconds / 1000000
      );
      return date.toLocaleString();
    }

    const date = new Date(created_at);
    if (isNaN(date.getTime())) return "Unknown date";

    return date.toLocaleString();
  };

  return (
    <>
      {/* Trigger Button with Count Badge */}
      <IconButton color="primary" onClick={() => setOpen(true)} size="small">
        <Comment />
        {noteCount > 0 && (
          <Chip
            label={noteCount}
            size="small"
            color="info"
            sx={{
              ml: 0.5,
              height: 18,
              fontSize: 10,
              fontWeight: "bold",
            }}
          />
        )}
      </IconButton>

      {/* Notes Dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight="bold">
            Notes for {fullName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {address}
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={3}>
            {loadingNotes ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <CircularProgress size={32} />
                <Typography variant="body2" color="text.secondary" mt={2}>
                  Loading notes...
                </Typography>
              </Box>
            ) : notesError ? (
              <Alert severity="error">{notesError}</Alert>
            ) : notes.length > 0 ? (
              <List>
                {notes.map((note, index) => (
                  <React.Fragment key={note.id}>
                    <ListItem alignItems="flex-start">
                      <ListItemText
                        primary={
                          <Typography variant="body1">{note.note}</Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {note.created_by_name || "Unknown"} •{" "}
                            {formatDate(note.created_at)}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < notes.length - 1 && (
                      <Divider variant="inset" component="li" />
                    )}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography
                variant="body1"
                color="text.secondary"
                textAlign="center"
                py={4}
              >
                No notes yet — be the first to add one!
              </Typography>
            )}

            <Divider />

            <Box>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Add New Note
              </Typography>
              <TextField
                multiline
                rows={4}
                fullWidth
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="e.g. Strong supporter • Requested yard sign • Prefers evening visits"
                variant="outlined"
                disabled={saving}
              />

              {saveSuccess && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Note saved successfully!
                </Alert>
              )}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={saving || !noteText.trim()}
            startIcon={
              saving ? <CircularProgress size={20} color="inherit" /> : null
            }
          >
            {saving ? "Saving..." : "Save Note"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
