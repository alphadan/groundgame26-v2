// src/components/auth/EnrollMFAScreen.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import {
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  signOut,
  User,
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
} from "@mui/material";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

export default function EnrollMFAScreen() {
  const [phone, setPhone] = useState("");
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

  // === Safe reCAPTCHA Management ===
  const setupRecaptcha = useCallback(async () => {
    if (!containerRef.current) return;

    // Clean up any existing verifier
    if (verifierRef.current) {
      try {
        verifierRef.current.clear();
      } catch (e) {
        console.warn("reCAPTCHA cleanup error (ignored):", e);
      }
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

      // Explicitly render to ensure it's ready
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

    return () => {
      clearRecaptcha();
    };
  }, [setupRecaptcha, clearRecaptcha]);

  // === Send SMS Code ===
  const sendCode = async () => {
    setError("");
    setMessage("");

    const trimmedPhone = phone.trim();
    if (!trimmedPhone.match(/^\+\d{10,15}$/)) {
      setError("Invalid format. Use: +1XXXXXXXXXX");
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
        phoneNumber: trimmedPhone,
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

      if (err.code === "auth/invalid-phone-number") {
        setError("Invalid phone number format");
      } else if (err.code === "auth/missing-phone-number") {
        setError("Phone number required");
      } else if (err.code === "auth/requires-recent-login") {
        setError("Session expired — please log out and log in again.");
      } else if (err.code === "auth/unverified-email") {
        setError("Please verify your email first.");
      } else {
        setError(err.message || "Failed to send code. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // === Verify Code & Enroll ===
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

      // Safe redirect with cleanup
      redirectTimeoutRef.current = setTimeout(() => {
        navigate("/reports", { replace: true });
      }, 1500);
    } catch (err: any) {
      console.error("MFA enrollment failed:", err);
      if (err.code === "auth/invalid-verification-code") {
        setError("Invalid code. Try again.");
      } else {
        setError("Enrollment failed: " + (err.message || "Unknown error"));
      }
    } finally {
      setLoading(false);
    }
  };

  // === Safe Sign Out Helper ===
  const safeSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Sign out failed (ignored):", e);
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

      {/* Hidden reCAPTCHA container */}
      <div ref={containerRef} style={{ display: "none" }} />

      {stage === "phone" && (
        <>
          <TextField
            label="Phone Number"
            placeholder="+1XXXXXXXXXX"
            fullWidth
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            margin="normal"
            disabled={loading}
            helperText="International format required"
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
            disabled={loading || !phone.trim()}
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
