import { defineConfig } from "vitest/config";
import { ASSET_CHECK_FILES, CLIENT_DEPLOY_CHECK_FILES } from "./vitest.assets.files";
import baseConfig, { CLIENT_TEST_SETUP } from "./vitest.config";

/** The asset and CLI checks the PR gate skips; same environment, aliases and common setup as the main suite. */
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ASSET_CHECK_FILES,
    exclude: ["**/node_modules/**", "**/dist/**", ...CLIENT_DEPLOY_CHECK_FILES],
    // Few files, each a long decode or build: a process per file costs them nothing, and a vm context ran them 5×
    // slower (19 s → 93 s) and could not load the CLI scripts' ES modules.
    pool: "forks",
    // A process per file needs none of the vm pool's file boundary.
    setupFiles: [CLIENT_TEST_SETUP],
  },
});
