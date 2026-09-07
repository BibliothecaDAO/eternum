import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const THREE_WEBGPU_COMPAT_ENTRY = fileURLToPath(new URL("./three-webgpu-compat.ts", import.meta.url));
const require = createRequire(import.meta.url);

export function resolveRendererViteAliases(): Array<{ find: RegExp; replacement: string }> {
  // Mixing the bundled WebGPU core with source WebGL/worker imports creates separate
  // constructors and ColorManagement registries, even when the versions match.
  return [
    { find: /^three$/, replacement: THREE_WEBGPU_COMPAT_ENTRY },
    { find: /^three\/webgpu$/, replacement: require.resolve("three/src/Three.WebGPU.js") },
    { find: /^three\/tsl$/, replacement: require.resolve("three/src/nodes/TSL.js") },
  ];
}
