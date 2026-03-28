import React, { useState, useMemo, useEffect } from "react";
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
  CircularProgress,
} from "@mui/material";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { LEGAL_CONFIG } from "../../constants/legal";
import Logo from "../../components/ui/Logo";

// ICON IMPORTS
import GavelIcon from "@mui/icons-material/Gavel";
import SecurityIcon from "@mui/icons-material/Security";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import TimerIcon from "@mui/icons-material/Timer";
import AppRegistrationIcon from "@mui/icons-material/AppRegistration";
import PhonelinkLockIcon from "@mui/icons-material/PhonelinkLock";

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
  const [error, setError] = useState<string | null>(null);
  const [keystoneVersion, setKeystoneVersion] = useState<string | null>(null);

  // 1. DYNAMIC FETCH: Listen to the required legal version from the Keystone
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "app_control"), (snap) => {
      if (snap.exists()) {
        setKeystoneVersion(snap.data().legal_terms_version || "2026.01");
      }
    });
    return unsub;
  }, []);

  // Initialize checks state
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
    // Ensure we are using the EXACT string from the Keystone
    if (!keystoneVersion) return;

    setLoading(true);
    setError(null);

    try {
      if (!user?.uid) return;

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        has_agreed_to_terms: true,
        "legal_consent.version": keystoneVersion,
        "legal_consent.agreed_at_ms": Date.now(),
        "legal_consent.user_agent": navigator.userAgent,
        updated_at: Date.now(),
      });
      console.log("✅ [Consent] Saved version:", keystoneVersion);
    } catch (err: any) {
      console.error("❌ Consent Submission Error:", err);
      setError(
        err.message ||
          "Failed to save agreement. Please check your connection.",
      );
      setLoading(false); // STOP LOADING ON ERROR
    }
  };

  if (!keystoneVersion) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

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
              sx={{ fontFamily: "monospace", display: "block", mt: 1 }}
            >
              REQUIRED COMPLIANCE VERSION: {keystoneVersion}
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

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Stack spacing={3}>
            {LEGAL_CONFIG.REQUIRED_CHECKS.map((item, index) => {
              const IconComponent = ICON_MAP[item.id] || SecurityIcon;

              return (
                <Box key={item.id}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Checkbox
                      checked={checks[item.id]}
                      disabled={loading}
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
                disabled={loading}
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
