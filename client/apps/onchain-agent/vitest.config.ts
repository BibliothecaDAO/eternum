import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@bibliothecadao/game-agent": path.resolve(__dirname, "../../../packages/game-agent/src/index.ts"),
      "@mariozechner/pi-agent-core": path.resolve(__dirname, "../../../packages/pi-mono/packages/agent/src/index.ts"),
      "@mariozechner/pi-ai": path.resolve(__dirname, "../../../packages/pi-mono/packages/ai/src/index.ts"),
      "@mariozechner/pi-tui": path.resolve(__dirname, "../../../packages/pi-mono/packages/tui/src/index.ts"),
      "@mariozechner/pi-coding-agent": path.resolve(
        __dirname,
        "../../../packages/pi-mono/packages/coding-agent/src/index.ts",
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
