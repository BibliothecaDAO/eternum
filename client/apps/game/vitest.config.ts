import react from "@vitejs/plugin-react";
import path from "path";
import wasm from "vite-plugin-wasm";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), wasm()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    css: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@bibliothecadao/eternum": path.resolve(__dirname, "../../../packages/core/src/index.ts"),
      "@bibliothecadao/react": path.resolve(__dirname, "../../../packages/react/src/index.ts"),
      "@bibliothecadao/types": path.resolve(__dirname, "../../../packages/types/src/index.ts"),
    },
  },
});
