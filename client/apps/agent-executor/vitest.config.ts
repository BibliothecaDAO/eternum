import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@bibliothecadao/types": path.resolve(__dirname, "../../../packages/types/src/index.ts"),
      "@bibliothecadao/agent-runtime": path.resolve(__dirname, "../../../packages/agent-runtime/src/index.ts"),
    },
  },
});
