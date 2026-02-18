import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@bibliothecadao/game-agent": path.resolve(__dirname, "../../../packages/game-agent/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
