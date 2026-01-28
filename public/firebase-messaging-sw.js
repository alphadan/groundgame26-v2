// public/firebase-messaging-sw.js
importScripts(
  "https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js",
);

// Use placeholders or build-time replacement (see notes below)
const firebaseConfig = {
  apiKey: "AIzaSyBMas49p_4luQ5LuDDhXGCooudLqPuTU8k",
  authDomain: "groundgame26.com",
  projectId: "groundgame26-v2",
  storageBucket: "groundgame26-v2.firebasestorage.app",
  messagingSenderId: "275596286476",
  appId: "1:275596286476:web:c07c3352ff92bda30c6c29",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Background handler (enhanced)
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload,
  );

  // Customize notification
  const notificationTitle =
    payload.notification?.title || "GroundGame26 Update";
  const notificationOptions = {
    body: payload.notification?.body || "You have a new message",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    tag: "groundgame-notification",
    renotify: true, // New notifications replace old ones with same tag
    vibrate: [200, 100, 200], // Vibration pattern
    data: payload.data || {}, // Pass custom data for click handling
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Optional: Handle notification click (open app or specific route)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
