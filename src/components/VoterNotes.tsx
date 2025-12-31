// src/components/VoterNotes.tsx
import React, { useState } from "react";
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
  ListItemAvatar,
  Avatar,
  CircularProgress,
  Stack,
  Divider,
  Alert,
  Chip,
} from "@mui/material";
import { Comment } from "@mui/icons-material";
import { useCollectionData } from "react-firebase-hooks/firestore";
import {
  collection,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

interface VoterNotesProps {
  voterId: string | null;
  fullName: string;
  address: string;
}

export const VoterNotes: React.FC<VoterNotesProps> = ({
  voterId,
  fullName,
  address,
}) => {
  const [open, setOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Properly typed query for notes
  const notesQuery = voterId
    ? query(
        collection(db, "voter_notes"),
        where("voter_id", "==", voterId),
        orderBy("created_at", "desc")
      )
    : null;

  const [notes, loadingNotes, error] = useCollectionData(notesQuery);

  const addVoterNote = httpsCallable(functions, "addVoterNote");

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
    } catch (err) {
      console.error("Failed to save note:", err);
      alert("Failed to save note — please try again");
    } finally {
      setSaving(false);
    }
  };

  const noteCount = notes?.length || 0;

  return (
    <>
      {/* Trigger Button */}
      <IconButton color="primary" onClick={() => setOpen(true)} size="small">
        <Comment />
        {noteCount > 0 && (
          <Chip
            label={noteCount}
            size="small"
            color="primary"
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
            {/* Loading / Error / Empty States */}
            {loadingNotes ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <CircularProgress size={32} />
                <Typography variant="body2" color="text.secondary" mt={2}>
                  Loading notes...
                </Typography>
              </Box>
            ) : error ? (
              <Alert severity="error">Failed to load notes</Alert>
            ) : notes && notes.length > 0 ? (
              <List>
                {notes.map((note: any, index: number) => {
                  const createdAt = note.created_at;
                  const dateStr = createdAt?.toDate?.()
                    ? createdAt.toDate().toLocaleString()
                    : createdAt instanceof Timestamp
                    ? createdAt.toDate().toLocaleString()
                    : "Unknown date";

                  return (
                    <React.Fragment key={index}>
                      <ListItem alignItems="flex-start">
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: "primary.main" }}>
                            {note.created_by_name?.[0]?.toUpperCase() || "?"}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="body1">{note.note}</Typography>
                          }
                          secondary={
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {note.created_by_name || "Unknown"} • {dateStr}
                            </Typography>
                          }
                        />
                      </ListItem>
                      {index < notes.length - 1 && (
                        <Divider variant="inset" component="li" />
                      )}
                    </React.Fragment>
                  );
                })}
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

            {/* New Note Input */}
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
