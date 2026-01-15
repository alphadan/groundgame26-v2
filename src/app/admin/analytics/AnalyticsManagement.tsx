// src/app/admin/analytics/AnalyticsDashboard.tsx
import React, { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Skeleton,
  CircularProgress,
  Fade,
  Tooltip,
  Stack,
  Button,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate } from "react-router-dom";

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const { userProfile, isLoading: authLoading } = useAuth();

  // 1. State to track when the actual Looker content has arrived
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(Date.now()); // Start with a timestamp

  const handleRefresh = () => {
    setIframeLoaded(false); // Reset loading state
    setRefreshKey(Date.now()); // Incrementing key forces re-mount
  };

  const baseId = "5692f89d-a550-478b-b267-667afd91353d";
  const pageId = "p_ev5o6t54bd";

  const encodedParams = encodeURIComponent(
    JSON.stringify({
      "ds0.user_county": userProfile?.county_id || "All",
    })
  );

  const LOOKER_REPORT_URL = `https://lookerstudio.google.com/embed/reporting/${baseId}/page/${pageId}?params=${encodedParams}&cache_buster=${refreshKey}`;

  return (
    <Box
      sx={{ p: 4, height: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <IconButton
          onClick={() => navigate("/admin")}
          color="primary"
          sx={{ mr: 2 }}
        >
          <ArrowBackIcon fontSize="large" />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Campaign Intelligence
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {authLoading
              ? "Synchronizing credentials..."
              : "Real-time field performance"}
          </Typography>
        </Box>
      </Box>

      {/* STYLED REFRESH BUTTON */}
      <Tooltip title="Reload Dashboard Data">
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={!iframeLoaded}
          sx={{
            // 1. Prevent Full Width
            minWidth: "140px",
            maxWidth: "240px",
            height: "42px",
            mb: 4,

            // 2. Branding & Shape
            borderRadius: "12px", // Modern, slightly rounded
            textTransform: "none", // More professional "App" feel
            fontWeight: 600,
            borderWidth: "2px", // Thicker border for better visibility

            // 3. Colors & States
            borderColor: "primary.main",
            color: "primary.main",
            "&:hover": {
              borderWidth: "2px",
              backgroundColor: "rgba(25, 118, 210, 0.04)", // Light primary tint
              borderColor: "primary.dark",
            },

            // 4. Responsive (optional)
            display: { xs: "none", sm: "inline-flex" }, // Hide on tiny mobile screens
          }}
        >
          Refresh Data
        </Button>
      </Tooltip>

      {/* 2. Container for the Dashboard */}
      <Paper
        elevation={3}
        sx={{
          flexGrow: 1,
          borderRadius: 4,
          position: "relative", // Needed to layer the skeleton over the iframe
          overflow: "hidden",
          bgcolor: "grey.50",
        }}
      >
        {/* SKELETON LAYER: Only shows until iframeLoaded is true */}
        {!iframeLoaded && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              p: 2,
              zIndex: 1,
            }}
          >
            <Stack spacing={2} sx={{ height: "100%" }}>
              <Box sx={{ display: "flex", gap: 2 }}>
                <Skeleton
                  variant="rectangular"
                  width="30%"
                  height={100}
                  sx={{ borderRadius: 2 }}
                />
                <Skeleton
                  variant="rectangular"
                  width="30%"
                  height={100}
                  sx={{ borderRadius: 2 }}
                />
                <Skeleton
                  variant="rectangular"
                  width="40%"
                  height={100}
                  sx={{ borderRadius: 2 }}
                />
              </Box>
              <Skeleton
                variant="rectangular"
                width="100%"
                sx={{ flexGrow: 1, borderRadius: 2 }}
              />
              <Box
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  textAlign: "center",
                }}
              >
                <CircularProgress size={60} />
                <Typography
                  sx={{ mt: 2, fontWeight: "bold", color: "text.secondary" }}
                >
                  Connecting to Data Stream...
                </Typography>
              </Box>
            </Stack>
          </Box>
        )}

        {/* IFRAME LAYER: Always present but hidden via Fade until loaded */}
        <Fade in={iframeLoaded} timeout={800}>
          <iframe
            title="Campaign Analytics"
            width="100%"
            height="100%"
            src={LOOKER_REPORT_URL}
            frameBorder="0"
            style={{ border: 0 }}
            onLoad={() => setIframeLoaded(true)} // 3. The magic event
            allowFullScreen
            sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          />
        </Fade>
      </Paper>
    </Box>
  );
}
