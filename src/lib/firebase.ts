// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, memoryLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  CustomProvider,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// --- Initialize Firebase App ---
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// --- Export Core Services ---
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

/**
 * FIRESTORE CONFIGURATION (2025 Standard)
 * Using memoryLocalCache to prevent IndexedDB deadlocks with Dexie.js.
 * This ensures the PWA's primary persistence is handled by Dexie
 * while Firestore remains the real-time data pipe.
 */
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: false,
  experimentalAutoDetectLongPolling: false,
});

/**
 * APP CHECK INITIALIZATION
 * Guarded with a singleton-style check to prevent redundant initialization.
 * This specifically fixes the "429 Too Many Requests" error on exchangeDebugToken.
 */
const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || "";

if (typeof window !== "undefined") {
  // Check if we are in a development environment and have a token defined
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (isLocal) {
    // 1. Set the token
    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.REACT_APP_APPCHECK_DEBUG_TOKEN ||
      "538F269B-9679-453F-9322-CF2CFD797AD5";
    console.log(
      "🛠️ [Firebase] Debug mode enabled with token:",
      (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN
    );
  }

  try {
    initializeAppCheck(app, {
      // 2. FORCING DEBUG LOCALLY: This is the key change
      provider: isLocal
        ? new CustomProvider({
            getToken: async () => {
              // This forces the SDK to wait for the debug handshake
              return (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN;
            },
          })
        : new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn("ℹ️ App Check already active.");
  }
}
