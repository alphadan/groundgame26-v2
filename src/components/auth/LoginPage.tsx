// src/components/auth/LoginPage.tsx
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
import { getFunctions, httpsCallable } from "firebase/functions";
import { useActivityLogger } from "../../hooks/useActivityLogger";
import { useTheme } from "@mui/material/styles";

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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot Password
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Volunteer Form
  const [volunteerOpen, setVolunteerOpen] = useState(false);
  const [volName, setVolName] = useState("");
  const [volEmail, setVolEmail] = useState("");
  const [volComment, setVolComment] = useState("");
  const [showThankYou, setShowThankYou] = useState(false);

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
        }
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
        password
      );

      const user = credential.user;
      if (user && !user.emailVerified) {
        await sendEmailVerification(user);
        setError(
          "Check your email for the verification link. You have been signed out."
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
        (hint: any) => hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID
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
        verifierRef.current
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
        mfaCode.trim()
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
          "MFA verification failed: " + (error.message || "Unknown error")
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

  // === Volunteer Submission ===
  const handleVolunteerSubmit = async () => {
    if (!volName.trim() || !volEmail.trim()) {
      setError("Name and email are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (!verifierRef.current) {
        throw new Error("reCAPTCHA not initialized. Please refresh.");
      }

      // 1. Manually trigger the invisible reCAPTCHA challenge
      const token = await verifierRef.current.verify();

      // 2. Log the token to verify it's working (optional, for debugging)
      console.log("Captured Token:", token);

      // 3. Call your function via HTTPS Callable
      const functions = getFunctions(undefined, "us-central1");
      const submitVolunteer = httpsCallable(functions, "submitVolunteer");

      console.log(
        "Submitting volunteer with token:",
        volName,
        volEmail,
        volComment
      );

      // IMPORTANT: Note the key name 'recaptchaToken' matches your Cloud Function body check
      await submitVolunteer({
        name: volName.trim(),
        email: volEmail.trim().toLowerCase(),
        comment: volComment.trim(),
        recaptchaToken: token,
      });
      
      setVolunteerOpen(false);
      setShowThankYou(true);
    } catch (error: any) {
      console.error("Volunteer submission failed:", error);
      // If the error comes from the function, it will be in err.message
      setError(error.message || "Submission failed. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hidden reCAPTCHA container */}
      <div ref={recaptchaContainerRef} style={{ display: "none" }} />

      {/* === Thank You Screen === */}
      {showThankYou ? (
        <Box
          sx={{
            minHeight: "100vh",
            bgcolor: "background.default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
          }}
        >
          <Box
            sx={{
              width: { xs: "95%", sm: 520 },
              p: { xs: 5, sm: 7 },
              bgcolor: "background.paper",
              borderRadius: 4,
              boxShadow: 8,
              textAlign: "center",
            }}
          >
            <Box
              component="img"
              src={LogoSvg}
              alt="GroundGame26"
              sx={{
                width: "70%",
                maxWidth: 300,
                mb: 4,
              }}
            />

            <Typography
              variant="h3"
              fontWeight="bold"
              color="primary"
              gutterBottom
              sx={{ fontSize: { xs: "2.2rem", sm: "2.8rem" } }}
            >
              Thank You!
            </Typography>

            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ mb: 5, lineHeight: 1.8 }}
            >
              Thank you for your interest in volunteering.
              <br />
              An Area Captain will reach out within one business day.
            </Typography>

            <Button
              variant="contained"
              size="large"
              onClick={() => {
                setShowThankYou(false);
                setVolunteerOpen(false);
                setVolName("");
                setVolEmail("");
                setVolComment("");
              }}
              sx={{
                px: 8,
                py: 2,
                fontSize: "1.2rem",
                fontWeight: "bold",
              }}
            >
              Return to Login
            </Button>
          </Box>
        </Box>
      ) : (
        /* === Main Login Screen === */
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
          <Box
            sx={{
              width: { xs: "100%", sm: 460 },
              maxWidth: 460,
              p: { xs: 4, sm: 6 },
              bgcolor: "background.paper",
              borderRadius: 4,
              boxShadow: 6,
            }}
          >
            <Stack spacing={4} alignItems="center">
              <Box
                component="img"
                src={LogoSvg}
                alt="GroundGame26"
                sx={{
                  width: "80%",
                  maxWidth: 320,
                }}
              />

              <Typography
                variant="h6"
                color="text.secondary"
                textAlign="center"
                fontStyle="italic"
              >
                A Republican Get Out The Vote App
              </Typography>

              <Stack
                component="form"
                onSubmit={handleLogin}
                spacing={3}
                width="100%"
              >
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <Link
                  component="button"
                  variant="body2"
                  onClick={() => setForgotOpen(true)}
                  sx={{
                    alignSelf: "flex-end",
                    color: "primary.main",
                    fontWeight: 500,
                  }}
                >
                  Forgot Password?
                </Link>

                {error && (
                  <Alert severity="error" onClose={() => setError("")}>
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
                    py: 2,
                    fontSize: "1.1rem",
                    fontWeight: "bold",
                  }}
                >
                  {loading ? (
                    <CircularProgress size={28} color="inherit" />
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </Stack>

              <Typography variant="body1" textAlign="center">
                <Link
                  component="button"
                  onClick={() => setVolunteerOpen(true)}
                  sx={{
                    color: "primary.main",
                    fontWeight: "bold",
                    fontSize: "1.05rem",
                  }}
                >
                  Want to Volunteer?
                </Link>
              </Typography>
            </Stack>
          </Box>
        </Box>
      )}

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
            <Alert severity="success">
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
              sx={{ mt: 1 }}
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

      {/* === Volunteer Form Dialog === */}
      <Dialog
        open={volunteerOpen}
        onClose={() => setVolunteerOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: "primary.main", color: "white" }}>
          Want to Volunteer?
        </DialogTitle>
        <DialogContent sx={{ pt: 3, mt: 4 }}>
          <Stack spacing={3} sx={{ pt: 1, mt: 1 }}>
            <TextField
              label="Full Name *"
              fullWidth
              value={volName}
              onChange={(e) => setVolName(e.target.value)}
            />
            <TextField
              label="Email *"
              type="email"
              fullWidth
              value={volEmail}
              onChange={(e) => setVolEmail(e.target.value)}
            />
            <TextField
              label="How would you like to help?"
              multiline
              rows={4}
              fullWidth
              value={volComment}
              onChange={(e) => setVolComment(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVolunteerOpen(false)}>Cancel</Button>
          <Button
            onClick={handleVolunteerSubmit}
            variant="contained"
            color="primary"
            disabled={loading || !volName.trim() || !volEmail.trim()}
          >
            {loading ? "Submitting..." : "Submit"}
          </Button>
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
          <Typography gutterBottom>
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
