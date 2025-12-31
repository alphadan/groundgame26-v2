// src/components/auth/EnrollMFAScreen.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import {
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  signOut,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Tooltip,
  InputAdornment,
  IconButton,
  Stack,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

/**
 * Normalize and validate US phone number
 * Accepts: 5551234567, (555) 123-4567, 555-123-4567, +15551234567
 * Returns: +1XXXXXXXXXX or null if invalid
 */
const normalizeUSPhone = (input: string): string | null => {
  if (!input) return null;

  const digits = input.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
};

export default function EnrollMFAScreen() {
  const [phoneInput, setPhoneInput] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);
  const [inputError, setInputError] = useState(false);
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [stage, setStage] = useState<"phone" | "code" | "success">("phone");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time phone validation
  useEffect(() => {
    const normalized = normalizeUSPhone(phoneInput);
    setNormalizedPhone(normalized);
    setInputError(phoneInput.trim() !== "" && normalized === null);
  }, [phoneInput]);

  // Safe reCAPTCHA Management
  const setupRecaptcha = useCallback(async () => {
    if (!containerRef.current) return;

    if (verifierRef.current) {
      try {
        verifierRef.current.clear();
      } catch {}
    }
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch {}
      window.recaptchaVerifier = undefined;
    }

    try {
      const verifier = new RecaptchaVerifier(auth, containerRef.current, {
        size: "invisible",
      });
      await verifier.render();
      verifierRef.current = verifier;
      window.recaptchaVerifier = verifier;
    } catch (err) {
      console.error("Failed to initialize reCAPTCHA:", err);
      setError("Security check failed to load. Please refresh.");
    }
  }, []);

  const clearRecaptcha = useCallback(() => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
    try {
      verifierRef.current?.clear();
    } catch {}
    try {
      window.recaptchaVerifier?.clear();
    } catch {}
    verifierRef.current = null;
    window.recaptchaVerifier = undefined;
  }, []);

  useEffect(() => {
    setupRecaptcha();
    return clearRecaptcha;
  }, [setupRecaptcha, clearRecaptcha]);

  // Send SMS Code
  const sendCode = async () => {
    setError("");
    setMessage("");

    if (!normalizedPhone) {
      setInputError(true);
      setError("Please enter a valid US phone number");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Authentication lost. Please log in again.");
      await safeSignOut();
      return;
    }

    setLoading(true);

    try {
      if (!verifierRef.current) {
        throw new Error("reCAPTCHA not ready");
      }

      const session = await multiFactor(currentUser).getSession();

      const phoneInfoOptions = {
        phoneNumber: normalizedPhone,
        session,
      };

      const provider = new PhoneAuthProvider(auth);
      const vid = await provider.verifyPhoneNumber(
        phoneInfoOptions,
        verifierRef.current
      );

      setVerificationId(vid);
      setStage("code");
      setMessage("Code sent! Check your phone.");
    } catch (err: any) {
      console.error("SMS send failed:", err);
      const userMsg =
        err.code === "auth/invalid-phone-number"
          ? "Invalid phone number"
          : err.code === "auth/requires-recent-login"
          ? "Session expired — please log out and log in again."
          : err.code === "auth/unverified-email"
          ? "Please verify your email first."
          : err.message || "Failed to send code";
      setError(userMsg);
    } finally {
      setLoading(false);
    }
  };

  // Verify Code & Enroll
  const verifyCode = async () => {
    if (code.length !== 6) return;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Session lost. Please log in again.");
      await safeSignOut();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const cred = PhoneAuthProvider.credential(verificationId, code);
      const assertion = PhoneMultiFactorGenerator.assertion(cred);

      await multiFactor(currentUser).enroll(assertion, "Mobile Phone");

      setStage("success");
      setMessage("Two-factor authentication successfully enabled!");

      redirectTimeoutRef.current = setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 2000);
    } catch (err: any) {
      console.error("MFA enrollment failed:", err);
      setError(
        err.code === "auth/invalid-verification-code"
          ? "Invalid code. Please try again."
          : "Enrollment failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const safeSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Sign out failed:", e);
    } finally {
      navigate("/", { replace: true });
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      {/* Hidden reCAPTCHA container */}
      <div ref={containerRef} style={{ display: "none" }} />

      <Box
        sx={{
          width: { xs: "100%", sm: 460 },
          maxWidth: 460,
          p: { xs: 4, sm: 6 },
          bgcolor: "background.paper",
          borderRadius: 4,
          boxShadow: 6,
          textAlign: "center",
        }}
      >
        <Stack spacing={4}>
          <Typography variant="h5" fontWeight="bold" color="primary">
            Security Setup Required
          </Typography>

          <Typography variant="body1" color="text.secondary">
            Add your phone number for two-factor authentication to keep your
            account secure.
          </Typography>

          {/* Phone Entry Stage */}
          {stage === "phone" && (
            <>
              <TextField
                label="Phone Number"
                placeholder="(555) 123-4567"
                fullWidth
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                disabled={loading}
                error={inputError}
                helperText={
                  inputError
                    ? "Please enter a valid 10-digit US number"
                    : "We'll automatically add +1"
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip
                        title="Enter your 10-digit US phone number. We'll format it as +1XXXXXXXXXX automatically."
                        placement="top"
                        arrow
                      >
                        <IconButton size="small">
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />

              {message && <Alert severity="info">{message}</Alert>}
              {error && (
                <Alert severity="error" onClose={() => setError("")}>
                  {error}
                </Alert>
              )}

              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={sendCode}
                disabled={loading || !normalizedPhone}
                sx={{
                  py: 2,
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                }}
              >
                {loading ? (
                  <CircularProgress size={28} color="inherit" />
                ) : (
                  "Send Verification Code"
                )}
              </Button>
            </>
          )}

          {/* Code Entry Stage */}
          {stage === "code" && (
            <>
              <TextField
                label="6-Digit Code"
                fullWidth
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputProps={{ maxLength: 6, inputMode: "numeric" }}
                autoFocus
                disabled={loading}
                sx={{
                  letterSpacing: "0.5rem",
                  "& input": {
                    textAlign: "center",
                    fontSize: "1.8rem",
                  },
                }}
              />

              {message && <Alert severity="info">{message}</Alert>}
              {error && (
                <Alert severity="error" onClose={() => setError("")}>
                  {error}
                </Alert>
              )}

              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={verifyCode}
                disabled={loading || code.length !== 6}
                sx={{
                  py: 2,
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                }}
              >
                {loading ? (
                  <CircularProgress size={28} color="inherit" />
                ) : (
                  "Complete Setup"
                )}
              </Button>
            </>
          )}

          {/* Success Stage */}
          {stage === "success" && (
            <Alert severity="success" sx={{ py: 3 }}>
              <Typography variant="h6" fontWeight="bold">
                {message}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Redirecting you to the dashboard...
              </Typography>
            </Alert>
          )}

          {/* Always show Log Out option */}
          <Button
            variant="text"
            color="error"
            fullWidth
            onClick={safeSignOut}
            sx={{ mt: 2, textTransform: "none" }}
          >
            Log Out
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
