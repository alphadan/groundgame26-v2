// src/hooks/useActivityLogger.ts
import { useCallback } from "react";
import { useCloudFunctions } from "./useCloudFunctions";

/**
 * Hook for logging user activity (successful/failed logins, etc.)
 * Uses the secure callable function "logLoginActivity"
 */
export const useActivityLogger = () => {
  const { callFunction } = useCloudFunctions();

  /**
   * Log a successful login
   */
  const logSuccess = useCallback(async () => {
    try {
      await callFunction("logLoginActivity", {
        success: true,
        timestamp: new Date().toISOString(), // client timestamp as fallback
      });
    } catch (error) {
      // Fail silently — activity logging should never break the app
      console.warn("Failed to log successful login:", error);
    }
  }, [callFunction]);

  /**
   * Log a failed login attempt
   * @param errorCode - Firebase auth error code (e.g., "auth/wrong-password")
   * @param extra - Any additional context (optional)
   */
  const logFailure = useCallback(
    async (errorCode: string, extra?: Record<string, any>) => {
      try {
        await callFunction("logLoginActivity", {
          success: false,
          errorCode,
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
