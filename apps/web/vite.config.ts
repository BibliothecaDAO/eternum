import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart({
      target: "vercel",
    }),
    svgr({
      include: "**/*.svg?react",
    }),
  ],
  resolve: {
    // Use react-dom/server.edge instead of react-dom/server.browser for React 19.
    // Without this, MessageChannel from node:worker_threads needs to be polyfilled.
    alias: {
      "react-dom/server": "react-dom/server.edge",
    },
  },
});
