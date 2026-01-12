// src/app/admin/notifications/NotificationSetup.tsx
import { useEffect } from "react";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { messaging } from '../../../lib/firebase'; 

export function NotificationSetup() {
  useEffect(() => {
    const setup = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const token = await getToken(messaging, {
          vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
        });

        if (token) {
          // Save token to Firestore: /users/{uid}/fcmTokens/{token}
          // Include role, area, county_id from your user doc
          // Use a Cloud Function or direct write (with security rules)
          console.log("FCM Token:", token);
        }
      } catch (err) {
        console.error("FCM setup error:", err);
      }
    };

    setup();

    // Foreground messages
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("Foreground message:", payload);
      // Show custom toast/UI here
    });

    return unsubscribe;
  }, []);

  return null;
}
