import { fileURLToPath } from "node:url";

const THREE_WEBGPU_COMPAT_ENTRY = fileURLToPath(new URL("./three-webgpu-compat.ts", import.meta.url));

export function resolveRendererViteAlias(): { find: RegExp; replacement: string } {
  return {
    find: /^three$/,
    replacement: THREE_WEBGPU_COMPAT_ENTRY,
  };
}
