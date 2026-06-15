import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Standalone dev server for the admin panel. `@/…` maps to ./src.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { port: 5180 },
});
