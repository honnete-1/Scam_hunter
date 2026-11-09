import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development Vite forwards API and admin requests to Django, so no CORS setup is needed.
const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": backend,
      "/admin": backend,
      "/static": backend,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
  },
});
