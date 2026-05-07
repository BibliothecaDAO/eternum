import react from "@vitejs/plugin-react";
import path from "path";
import wasm from "vite-plugin-wasm";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), wasm()],
  test: {
    env: {
      VITE_PUBLIC_MASTER_ADDRESS: "0x0000000000000000000000000000000000000001",
      VITE_PUBLIC_MASTER_PRIVATE_KEY: "0x0000000000000000000000000000000000000001",
      VITE_PUBLIC_ACCOUNT_CLASS_HASH: "0x0000000000000000000000000000000000000001",
      VITE_PUBLIC_FEE_TOKEN_ADDRESS: "0x0000000000000000000000000000000000000001",
      VITE_PUBLIC_CLIENT_FEE_RECIPIENT: "0x0000000000000000000000000000000000000001",
      VITE_PUBLIC_SLOT: "test-slot",
    },
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
      "@config": path.resolve(__dirname, "../../../config/utils/utils"),
      "@config-deployer": path.resolve(__dirname, "../../../config/deployer"),
      "@contracts": path.resolve(__dirname, "../../../contracts/utils/utils"),
      "@bibliothecadao/amm-sdk": path.resolve(__dirname, "../../../packages/amm-sdk/src/index.ts"),
      "@bibliothecadao/ammv2-sdk": path.resolve(__dirname, "../../../packages/ammv2-sdk/src/index.ts"),
      "@bibliothecadao/client": path.resolve(__dirname, "../../../packages/client/src/index.ts"),
      "@bibliothecadao/eternum": path.resolve(__dirname, "../../../packages/core/src/index.ts"),
      "@bibliothecadao/provider": path.resolve(__dirname, "../../../packages/provider/src/index.ts"),
      "@bibliothecadao/react": path.resolve(__dirname, "../../../packages/react/src/index.ts"),
      "@bibliothecadao/torii": path.resolve(__dirname, "../../../packages/torii/src/index.ts"),
      "@bibliothecadao/types": path.resolve(__dirname, "../../../packages/types/src/index.ts"),
      "@manifests": path.resolve(__dirname, "../../../contracts/game"),
      "@pm": path.resolve(__dirname, "./src/pm"),
      "@videos": path.resolve(__dirname, "./src/assets/videos"),
    },
  },
});
