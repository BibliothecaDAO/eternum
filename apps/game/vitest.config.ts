import react from "@vitejs/plugin-react";
import path from "path";
import wasm from "vite-plugin-wasm";
import { defineConfig } from "vitest/config";
import { ASSET_CHECK_FILES } from "./vitest.assets.files";

/** Every client test file's setup, whatever pool runs it. */
export const CLIENT_TEST_SETUP = "./src/setupTests.ts";

function workerCap(cap: string | undefined) {
  return cap ? { maxWorkers: Number(cap), minWorkers: 1 } : {};
}

export default defineConfig({
  plugins: [react(), wasm()],
  test: {
    // The asset and CLI checks run through vitest.assets.config.ts (`pnpm verify:assets`) where the artefacts
    // they check are produced; the PR gate stays a behaviour suite.
    exclude: ["**/node_modules/**", "**/dist/**", ...ASSET_CHECK_FILES],
    env: {
    },
    globals: true,
    // The shared machine caps test workers with VITEST_MAX_WORKERS, which vitest 2 does not read (only
    // VITEST_MAX_FORKS/THREADS), so local runs took every core but one. Unset, as on CI, vitest keeps its default.
    ...workerCap(process.env.VITEST_MAX_WORKERS),
    // Each file gets a fresh vm context in a long-lived worker instead of a fresh process: spawning a process,
    // loading vitest and building jsdom for each of ~940 files was most of the suite's time. A vm context keeps
    // what it loaded until the worker ends, so a worker past the limit is replaced (4 workers peaked at 10.6 GB
    // summed RSS without it, 6.8 GB with it).
    pool: "vmThreads",
    poolOptions: { vmThreads: { memoryLimit: "1GB" } },
    // A test's `window` is jsdom's own here, so jsdom's requestAnimationFrame no longer runs on the faked setTimeout:
    // frames advance with the fake clock only when faked by name.
    fakeTimers: {
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "setImmediate",
        "clearImmediate",
        "Date",
        "requestAnimationFrame",
        "cancelAnimationFrame",
      ],
    },
    environment: "jsdom",
    environmentMatchGlobs: [
      ["src/three/**/*.test.ts", "node"],
      ["src/three/**/__tests__/*.test.ts", "node"],
      ["scripts/**/*.test.mjs", "node"],
    ],
    // The vm pool's file boundary comes after the common setup, which gives jsdom its performance timeline.
    setupFiles: [CLIENT_TEST_SETUP, "./src/test-isolation/file-boundary.setup.ts"],
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
    // react-router-dom names its ESM build only under Node's `module-sync` condition, which Vite 5 does not set, and
    // a vm context cannot load the CommonJS build it falls back to (that build requires an .mjs file).
    conditions: ["module-sync"],
    alias: {
      // As in vite.config.ts: public assets precede the source root, since alias matching is first-match.
      "@/assets": path.resolve(__dirname, "./public/assets"),
      "@": path.resolve(__dirname, "./src"),
      "@config": path.resolve(__dirname, "../../config/utils/utils"),
      "@config-deployer": path.resolve(__dirname, "../../config/deployer"),
      // Subpath alias must precede the package root: alias matching is
      // prefix-based, so the root entry would otherwise swallow it.
      "@bibliothecadao/eternum/game-entity-keys": path.resolve(
        __dirname,
        "../../packages/core/src/managers/game-entity-keys.ts",
      ),
      "@bibliothecadao/eternum/automation": path.resolve(__dirname, "../../packages/core/src/automation/index.ts"),
      "@bibliothecadao/eternum/game-sync": path.resolve(__dirname, "../../packages/core/src/sync/index.ts"),
      "@bibliothecadao/eternum/game-client": path.resolve(__dirname, "../../packages/core/src/client/index.ts"),
      "@bibliothecadao/eternum/shard": path.resolve(__dirname, "../../packages/core/src/client/shard-reader.ts"),
      "@bibliothecadao/eternum/biome": path.resolve(__dirname, "../../packages/core/src/utils/biome/biome.ts"),
      "@bibliothecadao/eternum/troop-stamina": path.resolve(
        __dirname,
        "../../packages/core/src/managers/troop-stamina.ts",
      ),
      "@bibliothecadao/eternum/expeditions": path.resolve(__dirname, "../../packages/core/src/utils/expeditions.ts"),
      "@bibliothecadao/eternum": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      // Subpath alias must precede the package root: alias matching is
      // prefix-based, so the root entry would otherwise swallow it.
      "@bibliothecadao/provider/errors": path.resolve(
        __dirname,
        "../../packages/provider/src/classify-transaction-error.ts",
      ),
      "@bibliothecadao/provider": path.resolve(__dirname, "../../packages/provider/src/index.ts"),
      "@bibliothecadao/types/terrain": path.resolve(__dirname, "../../packages/types/src/terrain.ts"),
      "@bibliothecadao/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
      "@pm": path.resolve(__dirname, "./src/pm"),
      "@videos": path.resolve(__dirname, "./src/assets/videos"),
    },
  },
});
