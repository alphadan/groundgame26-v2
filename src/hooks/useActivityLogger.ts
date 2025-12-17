import { useCallback } from "react";
import { useCloudFunctions } from "./useCloudFunctions";
import { auth } from "../lib/firebase"; // Import auth for success backup

export const useActivityLogger = () => {
  const { callFunction } = useCloudFunctions();

  /**
   * Log a successful login
   * Passing current user details explicitly to prevent race conditions
   */
  const logSuccess = useCallback(async () => {
    const user = auth.currentUser;
    try {
      await callFunction("logLoginActivity", {
        success: true,
        uid: user?.uid, // Explicit UID
        email: user?.email, // Explicit Email
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Failed to log successful login:", error);
    }
  }, [callFunction]);

  /**
   * Log a failed login attempt
   * @param errorCode - e.g., "auth/invalid-credential"
   * @param identifier - The email or username the user tried to use
   */
  const logFailure = useCallback(
    async (
      errorCode: string,
      identifier?: string,
      extra?: Record<string, any>
    ) => {
      try {
        await callFunction("logLoginActivity", {
          success: false,
          errorCode,
          email: identifier, // Log what they tried to login with
          ...extra,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.warn("Failed to log failed login:", error);
      }
    },
    [callFunction]
  );

  return {
    logSuccess,
    logFailure,
  };
};
