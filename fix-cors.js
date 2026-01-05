// fix-cors.js
import admin from "firebase-admin";

// Initialize with your project details
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket: "groundgame26-v2.firebasestorage.app",
});

const bucket = admin.storage().bucket();

async function setCors() {
  const cors = [
    {
      // Allow both the IP and localhost versions of your dev server
      origin: ["https://127.0.0.1:3000", "http://localhost:3000"],
      method: ["GET", "PUT", "POST", "DELETE", "OPTIONS"],
      responseHeader: ["Content-Type", "x-goog-resumable"],
      maxAgeSeconds: 3600,
    },
  ];

  await bucket.setCorsConfiguration(cors);
  console.log("✅ SUCCESS: CORS policy updated for groundgame26-v2");
}

setCors().catch((err) => {
  console.error("❌ ERROR:", err.message);
});
