import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function resolveRendererViteAliases(): Array<{ find: RegExp; replacement: string }> {
  // Mixing the bundled WebGPU core with direct source/worker imports creates separate
  // constructors and ColorManagement registries, even when the versions match.
  return [
    { find: /^three(?:\/webgpu)?$/, replacement: require.resolve("three/src/Three.WebGPU.js") },
    { find: /^three\/tsl$/, replacement: require.resolve("three/src/nodes/TSL.js") },
  ];
}
