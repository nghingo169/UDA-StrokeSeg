import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  base: "/",
  build: { sourcemap: false, minify: true },
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    fs: { allow: [path.resolve(__dirname, "../..")] },
    host: "0.0.0.0",
    port: parseInt(process.env.PORT || "8443"),
    strictPort: true,
    allowedHosts: true,
    watch: { awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 100 } },
    proxy: {
      "/api": {
        target: process.env.UDA_API_PROXY || "http://127.0.0.1:8000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: { host: "0.0.0.0", port: parseInt(process.env.PORT || "8443") },
});
