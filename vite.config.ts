import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: mode === "development" && process.env.VITE_ADDON_LOCAL_TEST === "1" ? "127.0.0.1" : "::",
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
      "/addon-local": {
        target: "http://127.0.0.1:8791",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/addon-local/, ""),
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
