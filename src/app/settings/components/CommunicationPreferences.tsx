import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Switch,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import { Message, LockReset, InfoOutlined } from "@mui/icons-material";
import { doc, updateDoc, collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";

interface Props {
  userProfile: any;
  claims: any;
  uid: string;
}

export const CommunicationPreferences: React.FC<Props> = ({
  userProfile,
  claims,
  uid,
}) => {
  const [loadingTopic, setLoadingTopic] = useState<string | null>(null);
  const [dynamicTopics, setDynamicTopics] = useState<any[]>([]);

  // 1. Fetch topics dynamically from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "notification_topics"), (snap) => {
      setDynamicTopics(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // 2. Updated Toggle Handler with Date.now()
  const handleToggle = async (topicId: string, isSubscribing: boolean) => {
    if (!uid) return;
    setLoadingTopic(topicId);

    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        [`notification_preferences.${topicId}`]: isSubscribing,
        // Changed from .toISOString() to Date.now() number
        [`notification_preferences.last_updated`]: Date.now(),
      });
    } catch (error) {
      console.error("Failed to update notification preference:", error);
    } finally {
      setLoadingTopic(null);
    }
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <Message color="primary" />
        <Typography variant="h6" fontWeight="bold">
          Communication Preferences
        </Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Choose which notification audiences you want to be part of.
      </Typography>

      <Stack spacing={3}>
        {/* SECTION: SYSTEM AUDIENCES */}
        <Box>
          <Typography
            variant="subtitle2"
            fontWeight="bold"
            color="text.secondary"
            gutterBottom
            sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
          >
            System Roles{" "}
            <Tooltip title="Managed by administrators based on your account status">
              <InfoOutlined sx={{ fontSize: 14 }} />
            </Tooltip>
          </Typography>
          <Stack direction="row" spacing={1} mt={1}>
            <Chip
              label={
                claims?.role?.replace("_", " ").toUpperCase() || "VOLUNTEER"
              }
              color="primary"
              variant="filled"
              deleteIcon={
                <LockReset style={{ color: "white", opacity: 0.8 }} />
              }
              onDelete={() => {}}
              sx={{ fontWeight: "bold" }}
            />
          </Stack>
        </Box>

        <Divider />

        {/* SECTION: OPT-IN TOPICS */}
        <Box>
          <Typography
            variant="subtitle2"
            fontWeight="bold"
            color="text.secondary"
            gutterBottom
          >
            Interest Topics
          </Typography>

          {dynamicTopics.length === 0 ? (
            <Box sx={{ py: 2, textAlign: "center" }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <List disablePadding>
              {dynamicTopics.map((topic) => (
                <ListItem
                  key={topic.id}
                  disableGutters
                  secondaryAction={
                    loadingTopic === topic.id ? (
                      <CircularProgress size={20} />
                    ) : (
                      <Switch
                        edge="end"
                        checked={
                          !!userProfile?.notification_preferences?.[topic.id]
                        }
                        onChange={(e) =>
                          handleToggle(topic.id, e.target.checked)
                        }
                      />
                    )
                  }
                >
                  <ListItemText
                    primary={topic.label}
                    secondary={topic.desc || topic.description}
                    primaryTypographyProps={{ fontWeight: "medium" }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Stack>
    </Paper>
  );
};
