// scripts/inject-firebase-config.js
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Resolve paths correctly from project root
const swPath = path.join(__dirname, "../public/firebase-messaging-sw.js");
let swContent = fs.readFileSync(swPath, "utf8");

swContent = swContent
  .replace(
    "___REACT_APP_FIREBASE_AUTH_DOMAIN___",
    process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || ""
  )
  .replace(
    "___REACT_APP_FIREBASE_MESSAGING_SENDER_ID___",
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || ""
  );

fs.writeFileSync(swPath, swContent);
console.log("Firebase config injected into firebase-messaging-sw.js");
