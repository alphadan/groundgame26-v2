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

  // Remove all non-digits
  const digits = input.replace(/\D/g, "");

  // Must be 10 or 11 digits
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
};

export default function EnrollMFAScreen() {
  const [phoneInput, setPhoneInput] = useState(""); // Raw user input
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

  // === Real-time phone validation ===
  useEffect(() => {
    const normalized = normalizeUSPhone(phoneInput);
    setNormalizedPhone(normalized);
    setInputError(phoneInput.trim() !== "" && normalized === null);
  }, [phoneInput]);

  // === Safe reCAPTCHA Management (unchanged from previous hardened version) ===
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

  // === Send SMS Code ===
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

  // === Verify Code & Enroll (unchanged) ===
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
      setMessage("Two-factor authentication enabled!");

      redirectTimeoutRef.current = setTimeout(() => {
        navigate("/reports", { replace: true });
      }, 1500);
    } catch (err: any) {
      console.error("MFA enrollment failed:", err);
      setError(
        err.code === "auth/invalid-verification-code"
          ? "Invalid code. Try again."
          : "Enrollment failed"
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
      maxWidth={460}
      mx="auto"
      mt={8}
      p={4}
      bgcolor="white"
      borderRadius={2}
      boxShadow={4}
      textAlign="center"
    >
      <Typography variant="h5" color="#d32f2f" mb={2}>
        Security Setup Required
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Add your phone for two-factor authentication
      </Typography>

      <div ref={containerRef} style={{ display: "none" }} />

      {stage === "phone" && (
        <>
          <TextField
            label="Phone Number"
            placeholder="5551234567 or (555) 123-4567"
            fullWidth
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            margin="normal"
            disabled={loading}
            error={inputError}
            helperText={
              inputError
                ? "Use a valid US number"
                : "We'll add +1 automatically"
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip
                    title="Enter your 10-digit US phone number. We'll automatically format it as +1XXXXXXXXXX"
                    placement="top"
                    arrow
                  >
                    <IconButton size="small">
                      <InfoIcon fontSize="small" color="action" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          {message && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {message}
            </Alert>
          )}

          <Button
            variant="contained"
            fullWidth
            onClick={sendCode}
            disabled={loading || !normalizedPhone}
            sx={{
              mt: 3,
              bgcolor: "#d32f2f",
              "&:hover": { bgcolor: "#b71c1c" },
            }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Send Code"
            )}
          </Button>
        </>
      )}

      {stage === "code" && (
        <>
          <TextField
            label="6-Digit Code"
            fullWidth
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputProps={{ maxLength: 6 }}
            autoFocus
            disabled={loading}
            sx={{ mt: 2 }}
          />

          {message && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {message}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            fullWidth
            onClick={verifyCode}
            disabled={loading || code.length !== 6}
            sx={{
              mt: 3,
              bgcolor: "#d32f2f",
              "&:hover": { bgcolor: "#b71c1c" },
            }}
          >
            {loading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Completing...
              </>
            ) : (
              "Complete Setup"
            )}
          </Button>
        </>
      )}

      {stage === "success" && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {message}
        </Alert>
      )}

      <Button
        variant="outlined"
        color="error"
        fullWidth
        onClick={safeSignOut}
        sx={{ mt: 4 }}
      >
        Log Out
      </Button>
    </Box>
  );
}
