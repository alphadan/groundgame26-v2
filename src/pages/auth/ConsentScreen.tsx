// src/pages/auth/ConsentScreen.tsx
import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  Container,
  Tabs,
  Tab,
  Divider,
  Alert,
  AlertTitle,
  Stack,
} from "@mui/material";
import { doc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import Logo from "../../components/ui/Logo";

const CURRENT_LEGAL_VERSION = "2026.01.14";

export default function ConsentScreen() {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAgree = async () => {
    if (!user?.uid || !agreed) return;
    setLoading(true);

    try {
      const userRef = doc(db, "users", user.uid);

      // Audit Trail Data
      await updateDoc(userRef, {
        has_agreed_to_terms: true,
        terms_agreed_at: Date.now(), // Stored as a Number (ms)
        legal_consent: {
          version: "2026.01.14",
          agreed_at_ms: Date.now(),
          user_agent: navigator.userAgent,
          ip_verified: true, // Optional: placeholder for server-side IP logging
        },
      });
      // The AuthContext listener will automatically pivot the user to the Dashboard
    } catch (err) {
      console.error("Consent Error:", err);
      setLoading(true);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: "background.default",
        minHeight: "100vh",
        py: { xs: 2, md: 6 },
      }}
    >
      <Container maxWidth="md">
        <Paper elevation={3} sx={{ p: { xs: 3, md: 5 }, borderRadius: 4 }}>
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Logo width={160} />
          </Box>

          <Typography
            variant="h4"
            fontWeight="800"
            gutterBottom
            textAlign="center"
          >
            Legal & Compliance
          </Typography>
          <Typography
            variant="subtitle1"
            color="text.secondary"
            textAlign="center"
            sx={{ mb: 3 }}
          >
            Last Updated: January 14, 2026 (v{CURRENT_LEGAL_VERSION})
          </Typography>

          {/* CARRIER SUSPENSION WARNING */}
          <Alert
            severity="error"
            variant="outlined"
            sx={{ mb: 3, borderColor: "error.main" }}
          >
            <AlertTitle sx={{ fontWeight: "bold" }}>
              SMS Messaging Warning
            </AlertTitle>
            <Typography variant="body2">
              <strong>Carrier Suspension:</strong> Sending more than 10 messages
              per hour can cause providers (Verizon/T-Mobile) to flag your
              number as automated spam. This may lead to{" "}
              <strong>Account Lockdown</strong> or permanent suspension of your
              SMS abilities. Please pace your outreach manually.
            </Typography>
          </Alert>

          <Paper elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs
              value={tabValue}
              onChange={(_, v) => setTabValue(v)}
              variant="fullWidth"
            >
              <Tab label="Privacy Policy" sx={{ fontWeight: "bold" }} />
              <Tab label="Data Usage" sx={{ fontWeight: "bold" }} />
            </Tabs>
          </Paper>

          {/* MOBILE FRIENDLY SCROLL BOX */}
          <Box
            sx={{
              mt: 2,
              p: 2,
              height: "300px",
              overflowY: "auto",
              bgcolor: "action.hover",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              // Smooth scrolling for iOS
              WebkitOverflowScrolling: "touch",
            }}
          >
            {tabValue === 0 && (
              <Box>
                <Typography variant="h6" gutterBottom fontWeight="700">
                  1. Data Collection & Privacy
                </Typography>
                <Typography variant="body2" paragraph>
                  Ground Game 26 collects PII such as name, email, and phone
                  number to manage your account.
                </Typography>
                <Typography variant="h6" gutterBottom fontWeight="700">
                  2. Voter Data Sources
                </Typography>
                <Typography variant="body2" paragraph>
                  Voter lists are sourced from official government records. We
                  do not sell this data.
                </Typography>
              </Box>
            )}

            {tabValue === 1 && (
              <Box>
                <Typography variant="h6" gutterBottom fontWeight="700">
                  Acceptable Use Policy
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Non-Commercial Use:</strong> You may not use voter
                  data for personal or non-campaign purposes.
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Accountability:</strong> Every action—including
                  searches and profile edits—is logged with a timestamp and your
                  unique ID for security auditing.
                </Typography>
              </Box>
            )}
          </Box>

          <Divider sx={{ my: 4 }} />

          <Box sx={{ mb: 4 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Typography variant="body1" fontWeight="600">
                  "I understand that voter data is sensitive and I agree to use
                  this application solely for authorized campaign activities."
                </Typography>
              }
            />
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button
              variant="outlined"
              fullWidth
              size="large"
              onClick={() => signOut(auth)}
            >
              Logout (Disagree)
            </Button>
            <Button
              variant="contained"
              fullWidth
              size="large"
              disabled={!agreed || loading}
              onClick={handleAgree}
              sx={{ fontWeight: "bold" }}
            >
              {loading ? "Processing..." : "I Agree & Continue"}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
