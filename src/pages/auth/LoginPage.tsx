import { useState, useEffect, useRef, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  RecaptchaVerifier,
  sendEmailVerification,
  sendPasswordResetEmail,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  getMultiFactorResolver,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useActivityLogger } from "../../hooks/useActivityLogger";
import { useTheme } from "@mui/material/styles";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Link,
  Stack,
} from "@mui/material";

import LogoSvg from "../../assets/icons/icon-blue-512.svg";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

export default function LoginPage() {
  const theme = useTheme();

  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const emailFromUrl = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot Password
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // MFA Code Input Modal
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaResolver, setMfaResolver] = useState<any>(null);

  const { logFailure } = useActivityLogger();

  // === Safe reCAPTCHA Verifier Management ===
  const setupRecaptcha = useCallback(() => {
    if (verifierRef.current || !recaptchaContainerRef.current) return;

    try {
      const verifier = new RecaptchaVerifier(
        auth,
        recaptchaContainerRef.current,
        {
          size: "invisible",
        },
      );

      verifierRef.current = verifier;
      window.recaptchaVerifier = verifier;
    } catch (err) {
      console.error("Failed to initialize reCAPTCHA:", err);
    }
  }, []);

  const clearRecaptcha = useCallback(() => {
    try {
      verifierRef.current?.clear();
    } catch (err) {
      // Ignore cleanup errors
    } finally {
      verifierRef.current = null;
      window.recaptchaVerifier = undefined;
    }
  }, []);

  useEffect(() => {
    setupRecaptcha();

    return () => {
      clearRecaptcha();
    };
  }, [setupRecaptcha, clearRecaptcha]);

  // === Login Handler ===
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      const user = credential.user;
      if (user && !user.emailVerified) {
        await sendEmailVerification(user);
        setError(
          "Check your email for the verification link. You have been signed out.",
        );
        setTimeout(() => auth.signOut(), 4000);
        return;
      }
    } catch (err: any) {
      logFailure(err.code || "unknown_error", email.toLowerCase());

      if (err.code === "auth/multi-factor-auth-required") {
        await handleMFAChallenge(err);
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email address");
      } else if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        setError("Invalid email or password");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Try again later or reset your password.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // === MFA Challenge Handler ===
  const handleMFAChallenge = async (error: any) => {
    try {
      const resolver = getMultiFactorResolver(auth, error);

      const phoneHint = resolver.hints.find(
        (hint: any) => hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID,
      );

      if (!phoneHint) {
        setError("No phone number enrolled for MFA");
        return;
      }

      clearRecaptcha();
      setupRecaptcha();

      if (!verifierRef.current) {
        setError("reCAPTCHA failed to load. Please refresh the page.");
        return;
      }

      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneAuthProvider.verifyPhoneNumber(
        {
          multiFactorHint: phoneHint,
          session: resolver.session,
        },
        verifierRef.current,
      );

      setMfaResolver({ resolver, verificationId });
      setMfaOpen(true);
      setMfaCode("");
    } catch (mfaErr) {
      console.error("MFA setup failed:", mfaErr);
      setError("Unable to start MFA challenge. Please try again.");
    }
  };

  const completeMFA = async () => {
    if (!mfaResolver || !mfaCode.trim()) {
      setError("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const cred = PhoneAuthProvider.credential(
        mfaResolver.verificationId,
        mfaCode.trim(),
      );
      const assertion = PhoneMultiFactorGenerator.assertion(cred);
      await mfaResolver.resolver.resolveSignIn(assertion);

      setMfaOpen(false);
      setMfaCode("");
      setMfaResolver(null);
    } catch (error: any) {
      if (error.code === "auth/invalid-verification-code") {
        setError("Invalid code. Please try again.");
      } else {
        setError(
          "MFA verification failed: " + (error.message || "Unknown error"),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // === Password Reset ===
  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      setError("Please enter your email");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
    } catch (err) {
      // Silent for security
    } finally {
      setResetSent(true);
    }
  };

  return (
    <>
      {/* Hidden reCAPTCHA container */}
      <div ref={recaptchaContainerRef} style={{ display: "none" }} />

      <Box
        sx={{
          minHeight: "80vh",
          bgcolor: "background.default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Box
          sx={{
            width: { xs: "100%", sm: 420 },
            maxWidth: 420,
            p: { xs: 3, sm: 4 },
            bgcolor: "background.paper",
            borderRadius: 4,
            boxShadow: 6,
          }}
        >
          <Stack spacing={2.5} alignItems="center">
            <Box
              component="img"
              src={LogoSvg}
              alt="GroundGame26"
              sx={{
                width: "60%",
                maxWidth: 240,
              }}
            />
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign="center"
              fontStyle="italic"
            >
              A Republican Get Out The Vote App
            </Typography>
            <Stack
              component="form"
              onSubmit={handleLogin}
              spacing={2}
              width="100%"
            >
              <TextField
                label="Email"
                type="email"
                size="small"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <TextField
                label="Password"
                type="password"
                size="small"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Link
                component="button"
                type="button"
                variant="caption"
                onClick={() => setForgotOpen(true)}
                sx={{
                  alignSelf: "flex-end",
                  color: "primary.main",
                  fontWeight: 500,
                  mt: -1,
                }}
              >
                Forgot Password?
              </Link>

              {error && (
                <Alert
                  severity="error"
                  sx={{ py: 0, "& .MuiAlert-icon": { py: "8px" } }}
                  onClose={() => setError("")}
                >
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={loading}
                sx={{
                  py: 1.5,
                  fontSize: "1rem",
                  fontWeight: "bold",
                  mt: 1,
                }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Sign In"
                )}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Box>

      {/* === Forgot Password Dialog === */}
      <Dialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: "primary.main", color: "white" }}>
          Reset Password
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {resetSent ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              If an account exists with that email, a password reset link has
              been sent.
            </Alert>
          ) : (
            <TextField
              label="Email Address"
              type="email"
              fullWidth
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              autoFocus
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForgotOpen(false)}>Close</Button>
          {!resetSent && (
            <Button
              onClick={handleForgotPassword}
              variant="contained"
              color="primary"
            >
              Send Reset Link
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* === MFA Dialog === */}
      <Dialog
        open={mfaOpen}
        onClose={() => setMfaOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Enter Verification Code</DialogTitle>
        <DialogContent>
          <Typography gutterBottom sx={{ mt: 1 }}>
            A 6-digit code was sent to your phone. Enter it below:
          </Typography>
          <TextField
            autoFocus
            label="Code"
            value={mfaCode}
            onChange={(e) =>
              setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            fullWidth
            inputProps={{ maxLength: 6 }}
            sx={{ mt: 2 }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setMfaOpen(false);
              setMfaCode("");
              setError("");
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={completeMFA}
            variant="contained"
            color="primary"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : "Verify"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
