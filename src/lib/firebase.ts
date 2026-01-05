// src/lib/firebase.ts

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  Firestore,
} from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFunctions, Functions } from "firebase/functions";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

// === 1. Strict Config Validation ===
const requiredConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const;

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  serviceAccountId: process.env.REACT_APP_SERVICE_ACCOUNT_ID,
  recaptchaSiteKey: process.env.REACT_APP_RECAPTCHA_SITE_KEY?.trim(),
};

for (const key of requiredConfigKeys) {
  const value = firebaseConfig[key];
  if (!value || typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `[Firebase] Missing or invalid config key: ${key}. Check your .env files.`
    );
  }
}

// === 2. Singleton App Initialization ===
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// === 3. Core Services ===
export const auth: Auth = getAuth(app);
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app);

export const db: Firestore = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalAutoDetectLongPolling: true,
});

// === 4. App Check Initialization (Reliable & Secure) ===
const RECAPTCHA_SITE_KEY = firebaseConfig.recaptchaSiteKey || "";

if (typeof window !== "undefined") {
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.endsWith(".localhost");

  let providerConfigured = false;

  try {
    if (isLocal) {
      const debugToken = process.env.REACT_APP_APPCHECK_DEBUG_TOKEN?.trim();

      if (debugToken) {
        // Fixed registered token — safest for frequent dev (no rate limits)
        (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
        console.log(
          "🛠️ [Firebase] App Check debug mode: using fixed registered token"
        );
      } else {
        // Auto-generated token (will log new token on first run)
        (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        console.log(
          "🛠️ [Firebase] App Check debug mode: auto-generating token (register in console)"
        );
      }

      // Built-in debug provider activates automatically — NO CustomProvider needed
      // Just initialize with any provider (it will be overridden by debug mode)
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(
          RECAPTCHA_SITE_KEY || "unused-in-debug"
        ),
        isTokenAutoRefreshEnabled: true,
      });
      providerConfigured = true;
    } else if (RECAPTCHA_SITE_KEY) {
      // Production
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
      providerConfigured = true;
    } else {
      console.warn(
        "⚠️ [Firebase] No reCAPTCHA site key — App Check disabled in production"
      );
    }
  } catch (err: any) {
    if (err?.message?.includes("already initialized")) {
      // Safe — ignore
    } else {
      console.error("[Firebase] App Check initialization failed:", err);
      // App continues without App Check (graceful degradation)
    }
  }

  if (providerConfigured) {
    console.info("✅ [Firebase] App Check initialized");
  }
}
