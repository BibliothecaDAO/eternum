import { defineConfig, splitVendorChunkPlugin } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svgr(), react(), wasm(), topLevelAwait(), splitVendorChunkPlugin()],
  resolve: {
    alias: {
      events: "events",
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        map: resolve(__dirname, "map/index.html"),
        realm: resolve(__dirname, "realm/index.html"),
      },
    },
  },
  optimizeDeps: {
    exclude: ["js-big-decimal"],
  },
});
