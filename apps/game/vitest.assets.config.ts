import { defineConfig } from "vitest/config";
import { ASSET_CHECK_FILES } from "./vitest.assets.files";
import baseConfig from "./vitest.config";

/** The asset and CLI checks the PR gate skips; same environment, aliases and setup as the main suite. */
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ASSET_CHECK_FILES,
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
