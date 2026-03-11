import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Workspace packages whose dist/ may not be built yet.
      // Point directly at their TypeScript source so Vitest can resolve them
      // when tests mock them with vi.mock.
      "@bibliothecadao/torii": path.resolve(__dirname, "../torii/src/index.ts"),
      "@bibliothecadao/provider": path.resolve(__dirname, "../provider/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/types/**", "src/config.ts"],
    },
  },
});
