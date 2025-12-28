import React, { useState } from "react";
import {
  Box,
  Typography,
  Chip,
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
} from "@mui/material";
import { AddComment, Comment } from "@mui/icons-material";
import { useCollectionData } from "react-firebase-hooks/firestore";
import { collection, query, where, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

interface VoterNotesProps {
  voterId: string | null;
  fullName: string;
  address: string;
}

export const VoterNotes: React.FC<VoterNotesProps> = ({ voterId, fullName, address }) => {
  const [open, setOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  // Load existing notes for this voter
  const notesQuery = voterId
    ? query(
        collection(db, "voter_notes"),
        where("voter_id", "==", voterId),
        orderBy("created_at", "desc")
      )
    : null;

  const [notes, loadingNotes] = useCollectionData(notesQuery);

  const addVoterNote = httpsCallable(functions, "addVoterNote");

  const handleSave = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await addVoterNote({
        voter_id: voterId,
        full_name: fullName,
        address: address,
        note: noteText.trim(),
      });
      setNoteText("");
      setOpen(false);
    } catch (err) {
      alert("Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <IconButton color="primary" onClick={() => setOpen(true)} size="small">
        <Comment />
        {notes && notes.length > 0 && (
          <Chip
            label={notes.length}
            size="small"
            color="primary"
            sx={{ ml: 0.5, height: 18, fontSize: 10 }}
          />
        )}
      </IconButton>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Notes for {fullName}</DialogTitle>
        <DialogContent>
          {loadingNotes ? (
            <CircularProgress size={20} />
          ) : notes && notes.length > 0 ? (
            <List>
              {notes.map((note: any, i: number) => (
                <ListItem key={i}>
                  <ListItemAvatar>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {note.created_by_name?.[0] || "?"}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={note.note}
                    secondary={
                      <>
                        {note.created_by_name} •{" "}
                        {note.created_at?.toDate?.().toLocaleDateString() ||
                          new Date(note.created_at).toLocaleDateString()}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary">No notes yet</Typography>
          )}

          <TextField
            multiline
            rows={3}
            fullWidth
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a new note..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !noteText.trim()}
            variant="contained"
          >
            {saving ? "Saving..." : "Save Note"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};