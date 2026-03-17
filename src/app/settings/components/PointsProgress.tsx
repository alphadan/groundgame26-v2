// src/app/settings/components/PointsProgress.tsx
import React from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  LinearProgress,
  Tooltip,
  Chip,
} from "@mui/material";
import { EmojiEvents, Stars, InfoOutlined } from "@mui/icons-material";

interface PointsProgressProps {
  userProfile: any;
}

export const PointsProgress: React.FC<PointsProgressProps> = ({
  userProfile,
}) => {
  const points = userProfile?.points_balance || 0;

  // Logic for Levels & Rewards
  const REWARD_THRESHOLD = 500;
  const progress = Math.min((points / REWARD_THRESHOLD) * 100, 100);

  // Simple Level Logic
  const getLevel = (pts: number) => {
    if (pts >= 1000) return { name: "Gold Advocate", color: "#FFD700" };
    if (pts >= 500) return { name: "Silver Solicitor", color: "#C0C0C0" };
    return { name: "Bronze Bell-Ringer", color: "#CD7F32" };
  };

  const level = getLevel(points);

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{ p: 3, borderRadius: 3, bgcolor: "background.paper" }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        mb={2}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <EmojiEvents sx={{ color: level.color }} />
          <Typography variant="h6" fontWeight="bold">
            Volunteer Rank
          </Typography>
        </Stack>
        <Chip
          label={level.name}
          size="small"
          sx={{ bgcolor: level.color, color: "#000", fontWeight: "bold" }}
        />
      </Stack>

      <Box sx={{ textAlign: "center", py: 2 }}>
        <Typography variant="h2" fontWeight="900" color="primary">
          {points.toLocaleString()}
        </Typography>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ letterSpacing: 2 }}
        >
          Lifetime Points
        </Typography>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Stack direction="row" justifyContent="space-between" mb={1}>
          <Typography variant="body2" color="text.secondary">
            Next Reward Goal
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {points} / {REWARD_THRESHOLD}
          </Typography>
        </Stack>

        <Tooltip
          title={`${REWARD_THRESHOLD - points} points until your next reward!`}
        >
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 10,
              borderRadius: 5,
              bgcolor: "action.hover",
              "& .MuiLinearProgress-bar": { borderRadius: 5 },
            }}
          />
        </Tooltip>
      </Box>

      <Stack
        direction="row"
        spacing={1}
        mt={2}
        alignItems="center"
        justifyContent="center"
      >
        <Stars sx={{ fontSize: 16, color: "text.disabled" }} />
        <Typography variant="caption" color="text.secondary">
          Points are awarded for doors knocked and data synced.
        </Typography>
      </Stack>
    </Paper>
  );
};
