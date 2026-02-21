import react from "@vitejs/plugin-react";
import path from "path";
import wasm from "vite-plugin-wasm";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), wasm()],
  test: {
    globals: true,
    environment: "jsdom",
    environmentMatchGlobs: [
      ["src/three/**/*.test.ts", "node"],
      ["src/three/**/__tests__/*.test.ts", "node"],
    ],
    setupFiles: "./src/setupTests.ts",
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/three/**/*.{ts,tsx}"],
      exclude: ["src/three/**/*.test.ts", "src/three/**/__tests__/*.test.ts", "src/three/docs/**"],
      thresholds: {
        lines: 15,
        functions: 40,
        branches: 60,
        statements: 15,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@bibliothecadao/eternum": path.resolve(__dirname, "../../../packages/core/src/index.ts"),
      "@bibliothecadao/react": path.resolve(__dirname, "../../../packages/react/src/index.ts"),
      "@bibliothecadao/types": path.resolve(__dirname, "../../../packages/types/src/index.ts"),
      "@manifests": path.resolve(__dirname, "../../../contracts/game"),
    },
  },
});
