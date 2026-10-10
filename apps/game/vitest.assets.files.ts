/**
 * Checks that decode shipped assets or run a real build: right on the deploy and terrain workflows, too slow
 * for every pull request (they were half of the suite's time).
 */
export const ASSET_CHECK_FILES = [
  "src/three/terrain/terrain-prop-pool-capacity.test.ts",
  "src/three/characters/ships/ship-design.test.ts",
  "src/three/renderer-vite-config.test.ts",
  "scripts/**/*.test.mjs",
];

/** The client deploy's own checks: plain node:test, run by the client workflow, not the asset run. */
export const CLIENT_DEPLOY_CHECK_FILES = [
  "scripts/ensure-pwa-cache-rule.test.mjs",
  "scripts/verify-client-deployment.test.mjs",
  "scripts/verify-pwa-build.test.mjs",
];
