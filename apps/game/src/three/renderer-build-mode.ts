const RENDERER_BUILD_MODES = ["webgpu-auto", "webgpu-force-webgl"] as const;

export type RendererBuildMode = (typeof RENDERER_BUILD_MODES)[number];

export const DEFAULT_RENDERER_BUILD_MODE: RendererBuildMode = "webgpu-auto";

const RENDERER_MODE_QUERY_PARAM = "rendererMode";
/** The renderer the player chose in Settings, read when the game loads. */
const RENDERER_PREFERENCE_STORAGE_KEY = "eternum-renderer";
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

/**
 * The renderer a page load asks for: the address's (a trial from the boot screen, a recovery after a lost device), else
 * the one the player saved in Settings, else the build's.
 */
export function resolveRendererBuildModeFromSearch(input: {
  envBuildMode: RendererBuildMode;
  saved: RendererBuildMode | null;
  search: string;
}): RendererBuildMode {
  const queryValue = new URLSearchParams(input.search).get(RENDERER_MODE_QUERY_PARAM);
  return queryValue ? resolveRendererBuildMode(queryValue) : (input.saved ?? input.envBuildMode);
}

/** The renderer saved in Settings; none until the player chooses one. */
export function readRendererPreference(storage: Pick<Storage, "getItem"> | null): RendererBuildMode | null {
  const value = storage?.getItem(RENDERER_PREFERENCE_STORAGE_KEY);
  return value && isRendererBuildMode(value) ? value : null;
}

export function writeRendererPreference(storage: Pick<Storage, "setItem">, mode: RendererBuildMode): void {
  storage.setItem(RENDERER_PREFERENCE_STORAGE_KEY, mode);
}

/** True when the URL overrides the configured renderer mode. */
export function hasExplicitRendererMode(search: string): boolean {
  return new URLSearchParams(search).has(RENDERER_MODE_QUERY_PARAM);
}

/** Preserve the match, camera route and spectator intent when rebuilding after device loss. */
export function buildRendererRecoveryUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.set(RENDERER_MODE_QUERY_PARAM, "webgpu-force-webgl");
  return url.toString();
}

/** The same page asking for `mode`: its match, camera route and spectator intent kept. */
export function buildRendererUrl(href: string, mode: RendererBuildMode): string {
  const url = new URL(href);
  url.searchParams.set(RENDERER_MODE_QUERY_PARAM, mode);
  return url.toString();
}

/** Builds a reload URL for an explicit renderer trial and turns on the diagnostics emitted during that boot. */
export function buildRendererDebugUrl(href: string, mode: RendererBuildMode): string {
  const url = new URL(buildRendererUrl(href, mode));
  url.searchParams.set(VERBOSE_LOGS_QUERY_PARAM, "1");
  return url.toString();
}

export function removeRetiredRendererModePreference(storage: Pick<Storage, "removeItem"> | null): void {
  storage?.removeItem(RETIRED_RENDERER_MODE_STORAGE_KEY);
}
