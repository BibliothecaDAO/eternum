import { resolveThreeEntryPoint, type RendererBuildMode } from "./renderer-build-mode";

export function resolveRendererViteAlias(
  mode: RendererBuildMode,
): { find: RegExp; replacement: string } | undefined {
  const replacement = resolveThreeEntryPoint(mode);

  if (replacement === "three") {
    return undefined;
  }

  return {
    find: /^three$/,
    replacement,
  };
}
