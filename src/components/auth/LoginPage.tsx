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
} from "@mui/material";
import LogoSvg from "../../assets/icons/icon-blue-512.svg";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

export default function LoginPage() {
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

      // Reset and recreate verifier to avoid "already rendered" errors
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
    } catch (mfaErr: any) {
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
    } catch (err: any) {
      if (err.code === "auth/invalid-verification-code") {
        setError("Invalid code. Please try again.");
      } else {
        setError(
          "MFA verification failed: " + (err.message || "Unknown error")
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
      // Intentionally silent — security best practice
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
        throw new Error("reCAPTCHA not initialized");
      }

      const token = await verifierRef.current.verify();

      const submitVolunteer = httpsCallable(getFunctions(), "submitVolunteer");
      await submitVolunteer({
        name: volName.trim(),
        email: volEmail.trim().toLowerCase(),
        comment: volComment.trim(),
        recaptchaToken: token,
      });

      setShowThankYou(true);
    } catch (err: any) {
      console.error("Volunteer submission failed:", err);
      setError("Submission failed. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Thank You Screen */}
      {showThankYou ? (
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          bgcolor="#f5f5f5"
          p={3}
        >
          <Box
            width={{ xs: "95%", sm: 500 }}
            p={6}
            bgcolor="white"
            borderRadius={3}
            boxShadow={6}
            textAlign="center"
          >
            <Box
              component="img"
              src={LogoSvg}
              alt="GroundGame26"
              sx={{
                width: "80%",
                maxWidth: 280,
                height: "auto",
                mx: "auto",
                display: "block",
                mb: 3,
              }}
            />

            <Typography
              variant="h4"
              fontWeight="bold"
              color="#B22234"
              mb={2}
              sx={{ fontSize: { xs: "1.8rem", sm: "2.2rem" } }}
            >
              Thank You!
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
              lineHeight={1.7}
              mb={5}
              sx={{ fontSize: { xs: "1rem", sm: "1.1rem" } }}
            >
              Thank you for your interest in volunteering.
              <br />
              We will have an Area Captain reach out to you
              <br />
              within one business day.
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
                bgcolor: "#B22234",
                "&:hover": { bgcolor: "#8B1A1A" },
                px: 6,
                py: 1.8,
                fontSize: "1.1rem",
                fontWeight: "bold",
                textTransform: "none",
              }}
            >
              Return to Login
            </Button>
          </Box>
        </Box>
      ) : (
        /* Main Login Page */
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          bgcolor="#f5f5f5"
        >
          <Box width={420} p={5} bgcolor="white" borderRadius={3} boxShadow={4}>
            <Box
              component="img"
              src={LogoSvg}
              alt="GroundGame26"
              sx={{
                width: "100%",
                maxWidth: 280,
                height: "auto",
                mx: "auto",
                display: "block",
                mb: 2,
              }}
            />

            <Typography
              variant="h6"
              textAlign="center"
              fontWeight="bold"
              color="#5e5e5e"
              mb={4}
              sx={{
                fontSize: { xs: "1.1rem", sm: "1.25rem" },
                fontStyle: "italic",
              }}
            >
              A Republican Get Out The Vote App
            </Typography>

            {/* Hidden reCAPTCHA container */}
            <div ref={recaptchaContainerRef} style={{ display: "none" }} />

            <form
              onSubmit={handleLogin}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                }
              }}
            >
              <TextField
                label="Email"
                type="email"
                fullWidth
                margin="normal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Link
                component="button"
                variant="body2"
                onClick={() => setForgotOpen(true)}
                sx={{
                  display: "block",
                  textAlign: "right",
                  mt: 1,
                  color: "#B22234",
                }}
              >
                Forgot Password?
              </Link>

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{
                  mt: 3,
                  py: 1.8,
                  bgcolor: "#B22234",
                  "&:hover": { bgcolor: "#8B1A1A" },
                  textTransform: "none",
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                }}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <Typography textAlign="center" mt={3}>
              <Link
                component="button"
                variant="body1"
                onClick={() => setVolunteerOpen(true)}
                sx={{
                  color: "#B22234",
                  fontWeight: "bold",
                  fontSize: "1.05rem",
                }}
              >
                Want to Volunteer?
              </Link>
            </Typography>
          </Box>

          {/* Forgot Password Dialog */}
          <Dialog
            open={forgotOpen}
            onClose={() => setForgotOpen(false)}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle sx={{ bgcolor: "#B22234", color: "white" }}>
              Reset Password
            </DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
              {resetSent ? (
                <Alert severity="success">
                  If an account exists with that email, a password reset link
                  has been sent.
                </Alert>
              ) : (
                <TextField
                  label="Email Address"
                  type="email"
                  fullWidth
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
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
                  sx={{ bgcolor: "#B22234" }}
                >
                  Send Reset Link
                </Button>
              )}
            </DialogActions>
          </Dialog>

          {/* Volunteer Form Dialog */}
          <Dialog
            open={volunteerOpen}
            onClose={() => setVolunteerOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle sx={{ bgcolor: "#B22234", color: "white" }}>
              Want to Volunteer?
            </DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
              <TextField
                label="Full Name *"
                fullWidth
                margin="normal"
                value={volName}
                onChange={(e) => setVolName(e.target.value)}
              />
              <TextField
                label="Email *"
                type="email"
                fullWidth
                margin="normal"
                value={volEmail}
                onChange={(e) => setVolEmail(e.target.value)}
              />
              <TextField
                label="How would you like to help?"
                multiline
                rows={4}
                fullWidth
                margin="normal"
                value={volComment}
                onChange={(e) => setVolComment(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setVolunteerOpen(false)}>Cancel</Button>
              <Button
                onClick={handleVolunteerSubmit}
                variant="contained"
                disabled={loading || !volName.trim() || !volEmail.trim()}
                sx={{ bgcolor: "#B22234", "&:hover": { bgcolor: "#8B1A1A" } }}
              >
                {loading ? "Submitting..." : "Submit"}
              </Button>
            </DialogActions>
          </Dialog>

          {/* MFA Code Input Dialog */}
          <Dialog open={mfaOpen} onClose={() => setMfaOpen(false)}>
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
                <Alert severity="error" sx={{ mt: 2 }}>
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
                disabled={loading}
              >
                {loading ? <CircularProgress size={20} /> : "Verify"}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
    </>
  );
}
