import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_PORT = Number(process.env["JUDG3D_APP_PORT"] ?? "8787");

export default defineConfig({
  plugins: [react()],
  root: ".",
  publicDir: "ui/public",
  build: {
    outDir: "client-dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${String(API_PORT)}`,
        changeOrigin: true,
      },
    },
  },
});
