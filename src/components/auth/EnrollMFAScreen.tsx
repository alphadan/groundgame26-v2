// src/components/auth/EnrollMFAScreen.tsx — FINAL FIXED VERSION WITH REDIRECT
import { useState, useEffect, useRef } from "react";
import {
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  signOut,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useNavigate } from "react-router-dom"; // ← NEW IMPORT
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
    recaptchaWidgetId?: number;
  }
}

export default function EnrollMFAScreen() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [stage, setStage] = useState<"phone" | "code" | "success">("phone");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const navigate = useNavigate(); // ← For redirecting after success
  const containerRef = useRef<HTMLDivElement>(null);

  // ──────────────────────────────────────────────────────────────
  // Create reCAPTCHA only once, safely destroy on unmount
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clean up any previous verifier
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch {}
      window.recaptchaVerifier = undefined;
    }
    if (typeof window.recaptchaWidgetId === "number") {
      try {
        (window as any).grecaptcha?.reset(window.recaptchaWidgetId);
      } catch {}
      window.recaptchaWidgetId = undefined;
    }

    const verifier = new RecaptchaVerifier(
      auth,
      container,
      { size: "invisible" }
    );

    window.recaptchaVerifier = verifier;

    return () => {
      try {
        verifier.clear();
      } catch {}
      window.recaptchaVerifier = undefined;
    };
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Send SMS code
  // ──────────────────────────────────────────────────────────────
  const sendCode = async () => {
    setError("");
    setMessage("");

    if (!phone.match(/^\+\d{10,15}$/)) {
      return setError("Use international format: +1XXXXXXXXXX");
    }

    try {
      if (window.recaptchaVerifier) {
        await window.recaptchaVerifier.render();
      }

      const session = await multiFactor(auth.currentUser!).getSession();
      const phoneInfoOptions = {
        phoneNumber: phone,
        session,
      };

      const provider = new PhoneAuthProvider(auth);
      const vid = await provider.verifyPhoneNumber(
        phoneInfoOptions,
        window.recaptchaVerifier!
      );

      setVerificationId(vid);
      setStage("code");
      setMessage("SMS sent! Check your phone");
    } catch (err: any) {
      console.error("SMS error:", err);
      if (err.code === "auth/unverified-email") {
        setError("Please verify your email first (check your inbox/spam).");
      } else if (err.code === "auth/requires-recent-login") {
        setError("Session expired — please log out and log in again.");
      } else {
        setError(err.message || "Failed to send SMS");
      }
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Verify code and complete enrollment
  // ──────────────────────────────────────────────────────────────
  const verify = async () => {
    if (code.length !== 6) return;

    setVerifying(true);
    setError("");

    try {
      const cred = PhoneAuthProvider.credential(verificationId, code);
      const assertion = PhoneMultiFactorGenerator.assertion(cred);

      await multiFactor(auth.currentUser!).enroll(assertion, "Committee Phone");

      // SUCCESS! Redirect to main app
      setStage("success");
      setMessage("MFA successfully enabled! Redirecting...");

      // Small delay for user feedback, then navigate
      setTimeout(() => {
        navigate("/reports"); // Or navigate("/") if you prefer the default redirect
      }, 1500);
    } catch (err: any) {
      console.error("Enrollment error:", err);
      setError("Invalid code — try again");
      setVerifying(false);
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
    >
      <Typography variant="h5" color="#d32f2f" textAlign="center" mb={2}>
        Security Setup Required
      </Typography>
      <Typography textAlign="center" mb={4}>
        Add your phone number for two-factor authentication
      </Typography>

      {/* Hidden reCAPTCHA container */}
      <div ref={containerRef} />

      {stage === "phone" && (
        <>
          <TextField
            label="Phone Number (+1XXXXXXXXXX)"
            fullWidth
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            margin="normal"
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <Button
            variant="contained"
            fullWidth
            sx={{ mt: 2, bgcolor: "#d32f2f" }}
            onClick={sendCode}
          >
            Send SMS Code
          </Button>
        </>
      )}

      {stage === "code" && (
        <>
          <TextField
            label="6-digit code"
            fullWidth
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputProps={{ maxLength: 6 }}
            autoFocus
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
            disabled={code.length !== 6 || verifying}
            sx={{ mt: 2, bgcolor: "#d32f2f" }}
            onClick={verify}
          >
            {verifying ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Completing Setup...
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
        sx={{ mt: 4 }}
        onClick={() => signOut(auth).then(() => navigate("/"))}
      >
        Log Out
      </Button>
    </Box>
  );
}
