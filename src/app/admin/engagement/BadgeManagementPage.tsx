// src/app/admin/engagement/BadgeManagementPage.tsx

import React from "react";
import { Box, Divider, Typography } from "@mui/material";
import BadgeCatalogGrid from "./BadgeCatalogGrid"; // The catalog we built earlier
import BadgeAchievementsByUser from "./BadgeAchievementsByUser"; // The new optimized log

export default function BadgeManagementPage() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* SECTION 1: MANAGE THE DEFINITIONS */}
      <Box>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Badge Catalog
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Create and edit the milestones users can achieve.
        </Typography>
        <BadgeCatalogGrid />
      </Box>

      <Divider />

      {/* SECTION 2: VIEW THE ACHIEVEMENTS (The Optimized Component) */}
      <Box>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          User Achievement Log
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A real-time, high-scale log of all badges earned across the
          organization.
        </Typography>
        <BadgeAchievementsByUser />
      </Box>
    </Box>
  );
}
