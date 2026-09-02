const RENDERER_BUILD_MODES = ["webgpu-auto", "webgpu-force-webgl"] as const;

export type RendererBuildMode = (typeof RENDERER_BUILD_MODES)[number];

export const DEFAULT_RENDERER_BUILD_MODE: RendererBuildMode = "webgpu-auto";

const RENDERER_MODE_QUERY_PARAM = "rendererMode";
const RETIRED_RENDERER_MODE_STORAGE_KEY = "RENDERER_MODE";
const RETIRED_AUTO_MODE = ["experimental", "webgpu", "auto"].join("-");
const RETIRED_FORCE_WEBGL_MODE = ["experimental", "webgpu", "force", "webgl"].join("-");

function isRendererBuildMode(value: string): value is RendererBuildMode {
  return (RENDERER_BUILD_MODES as readonly string[]).includes(value);
}

export function resolveRendererBuildMode(value: string | undefined): RendererBuildMode {
  if (!value || value === RETIRED_AUTO_MODE) {
    return DEFAULT_RENDERER_BUILD_MODE;
  }

  if (value === RETIRED_FORCE_WEBGL_MODE) {
    return "webgpu-force-webgl";
  }

  return isRendererBuildMode(value) ? value : DEFAULT_RENDERER_BUILD_MODE;
}

export function resolveRendererBuildModeFromSearch(input: {
  envBuildMode: RendererBuildMode;
  search: string;
}): RendererBuildMode {
  const queryValue = new URLSearchParams(input.search).get(RENDERER_MODE_QUERY_PARAM);
  return queryValue ? resolveRendererBuildMode(queryValue) : input.envBuildMode;
}

/** True when the URL names a renderer mode, which asks for a fresh lane probe. */
export function hasExplicitRendererMode(search: string): boolean {
  return new URLSearchParams(search).has(RENDERER_MODE_QUERY_PARAM);
}

export function removeRetiredRendererModePreference(storage: Pick<Storage, "removeItem"> | null): void {
  storage?.removeItem(RETIRED_RENDERER_MODE_STORAGE_KEY);
}
