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
  useTheme,
} from "@mui/material";
import {
  Message,
  LockReset,
  InfoOutlined,
  NotificationsActiveOutlined,
} from "@mui/icons-material";
import {
  doc,
  updateDoc,
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
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
  const theme = useTheme();
  const [loadingTopic, setLoadingTopic] = useState<string | null>(null);
  const [dynamicTopics, setDynamicTopics] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  // 1. Fetch active topics dynamically
  useEffect(() => {
    const q = query(
      collection(db, "notification_topics"),
      where("active", "==", true),
      where("type", "==", "interest"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const topics = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setDynamicTopics(topics);
        setFetching(false);
      },
      (err) => {
        console.error("Firestore Topic Subscription Error:", err);
        setFetching(false);
      },
    );

    return unsub;
  }, []);

  // 2. Optimized Toggle Handler
  const handleToggle = async (topicId: string, isSubscribing: boolean) => {
    if (!uid) return;
    setLoadingTopic(topicId);

    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        [`notification_preferences.${topicId}`]: isSubscribing,
        [`notification_preferences.last_updated`]: Date.now(),
      });
    } catch (error) {
      console.error("Failed to update notification preference:", error);
    } finally {
      setLoadingTopic(null);
    }
  };

  return (
    <Paper elevation={0} variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <Message color="primary" />
        <Typography variant="h6" fontWeight="bold">
          Communication Preferences
        </Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={3}>
        Control your notification settings and audience subscriptions.
      </Typography>

      <Stack spacing={3}>
        {/* SECTION 1: SYSTEM ROLES (Static) */}
        <Box>
          <Typography
            variant="subtitle2"
            fontWeight="bold"
            color="text.secondary"
            gutterBottom
            sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
          >
            System Audiences
            <Tooltip title="Managed by administrators based on your account rank.">
              <InfoOutlined sx={{ fontSize: 14, cursor: "help" }} />
            </Tooltip>
          </Typography>
          <Stack direction="row" spacing={1} mt={1}>
            <Chip
              label={
                claims?.role?.replace("_", " ").toUpperCase() || "VOLUNTEER"
              }
              color="primary"
              variant="filled"
              size="small"
              icon={
                <NotificationsActiveOutlined style={{ color: "inherit" }} />
              }
              sx={{ fontWeight: "bold", px: 1 }}
            />
          </Stack>
        </Box>

        <Divider />

        {/* SECTION 2: OPT-IN TOPICS (Scrollable Box) */}
        <Box>
          <Typography
            variant="subtitle2"
            fontWeight="bold"
            color="text.secondary"
            gutterBottom
          >
            Interest Topics
          </Typography>

          {fetching ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <CircularProgress size={24} />
            </Box>
          ) : dynamicTopics.length === 0 ? (
            <Box
              sx={{
                py: 3,
                textAlign: "center",
                bgcolor: "action.hover",
                borderRadius: 2,
              }}
            >
              <Typography variant="caption" color="text.disabled">
                No active interest topics found.
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                maxHeight: 300,
                overflowY: "auto",
                pr: 1, // Gutter for the scrollbar
                mt: 1,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                bgcolor:
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(0,0,0,0.02)",
                // Custom Slim Scrollbar
                "&::-webkit-scrollbar": { width: "6px" },
                "&::-webkit-scrollbar-track": { background: "transparent" },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: theme.palette.divider,
                  borderRadius: "10px",
                },
              }}
            >
              <List disablePadding>
                {dynamicTopics.map((topic, index) => (
                  <ListItem
                    key={topic.id}
                    divider={index !== dynamicTopics.length - 1}
                    sx={{ py: 1.5, px: 2 }}
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
                      primaryTypographyProps={{
                        variant: "body2",
                        fontWeight: "bold",
                        color: "text.primary",
                      }}
                      secondaryTypographyProps={{
                        variant: "caption",
                        sx: { display: "block", mt: 0.5, lineHeight: 1.2 },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Box>
      </Stack>
    </Paper>
  );
};
