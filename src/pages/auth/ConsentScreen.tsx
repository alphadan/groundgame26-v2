import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  Checkbox,
  Paper,
  Container,
  Divider,
  Alert,
  AlertTitle,
  Stack,
} from "@mui/material";
import { doc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { LEGAL_CONFIG } from "../../constants/legal";
import Logo from "../../components/ui/Logo";

// ICON IMPORTS BELONG HERE
import GavelIcon from "@mui/icons-material/Gavel";
import SecurityIcon from "@mui/icons-material/Security";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import TimerIcon from "@mui/icons-material/Timer";
import AppRegistrationIcon from "@mui/icons-material/AppRegistration";
import PhonelinkLockIcon from "@mui/icons-material/PhonelinkLock";

// The Mapper: Links the 'id' string from legal.ts to the actual MUI Component
const ICON_MAP: Record<string, React.ElementType> = {
  privacy: VerifiedUserIcon,
  noIncentives: GavelIcon,
  noQuotas: AppRegistrationIcon,
  threeDayRule: TimerIcon,
  dataSecurity: PhonelinkLockIcon,
  smsPacing: SecurityIcon,
};

export default function ConsentScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Initialize checks state from the config file
  const [checks, setChecks] = useState<Record<string, boolean>>(() =>
    LEGAL_CONFIG.REQUIRED_CHECKS.reduce(
      (acc, check) => ({ ...acc, [check.id]: false }),
      {},
    ),
  );

  const canSubmit = useMemo(
    () => Object.values(checks).every(Boolean),
    [checks],
  );

  const handleAgree = async () => {
    if (!user?.uid || !canSubmit) return;
    setLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        has_agreed_to_terms: true,
        terms_agreed_at: Date.now(),
        legal_consent: {
          version: LEGAL_CONFIG.CURRENT_VERSION,
          agreed_at_ms: Date.now(),
          user_agent: navigator.userAgent,
        },
      });
      // App.tsx should detect the change and navigate automatically
    } catch (err: any) {
      console.error("Consent Error:", err);
      setLoading(false);
      alert(`Activation Error: ${err.message}`);
    }
  };

  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="md">
        <Paper elevation={4} sx={{ p: { xs: 3, md: 5 }, borderRadius: 4 }}>
          <Box textAlign="center" mb={4}>
            <Logo width={140} />
            <Typography
              variant="h4"
              fontWeight="800"
              sx={{ mt: 2, fontFamily: "Roboto", color: "secondary.main" }}
            >
              Consent Agreement
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: "monospace" }}
            >
              VERSION: {LEGAL_CONFIG.CURRENT_VERSION}
            </Typography>
          </Box>

          <Alert
            severity="error"
            variant="filled"
            sx={{ mb: 4, borderRadius: 2 }}
          >
            <AlertTitle sx={{ fontWeight: "bold" }}>
              CRITICAL COMPLIANCE NOTICE
            </AlertTitle>
            Voter bribery is a Third-Degree Felony in Pennsylvania. GroundGame26
            enforces zero-tolerance for incentivized registration.
          </Alert>

          <Stack spacing={3}>
            {LEGAL_CONFIG.REQUIRED_CHECKS.map((item, index) => {
              const IconComponent = ICON_MAP[item.id] || SecurityIcon; // Fallback to security icon if missing

              return (
                <Box key={item.id}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Checkbox
                      checked={checks[item.id]}
                      onChange={() =>
                        setChecks((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id],
                        }))
                      }
                      sx={{ mt: -0.5 }}
                    />
                    <Box>
                      <Typography
                        variant="subtitle1"
                        fontWeight="bold"
                        color="primary"
                        sx={{ display: "flex", alignItems: "center", mb: 0.5 }}
                      >
                        <IconComponent sx={{ mr: 1, fontSize: 20 }} />{" "}
                        {item.label}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.5 }}
                      >
                        {item.description}
                      </Typography>
                    </Box>
                  </Stack>
                  {index < LEGAL_CONFIG.REQUIRED_CHECKS.length - 1 && (
                    <Divider sx={{ mt: 3 }} />
                  )}
                </Box>
              );
            })}
          </Stack>

          <Box sx={{ mt: 6 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button
                variant="outlined"
                fullWidth
                size="large"
                onClick={() => signOut(auth)}
                sx={{ py: 1.5 }}
              >
                Logout (Disagree)
              </Button>
              <Button
                variant="contained"
                fullWidth
                size="large"
                disabled={!canSubmit || loading}
                onClick={handleAgree}
                sx={{ py: 1.5, fontWeight: "bold" }}
              >
                {loading ? "Activating..." : "Complete Activation"}
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
