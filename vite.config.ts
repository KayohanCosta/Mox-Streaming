import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/redecanais": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        timeout: 180000,
        proxyTimeout: 180000,
        rewrite: (path) => path.replace(/^\/redecanais/, ""),
      },
      "/iptv": {
        target: "http://dgon.me",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/iptv/, "/get.php"),
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
