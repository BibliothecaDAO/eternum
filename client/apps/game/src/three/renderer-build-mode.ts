export const RENDERER_BUILD_MODES = [
  "legacy-webgl",
  "experimental-webgpu-auto",
  "experimental-webgpu-force-webgl",
] as const;

export type RendererBuildMode = (typeof RENDERER_BUILD_MODES)[number];

export const DEFAULT_RENDERER_BUILD_MODE: RendererBuildMode = "legacy-webgl";

const RENDERER_MODE_QUERY_PARAM = "rendererMode";

function isRendererBuildMode(value: string): value is RendererBuildMode {
  return (RENDERER_BUILD_MODES as readonly string[]).includes(value);
}

export function resolveRendererBuildMode(value: string | undefined): RendererBuildMode {
  if (!value) {
    return DEFAULT_RENDERER_BUILD_MODE;
  }

  return isRendererBuildMode(value) ? value : DEFAULT_RENDERER_BUILD_MODE;
}

export function usesExperimentalWebGPUThreeBuild(mode: RendererBuildMode): boolean {
  return mode !== "legacy-webgl";
}

export function resolveThreeEntryPoint(mode: RendererBuildMode): "three" | "three/webgpu" {
  return usesExperimentalWebGPUThreeBuild(mode) ? "three/webgpu" : "three";
}

export function resolveRendererBuildModeFromSearch(input: {
  envBuildMode: RendererBuildMode;
  search: string;
}): RendererBuildMode {
  const queryValue = new URLSearchParams(input.search).get(RENDERER_MODE_QUERY_PARAM);
  const requestedMode = resolveRendererBuildMode(queryValue ?? undefined);

  if (!usesExperimentalWebGPUThreeBuild(input.envBuildMode)) {
    return input.envBuildMode;
  }

  if (!usesExperimentalWebGPUThreeBuild(requestedMode)) {
    return input.envBuildMode;
  }

  return requestedMode;
}
