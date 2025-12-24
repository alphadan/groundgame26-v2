// src/hooks/useActivityLogger.ts
import { useCallback } from "react";
import { useCloudFunctions } from "./useCloudFunctions";
import { useAuth } from "../context/AuthContext"; // Preferred: use context, not raw auth

export const useActivityLogger = () => {
  const { callFunction } = useCloudFunctions();
  const { user, isLoaded } = useAuth(); // Safe, reactive auth state

  /**
   * Log successful activity (e.g., login)
   * Captures UID/email at call time to prevent race conditions
   */
  const logSuccess = useCallback(async () => {
    // Early guard: only log if auth is fully loaded and user exists
    if (!isLoaded || !user) {
      console.debug("Activity log skipped: user not authenticated");
      return;
    }

    const uid = user.uid;
    const email = user.email ?? undefined;

    try {
      await callFunction("logLoginActivity", {
        success: true,
        uid,
        email,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });
    } catch (error: any) {
      // Non-critical: logging failure should never crash app
      console.warn(
        "Failed to log successful activity:",
        error?.message ?? error
      );
    }
  }, [user, isLoaded, callFunction]);

  /**
   * Log failed activity (e.g., bad login)
   * @param errorCode - Firebase auth error code or custom string
   * @param identifier - Email/phone attempted (optional – sanitize if needed)
   * @param extra - Additional safe context
   */
  const logFailure = useCallback(
    async (
      errorCode: string = "unknown_error",
      identifier?: string,
      extra: Record<string, unknown> = {}
    ) => {
      // === Parameter validation ===
      if (typeof errorCode !== "string" || errorCode.trim() === "") {
        console.warn("Invalid errorCode in logFailure – using default");
        errorCode = "invalid_error_code";
      }

      // Sanitize identifier – never log full email on failure if policy restricts
      const safeIdentifier =
        typeof identifier === "string" ? identifier.trim() : undefined;

      // Capture current user state (if any) at call time
      const currentUid = user?.uid ?? undefined;
      const currentEmail = user?.email ?? undefined;

      try {
        await callFunction("logLoginActivity", {
          success: false,
          errorCode: errorCode.trim(),
          attemptedIdentifier: safeIdentifier,
          uid: currentUid,
          email: currentEmail, // Only if already logged in
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          ...extra,
        });
      } catch (error: any) {
        console.warn("Failed to log failed activity:", error?.message ?? error);
      }
    },
    [user, callFunction]
  );

  return {
    logSuccess,
    logFailure,
  };
};
