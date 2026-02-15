// src/lib/analytics.ts
import { logEvent as firebaseLogEvent } from "firebase/analytics";
import { analytics } from "./firebase";

/**
 * Global wrapper for Firebase logEvent.
 * Handles the "Analytics | null" check automatically to satisfy TypeScript.
 */
export function logEvent(eventName: string, params?: Record<string, any>) {
  if (analytics) {
    firebaseLogEvent(analytics, eventName, params);
  } else {
    // Optional: Log to console in development if analytics isn't ready
    if (import.meta.env.DEV) {
      console.warn(`[Analytics Not Ready] Event: ${eventName}`, params);
    }
  }
}
