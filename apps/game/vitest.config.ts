import react from "@vitejs/plugin-react";
import path from "path";
import wasm from "vite-plugin-wasm";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), wasm()],
  test: {
    // A handful of load-sensitive files (instanced-model, game-entry-preload,
    // play-asset-manifest) time out under full-suite parallelism but pass in
    // isolation. One CI retry turns those known flakes from an 11-minute job
    // rerun into a few retried seconds; locally failures stay loud.
    retry: process.env.CI ? 1 : 0,
    env: {
      VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH: "0x0000000000000000000000000000000000000002",
      VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS: "0x0000000000000000000000000000000000000003",
      VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS: "0x0000000000000000000000000000000000000004",
      VITE_PUBLIC_FEE_TOKEN_ADDRESS: "0x0000000000000000000000000000000000000001",
      VITE_PUBLIC_NODE_URL: "https://rpc.realms.test/rpc/v0_9_0",
      VITE_PUBLIC_HERALD_URL: "https://herald.realms.test",
      VITE_PUBLIC_IDENTITY_ORIGIN: "https://realms.test",
      VITE_PUBLIC_IDENTITY_RPC_URL: "https://identity-rpc.realms.test",
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
      "@config": path.resolve(__dirname, "../../config/utils/utils"),
      "@config-deployer": path.resolve(__dirname, "../../config/deployer"),
      "@contracts": path.resolve(__dirname, "../../contracts/utils/utils"),
      "@bibliothecadao/amm-sdk": path.resolve(__dirname, "../../packages/amm-sdk/src/index.ts"),
      "@bibliothecadao/ammv2-sdk": path.resolve(__dirname, "../../packages/ammv2-sdk/src/index.ts"),
      "@bibliothecadao/client": path.resolve(__dirname, "../../packages/client/src/index.ts"),
      // Subpath alias must precede the package root: alias matching is
      // prefix-based, so the root entry would otherwise swallow it.
      "@bibliothecadao/eternum/game-entity-keys": path.resolve(
        __dirname,
        "../../packages/core/src/managers/game-entity-keys.ts",
      ),
      "@bibliothecadao/eternum/game-sync": path.resolve(__dirname, "../../packages/core/src/sync/index.ts"),
      "@bibliothecadao/eternum": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      // Subpath alias must precede the package root: alias matching is
      // prefix-based, so the root entry would otherwise swallow it.
      "@bibliothecadao/provider/errors": path.resolve(
        __dirname,
        "../../packages/provider/src/classify-transaction-error.ts",
      ),
      "@bibliothecadao/provider": path.resolve(__dirname, "../../packages/provider/src/index.ts"),
      "@bibliothecadao/react": path.resolve(__dirname, "../../packages/react/src/index.ts"),
      "@bibliothecadao/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
      "@manifests": path.resolve(__dirname, "../../contracts/game"),
      "@pm": path.resolve(__dirname, "./src/pm"),
      "@videos": path.resolve(__dirname, "./src/assets/videos"),
    },
  },
});
