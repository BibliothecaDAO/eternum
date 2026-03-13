import { fileURLToPath } from "node:url";
import { usesExperimentalWebGPUThreeBuild, type RendererBuildMode } from "./renderer-build-mode";

const THREE_WEBGPU_COMPAT_ENTRY = fileURLToPath(new URL("./three-webgpu-compat.ts", import.meta.url));

export function resolveRendererViteAlias(
  mode: RendererBuildMode,
): { find: RegExp; replacement: string } | undefined {
  if (!usesExperimentalWebGPUThreeBuild(mode)) {
    return undefined;
  }

  return {
    find: /^three$/,
    replacement: THREE_WEBGPU_COMPAT_ENTRY,
  };
}
