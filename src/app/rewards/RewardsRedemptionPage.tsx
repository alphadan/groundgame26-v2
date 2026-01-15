import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
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
  LinearProgress,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import {
  EmojiEvents as Trophy,
  CardGiftcard as Redeem,
} from "@mui/icons-material";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { redeemReward, getAllRewards } from "../../services/rewardsService";
import { ireward } from "../../types";

export default function RewardsRedemptionCenter() {
  const { user } = useAuth();

  // State
  const [rewardsCatalog, setRewardsCatalog] = useState<ireward[]>([]);
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [selectedReward, setSelectedReward] = useState<ireward | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [redeemError, setRedeemError] = useState("");

  // 1. One-time fetch for User Points and Rewards Catalog
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user?.uid) return;
      setLoading(true);
      try {
        // Fetch User Points
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          setTotalPoints(userSnap.data().points_balance || 0);
        }

        // Fetch Rewards
        const data = await getAllRewards();
        setRewardsCatalog(data.filter((r) => r.status === "active"));
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user?.uid]);

  const handleConfirmRedeem = async () => {
    if (!user || !selectedReward) return;

    setIsSubmitting(true);
    setRedeemError("");

    try {
      const result = await redeemReward(user.uid, selectedReward);

      if (result.success) {
        // 2. Manually update local state so the UI reflects the new balance
        setTotalPoints((prev) => prev - selectedReward.points_cost);
        setRedeemSuccess(true);
      } else {
        setRedeemError((result.error as string) || "Redemption failed.");
      }
    } catch (err: any) {
      setRedeemError(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading)
    return (
      <Box sx={{ p: 5, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">
        Rewards Redemption Center
      </Typography>

      {/* Points Summary */}
      <Paper sx={{ p: 4, mb: 5, borderRadius: 3, bgcolor: "primary.50" }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={4}
          alignItems="center"
        >
          <Box textAlign="center">
            <Typography variant="h3" fontWeight="bold" color="primary">
              {totalPoints}
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Available Points
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1, width: "100%" }}>
            <Typography variant="body2" gutterBottom>
              Progress to Platinum (500 pts)
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min((totalPoints / 500) * 100, 100)}
              sx={{ height: 16, borderRadius: 8 }}
            />
          </Box>
        </Stack>
      </Paper>

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
                    {reward.points_cost} points
                  </Typography>
                </Stack>

                {reward.category && (
                  <Chip
                    label={reward.category}
                    color="success"
                    size="small"
                    sx={{ mt: 6, mb: 2 }}
                  />
                )}
              </CardContent>

              <CardActions sx={{ p: 2 }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => setSelectedReward(reward)}
                  disabled={totalPoints < reward.points_cost}
                >
                  {totalPoints < reward.points_cost
                    ? "Insufficient Points"
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
        onClose={() => !isSubmitting && setSelectedReward(null)}
      >
        <DialogTitle>Confirm Redemption</DialogTitle>
        <DialogContent>
          {redeemSuccess ? (
            <Alert severity="success">Redemption successful!</Alert>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography>Redeeming: {selectedReward?.title}</Typography>
              {!selectedReward?.is_digital && (
                <TextField
                  fullWidth
                  label="Shipping Address"
                  multiline
                  rows={3}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                />
              )}
              {redeemError && <Alert severity="error">{redeemError}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setSelectedReward(null);
              setRedeemSuccess(false);
            }}
            disabled={isSubmitting}
          >
            {redeemSuccess ? "Close" : "Cancel"}
          </Button>
          {!redeemSuccess && (
            <Button
              variant="contained"
              onClick={handleConfirmRedeem}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Processing..." : "Confirm"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
