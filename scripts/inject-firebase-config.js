import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv } from "vite";

/**
 * PRODUCTION READY FIREBASE CONFIG INJECTOR
 * This script bridges the gap between Vite's environment variables
 * and the static Service Worker in the /public folder.
 */

// 1. Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Resolve the path to the Service Worker in the public folder
// Note: We target the 'public' folder. When 'vite build' runs,
// it will copy this modified file into the 'dist' folder.
const swPath = path.resolve(__dirname, "../public/firebase-messaging-sw.js");

async function injectConfig() {
  console.log("🚀 Starting Firebase configuration injection...");

  try {
    // 3. Load variables with VITE_ prefix from root .env files
    // Use 'production' mode to ensure we get the live keys during build
    const env = loadEnv("production", path.resolve(__dirname, "../"), "VITE_");

    if (!fs.existsSync(swPath)) {
      throw new Error(`Service Worker file not found at: ${swPath}`);
    }

    // 4. Read the template file
    let swContent = fs.readFileSync(swPath, "utf8");

    // 5. Perform replacements
    // Ensure these ___PLACEHOLDERS___ match exactly what is in your SW file
    const replacements = {
      ___VITE_FIREBASE_API_KEY___: "AIzaSyBMas49p_4luQ5LuDDhXGCooudLqPuTU8k",
      ___VITE_FIREBASE_AUTH_DOMAIN___: "groundgame26.com",
      ___VITE_FIREBASE_PROJECT_ID___: "groundgame26-v2",
      ___VITE_FIREBASE_STORAGE_BUCKET___: "groundgame26-v2.firebasestorage.app",
      ___VITE_FIREBASE_MESSAGING_SENDER_ID___: "275596286476",
      ___VITE_FIREBASE_APP_ID___: "1:275596286476:web:c07c3352ff92bda30c6c29",
    };

    let replaceCount = 0;
    for (const [placeholder, value] of Object.entries(replacements)) {
      if (swContent.includes(placeholder)) {
        swContent = swContent.replace(
          new RegExp(placeholder, "g"),
          value || "",
        );
        replaceCount++;
      }
    }

    // 6. Write the file back to public/
    fs.writeFileSync(swPath, swContent);

    console.log(
      `✅ Success: Injected ${replaceCount} variables into firebase-messaging-sw.js`,
    );
  } catch (error) {
    console.error("❌ Injection Failed:", error.message);
    process.exit(1);
  }
}

injectConfig();
