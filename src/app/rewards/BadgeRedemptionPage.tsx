// src/app/settings/BadgeRedemptionCenter.tsx
// You can place this as a separate page or as a tab/section in SettingsPage

import React, { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  useTheme,
  useMediaQuery,
  LinearProgress,
  MenuItem,
} from "@mui/material";
import {
  Phone,
  Message,
  AddComment,
  Download as DownloadIcon,
  EmojiEvents as Trophy,
  CardGiftcard as Redeem,
  LocalShipping,
} from "@mui/icons-material";

// Mock earned badges – replace with real data from your badge system
const earnedBadges = [
  { id: 1, name: "100 Doors Knocked", icon: "🏆", points: 100, redeemed: true },
  {
    id: 2,
    name: "Mail Ballot Master",
    icon: "📬",
    points: 150,
    redeemed: false,
  },
  { id: 3, name: "Top Recruiter", icon: "🎯", points: 200, redeemed: false },
  {
    id: 4,
    name: "Platinum Committeeperson",
    icon: "💎",
    points: 500,
    redeemed: false,
  },
];

// Available rewards catalog
const rewardsCatalog = [
  {
    id: 1,
    title: "GroundGame26 Elite T-Shirt (2026)",
    description: "Premium cotton tee with exclusive design",
    pointsRequired: 200,
    sizes: ["S", "M", "L", "XL", "XXL"],
    image: "/images/rewards/tshirt-2026.jpg", // placeholder
  },
  {
    id: 2,
    title: "Insulated GOP Tumbler",
    description: "30oz stainless steel with elephant logo",
    pointsRequired: 150,
    image: "/images/rewards/tumbler.jpg",
  },
  {
    id: 3,
    title: "Early Election Night Results Access",
    description: "Private results feed 30 minutes before public release",
    pointsRequired: 300,
    digital: true,
  },
  {
    id: 4,
    title: "Personal Thank-You Call from County Chair",
    description: "5-minute call to recognize your contribution",
    pointsRequired: 400,
    digital: true,
  },
];

export default function BadgeRedemptionCenter() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const totalPoints = earnedBadges.reduce((sum, b) => sum + b.points, 0);
  const redeemedPoints = earnedBadges
    .filter((b) => b.redeemed)
    .reduce((sum, b) => sum + b.points, 0);
  const availablePoints = totalPoints - redeemedPoints;

  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [redeemError, setRedeemError] = useState("");

  const handleRedeem = () => {
    if (!selectedReward) return;

    if (selectedReward.digital) {
      // Digital reward – instant
      setRedeemSuccess(true);
      setRedeemError("");
    } else if (availablePoints < selectedReward.pointsRequired) {
      setRedeemError("Not enough points");
    } else if (!selectedSize || !shippingAddress.trim()) {
      setRedeemError("Please select size and enter shipping address");
    } else {
      // Physical reward – simulate success
      setRedeemSuccess(true);
      setRedeemError("");
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        Badge Redemption Center
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom mb={4}>
        Redeem your earned badges for exclusive rewards and recognition
      </Typography>

      {/* Points Summary */}
      <Paper sx={{ p: 4, mb: 5, borderRadius: 3, bgcolor: "primary.50" }}>
        <Stack
          direction={isMobile ? "column" : "row"}
          spacing={4}
          alignItems="center"
        >
          <Box textAlign="center">
            <Typography variant="h3" fontWeight="bold" color="primary">
              {availablePoints}
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Available Points
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1, width: "100%" }}>
            <Typography variant="body2" gutterBottom>
              Progress to Platinum (500 points)
            </Typography>
            <LinearProgress
              variant="determinate"
              value={(totalPoints / 500) * 100}
              sx={{
                height: 20,
                borderRadius: 10,
                bgcolor: "grey.300",
                "& .MuiLinearProgress-bar": {
                  bgcolor: totalPoints >= 500 ? "success.main" : "primary.main",
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              {totalPoints} / 500 points earned
            </Typography>
          </Box>
        </Stack>

        {/* Earned Badges */}
        <Stack
          direction="row"
          spacing={2}
          mt={4}
          flexWrap="wrap"
          justifyContent="center"
        >
          {earnedBadges.map((badge) => (
            <Chip
              key={badge.id}
              icon={
                <Typography sx={{ fontSize: "1.5rem" }}>
                  {badge.icon}
                </Typography>
              }
              label={badge.name}
              color={badge.redeemed ? "default" : "primary"}
              variant={badge.redeemed ? "outlined" : "filled"}
              sx={{ fontWeight: "bold", mb: 1 }}
            />
          ))}
        </Stack>
      </Paper>

      {/* Rewards Catalog */}
      <Typography variant="h5" gutterBottom fontWeight="bold" mb={3}>
        Available Rewards
      </Typography>

      <Grid container spacing={4}>
        {rewardsCatalog.map((reward) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={reward.id}>
            <Card
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                borderRadius: 3,
                boxShadow: 4,
                transition: "0.2s",
                "&:hover": { transform: "translateY(-4px)", boxShadow: 8 },
              }}
            >
              <Box
                sx={{
                  height: 200,
                  bgcolor: "grey.200",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "12px 12px 0 0",
                }}
              >
                <Redeem sx={{ fontSize: 80, color: "grey.500" }} />
              </Box>

              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {reward.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {reward.description}
                </Typography>

                <Stack direction="row" spacing={1} alignItems="center">
                  <Trophy color="primary" />
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    {reward.pointsRequired} points
                  </Typography>
                </Stack>

                {reward.digital && (
                  <Chip
                    label="Digital Reward"
                    color="success"
                    size="small"
                    sx={{ mt: 2 }}
                  />
                )}
              </CardContent>

              <CardActions sx={{ mt: "auto", p: 2 }}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={() => setSelectedReward(reward)}
                  disabled={availablePoints < reward.pointsRequired}
                  sx={{ fontWeight: "bold" }}
                >
                  {availablePoints < reward.pointsRequired
                    ? `Need ${
                        reward.pointsRequired - availablePoints
                      } more points`
                    : "Redeem Now"}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Redemption Dialog */}
      <Dialog
        open={!!selectedReward}
        onClose={() => setSelectedReward(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Redeem: {selectedReward?.title}</DialogTitle>
        <DialogContent>
          {redeemSuccess ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              {selectedReward?.digital
                ? "Reward unlocked! Check your email for access details."
                : "Reward requested! We'll ship it within 7-10 business days."}
            </Alert>
          ) : (
            <>
              <Typography variant="body1" gutterBottom>
                Cost: <strong>{selectedReward?.pointsRequired} points</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                You have {availablePoints} points available
              </Typography>

              {!selectedReward?.digital && (
                <>
                  <TextField
                    select
                    fullWidth
                    label="Size"
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                    sx={{ mt: 2 }}
                  >
                    {selectedReward?.sizes.map((size: string) => (
                      <MenuItem key={size} value={size}>
                        {size}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    fullWidth
                    label="Shipping Address"
                    multiline
                    rows={3}
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    sx={{ mt: 3 }}
                  />
                </>
              )}

              {redeemError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {redeemError}
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setSelectedReward(null);
              setRedeemSuccess(false);
              setSelectedSize("");
              setShippingAddress("");
            }}
          >
            Close
          </Button>
          {!redeemSuccess && !selectedReward?.digital && (
            <Button
              onClick={handleRedeem}
              variant="contained"
              color="primary"
              disabled={!selectedSize || !shippingAddress.trim()}
            >
              Confirm Redemption
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
