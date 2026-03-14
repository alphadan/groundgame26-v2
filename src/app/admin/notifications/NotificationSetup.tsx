import { useEffect } from "react";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { messaging, db } from "../../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";

interface Props {
  uid: string | undefined;
}

export function NotificationSetup({ uid }: Props) {
  useEffect(() => {
    // 1. Guard: Only run if user is logged in
    if (!uid) return;

    const setup = async () => {
      try {
        // 2. Request Permissions
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.warn("🔔 Notification permission denied.");
          return;
        }

        // 3. Retrieve Token
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        });

        if (token) {
          // 4. Save Token to Firestore
          // We use the token itself as the document ID to prevent duplicates
          const tokenRef = doc(db, "users", uid, "fcmTokens", token);

          await setDoc(tokenRef, {
            token: token,
            device_type: "web", // Helpful for debugging
            last_seen: Date.now(),
          });

          console.log("✅ FCM Token registered successfully.");
        }
      } catch (err) {
        console.error("❌ FCM setup error:", err);
      }
    };

    setup();

    // 5. Handle Foreground Messages (Toast/Alert logic)
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("📨 Foreground message received:", payload);
      // Optional: You could trigger a snackbar or sound here
    });

    return unsubscribe;
  }, [uid]); // Rerun if user switches accounts

  return null;
}
