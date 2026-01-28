import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  IconButton,
  Divider,
  Breadcrumbs,
  Link,
  Paper,
  Stack,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import RewardsCatalogGrid from "./RewardsCatalogGrid";
import UserPointsManagementGrid from "./UserPointsManagementGrid";

export default function RewardsManagement() {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Section 1: Rewards Inventory */}
      <Box sx={{ mb: 6 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <EmojiEventsIcon color="primary" />
          <Typography variant="h5" fontWeight="bold">
            Rewards Catalog
          </Typography>
        </Stack>
          <RewardsCatalogGrid />
      </Box>

      <Divider sx={{ mb: 6 }} />

      {/* Section 2: Volunteer Points */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
          Volunteer Point Management
        </Typography>
          <UserPointsManagementGrid />
      </Box>
    </Box>
  );
}
