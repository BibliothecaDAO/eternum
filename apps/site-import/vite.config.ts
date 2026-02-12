import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }

          if (id.includes("@tanstack")) {
            return "tanstack-vendor";
          }

          if (id.includes("framer-motion") || id.includes("/motion/")) {
            return "motion-vendor";
          }

          if (id.includes("recharts") || id.includes("d3-")) {
            return "charts-vendor";
          }

          if (
            id.includes("@starknet-react") ||
            id.includes("/starknet/") ||
            id.includes("/ox/")
          ) {
            return "starknet-vendor";
          }

          if (id.includes("/three/")) {
            return "three-vendor";
          }
        },
      },
    },
  },
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    svgr(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
