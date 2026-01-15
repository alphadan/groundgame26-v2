// src/app/admin/engagement/EngagementCenterPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Stack,
  IconButton,
} from "@mui/material";
import RewardsManagement from "./RewardsManagement";
import BadgeManagementPage from "./BadgeManagementPage";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export default function EngagementCenterPage() {
  const navigate = useNavigate();
  const [tabIndex, setTabIndex] = useState(0);

  return (
    <Box sx={{ p: 4 }}>
      {/* Header Section */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <IconButton
          onClick={() => navigate(-1)}
          sx={{ bgcolor: "background.paper", boxShadow: 1 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Engagement Center
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gamification, rewards, and achievement systems for field organizers.
          </Typography>
        </Box>
      </Stack>

      <Tabs
        value={tabIndex}
        onChange={(_, newValue) => setTabIndex(newValue)}
        sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}
      >
        <Tab
          icon={<CardGiftcardIcon />}
          label="Rewards & Redemptions"
          iconPosition="start"
        />
        <Tab
          icon={<EmojiEventsIcon />}
          label="Badges & Achievements"
          iconPosition="start"
        />
      </Tabs>

      <Paper elevation={0} sx={{ p: 2, bgcolor: "background.default" }}>
        {tabIndex === 0 && <RewardsManagement />}
        {tabIndex === 1 && <BadgeManagementPage />}
      </Paper>
    </Box>
  );
}
