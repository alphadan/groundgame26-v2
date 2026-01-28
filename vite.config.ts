import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import svgr from "vite-plugin-svgr";
import path from "path";
import fs from "fs"; // <--- Add this import!

export default defineConfig(({ mode }) => {
  // Check if SSL files exist to prevent startup crashes
  const hasCertificates =
    fs.existsSync("./localhost.key") && fs.existsSync("./localhost.crt");

  return {
    plugins: [react(), svgr()],
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
      "process.env": {}, // Provides an empty object for any other process.env calls
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      minify: "terser",
      terserOptions: {
        compress:
          mode === "production"
            ? {
                drop_console: true,
                drop_debugger: true,
              }
            : false,
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              // Split Firebase into its own chunk
              if (id.includes("firebase")) return "vendor-firebase";
              // Split Dexie into its own chunk
              if (id.includes("dexie")) return "vendor-dexie";
              // Everything else in node_modules goes to 'vendor'
              return "vendor";
            }
          },
        },
      },
    },
    server: {
      port: 3000,
      host: "127.0.0.1",
      // Only apply HTTPS if the files actually exist
      https: hasCertificates
        ? {
            key: fs.readFileSync("./localhost.key"),
            cert: fs.readFileSync("./localhost.crt"),
          }
        : undefined,
    },
  };
});
