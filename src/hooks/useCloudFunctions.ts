// src/hooks/useCloudFunctions.ts
import { useCallback, useMemo } from "react";
import {
  getFunctions,
  httpsCallable,
  Functions,
  HttpsCallable,
} from "firebase/functions";
import { useAuth } from "../context/AuthContext";

/**
 * Safe wrapper for Cloud Function calls with:
 * - Auth gating
 * - Timeout
 * - Input validation
 * - Standardized error handling
 * - Abort support
 */
export const useCloudFunctions = () => {
  const { user, isLoaded } = useAuth();
  const functions = useMemo(() => getFunctions(), []);

  /**
   * Type-safe, reliable Cloud Function caller
   */
  const callFunction = useCallback(
    async <T = unknown>(
      name: string,
      data?: Record<string, any>,
      options?: { timeoutMs?: number }
    ): Promise<T> => {
      // === 1. Parameter validation ===
      if (typeof name !== "string" || name.trim() === "") {
        throw new Error("Cloud Function name must be a non-empty string");
      }

      if (data && (typeof data !== "object" || Array.isArray(data))) {
        throw new Error("Data must be a plain object or undefined");
      }

      // === 2. Auth validation ===
      if (!isLoaded) {
        throw new Error("Authentication state not ready");
      }

      if (!user) {
        throw new Error("User not authenticated – cannot call Cloud Function");
      }

      // === 3. Setup callable with timeout ===
      const timeoutMs = options?.timeoutMs ?? 15000; // 15s default
      const controller = new AbortController();

      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let callable: HttpsCallable<unknown, T>;
      try {
        callable = httpsCallable<unknown, T>(functions, name);
      } catch (setupErr) {
        clearTimeout(timeoutId);
        console.error(
          `Failed to initialize Cloud Function "${name}":`,
          setupErr
        );
        throw new Error(`Function "${name}" not available`);
      }

      try {
        const result = await callable(data, { signal: controller.signal });

        // Firebase guarantees data exists and is T
        // But we defensively return it
        return result.data;
      } catch (err: any) {
        clearTimeout(timeoutId);

        // Standardize error messages (prevent info leaks)
        let userMessage = "Cloud Function call failed";

        if (err.name === "AbortError") {
          userMessage = "Request timeout – please try again";
        } else if (err.code === "permission-denied") {
          userMessage = "Permission denied";
        } else if (err.code === "unauthenticated") {
          userMessage = "Authentication required";
        } else if (err.code === "invalid-argument") {
          userMessage = "Invalid request";
        }

        console.error(`Cloud Function "${name}" error:`, err);

        // Re-throw with safe message
        const safeError = new Error(userMessage);
        safeError.cause = err; // Preserve original for debugging (dev only)
        throw safeError;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [user, isLoaded, functions]
  );

  return { callFunction };
};
