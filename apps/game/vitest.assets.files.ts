/**
 * Checks that decode shipped assets or run a real build: their own step in the client workflow and in the deploy, kept
 * out of the main suite (they were half of its time).
 */
export const ASSET_CHECK_FILES = [
  "src/three/terrain/terrain-prop-pool-capacity.test.ts",
  "src/three/characters/ships/ship-design.test.ts",
  "src/three/constants/army-plate-height.test.ts",
  "src/three/scenes/hexception-building-assets.test.ts",
  "src/three/characters/t1-knight-default-exports.test.ts",
  "src/three/renderer-vite-config.test.ts",
  "scripts/**/*.test.mjs",
];

/** The client deploy's own checks: plain node:test, run by the client workflow, not the asset run. */
export const CLIENT_DEPLOY_CHECK_FILES = [
  "scripts/check-map-client-isolation.test.mjs",
  "scripts/ensure-pwa-cache-rule.test.mjs",
  "scripts/verify-client-deployment.test.mjs",
  "scripts/verify-pwa-build.test.mjs",
];
