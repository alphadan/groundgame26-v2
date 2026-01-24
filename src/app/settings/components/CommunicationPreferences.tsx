import React, { useState } from "react";
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
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

interface Props {
  userProfile: any;
  claims: any;
  uid: string;
}

const OPT_IN_TOPICS = [
  {
    id: "pref_urgent_gotv",
    label: "Urgent GOTV Alerts",
    desc: "Critical election day updates and reminders",
  },
  {
    id: "pref_social_events",
    label: "Social Events",
    desc: "Meetups, town halls, and community gatherings",
  },
  {
    id: "pref_training_tips",
    label: "Daily Training Tips",
    desc: "Quick daily tips to improve your canvassing skills",
  },
];

export const CommunicationPreferences: React.FC<Props> = ({
  userProfile,
  claims,
  uid,
}) => {
  const [loadingTopic, setLoadingTopic] = useState<string | null>(null);

  const handleToggle = async (topicId: string, isSubscribing: boolean) => {
    if (!uid) return;
    setLoadingTopic(topicId);

    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        [`notification_preferences.${topicId}`]: isSubscribing,
        [`notification_preferences.last_updated`]: new Date().toISOString(),
      });
      // Note: A Cloud Function should listen to this change to sync with FCM topics
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
              onDelete={() => {}} // Disables the chip's clickability
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
          <List disablePadding>
            {OPT_IN_TOPICS.map((topic) => (
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
                      onChange={(e) => handleToggle(topic.id, e.target.checked)}
                    />
                  )
                }
              >
                <ListItemText
                  primary={topic.label}
                  secondary={topic.desc}
                  primaryTypographyProps={{ fontWeight: "medium" }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Stack>
    </Paper>
  );
};
