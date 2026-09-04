const RENDERER_BUILD_MODES = ["webgpu-auto", "webgpu-force-webgl"] as const;

export type RendererBuildMode = (typeof RENDERER_BUILD_MODES)[number];

export const DEFAULT_RENDERER_BUILD_MODE: RendererBuildMode = "webgpu-auto";

const RENDERER_MODE_QUERY_PARAM = "rendererMode";
const VERBOSE_LOGS_QUERY_PARAM = "logs";
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

/** Builds a reload URL for an explicit renderer trial and turns on the diagnostics emitted during that boot. */
export function buildRendererDebugUrl(href: string, mode: RendererBuildMode): string {
  const url = new URL(href);
  url.searchParams.set(RENDERER_MODE_QUERY_PARAM, mode);
  url.searchParams.set(VERBOSE_LOGS_QUERY_PARAM, "1");
  return url.toString();
}

export function removeRetiredRendererModePreference(storage: Pick<Storage, "removeItem"> | null): void {
  storage?.removeItem(RETIRED_RENDERER_MODE_STORAGE_KEY);
}
