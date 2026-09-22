import { resolveRendererBuildMode, type RendererBuildMode } from "@/three/renderer-build-mode";
import type { GameRef } from "@bibliothecadao/eternum/game-client";

import type { GameProfile } from "@/runtime/world/types";
import { hasSpectateQuery, isExplicitSpectateSession } from "@/utils/spectator-session";

export type PlayScene = "map" | "hex";
type EntryIntent = "play" | "settle" | "spectate";
export type PlayBootMode = "direct" | "map-first";

export interface PlayRouteDescriptor extends GameRef {
  scene: PlayScene;
  col: number | null;
  row: number | null;
  rendererMode?: RendererBuildMode;
  verboseLogs?: boolean;
  bootMode?: PlayBootMode;
  resumeScene?: PlayScene | null;
}

/**
 * A play href carries the spectate flag; the parsed route never does — `utils/spectator-session` owns that fact.
 * A builder that does not say otherwise writes the session's intent, so no navigation can drop it.
 */
type PlayHrefInput = PlayRouteDescriptor & { spectate?: boolean };

interface EntryRouteDescriptor extends GameRef {
  intent: EntryIntent;
  autoSettle: boolean;
}

type LocationLike = Pick<Location, "pathname" | "search">;

const PLAY_SCENES: PlayScene[] = ["map", "hex"];
const ENTRY_INTENTS: EntryIntent[] = ["play", "settle", "spectate"];
const PLAY_BOOT_MODES: PlayBootMode[] = ["direct", "map-first"];

/** A route names a game by its shard's chain id and its id there; anything else is not a game route. */
const parseGameRef = (rawChainId: string, rawGameId: string): GameRef | null => {
  if (!/^0x[0-9a-f]+$/i.test(rawChainId) || !/^[1-9][0-9]*$/.test(rawGameId)) return null;
  const gameId = Number(rawGameId);
  return Number.isSafeInteger(gameId) ? { chainId: rawChainId.toLowerCase(), gameId } : null;
};

const gamePath = (game: GameRef): string => `${game.chainId}/${game.gameId}`;
const isPlayScene = (value: string): value is PlayScene => PLAY_SCENES.includes(value as PlayScene);
const isEntryIntent = (value: string): value is EntryIntent => ENTRY_INTENTS.includes(value as EntryIntent);
const isPlayBootMode = (value: string): value is PlayBootMode => PLAY_BOOT_MODES.includes(value as PlayBootMode);

const parseOptionalNumber = (searchParams: URLSearchParams, key: string): number | null => {
  const value = searchParams.get(key);
  if (value === null || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildSearch = (searchParams: URLSearchParams): string => {
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
};

function parseRendererOptions(
  searchParams: URLSearchParams,
): Pick<PlayRouteDescriptor, "rendererMode" | "verboseLogs"> {
  const rendererMode = searchParams.get("rendererMode");
  return {
    ...(rendererMode ? { rendererMode: resolveRendererBuildMode(rendererMode) } : {}),
    ...(searchParams.get("logs") === "1" ? { verboseLogs: true } : {}),
  };
}

export const parsePlayRoute = (location: LocationLike): PlayRouteDescriptor | null => {
  const match = location.pathname.match(/^\/play\/([^/]+)\/([^/]+)\/([^/]+)\/?$/);
  if (!match) {
    return null;
  }

  const [, rawChainId, rawGameId, rawScene] = match;
  const game = parseGameRef(rawChainId, rawGameId);
  if (!game || !isPlayScene(rawScene)) {
    return null;
  }

  const searchParams = new URLSearchParams(location.search);
  const rawBootMode = searchParams.get("boot");
  const bootMode = rawBootMode && isPlayBootMode(rawBootMode) ? rawBootMode : "direct";
  const rawResumeScene = searchParams.get("resumeScene");
  const resumeScene = bootMode === "map-first" && rawResumeScene && isPlayScene(rawResumeScene) ? rawResumeScene : null;

  return {
    ...parseRendererOptions(searchParams),
    ...game,
    scene: rawScene,
    col: parseOptionalNumber(searchParams, "col"),
    row: parseOptionalNumber(searchParams, "row"),
    bootMode,
    resumeScene,
  };
};

export const buildPlayHref = (route: PlayHrefInput): string => {
  const spectate = route.spectate ?? isExplicitSpectateSession();
  const bootMode = route.bootMode ?? "direct";
  const resumeScene = bootMode === "map-first" ? (route.resumeScene ?? null) : null;
  const searchParams = new URLSearchParams();

  if (route.col !== null) {
    searchParams.set("col", String(route.col));
  }

  if (route.row !== null) {
    searchParams.set("row", String(route.row));
  }

  if (spectate) {
    searchParams.set("spectate", "true");
  }

  if (bootMode === "map-first") {
    searchParams.set("boot", bootMode);
  }

  if (bootMode === "map-first" && resumeScene) {
    searchParams.set("resumeScene", resumeScene);
  }

  if (route.rendererMode) searchParams.set("rendererMode", route.rendererMode);
  if (route.verboseLogs) searchParams.set("logs", "1");

  return `/play/${gamePath(route)}/${route.scene}${buildSearch(searchParams)}`;
};

export const parseEntryRoute = (location: LocationLike): EntryRouteDescriptor | null => {
  const match = location.pathname.match(/^\/enter\/([^/]+)\/([^/]+)\/?$/);
  if (!match) {
    return null;
  }

  const [, rawChainId, rawGameId] = match;
  const game = parseGameRef(rawChainId, rawGameId);
  if (!game) {
    return null;
  }

  const searchParams = new URLSearchParams(location.search);
  const intent = searchParams.get("intent") ?? "play";
  if (!isEntryIntent(intent)) {
    return null;
  }

  return {
    ...game,
    intent,
    autoSettle: searchParams.get("autoSettle") === "true",
  };
};

export const buildEntryHref = (route: EntryRouteDescriptor): string => {
  const searchParams = new URLSearchParams();

  if (route.intent !== "play") {
    searchParams.set("intent", route.intent);
  }

  if (route.autoSettle) {
    searchParams.set("autoSettle", "true");
  }

  return `/enter/${gamePath(route)}${buildSearch(searchParams)}`;
};

const resolveLegacySceneRoute = (location: LocationLike, fallbackWorld?: GameProfile | null): string | null => {
  const sceneMatch = location.pathname.match(/^\/play\/(map|hex|travel)\/?$/);
  if (!sceneMatch || !fallbackWorld) {
    return null;
  }

  const scene = sceneMatch[1] as PlayScene;
  const searchParams = new URLSearchParams(location.search);

  return buildPlayHref({
    ...parseRendererOptions(searchParams),
    chainId: fallbackWorld.chainId,
    gameId: fallbackWorld.gameId,
    scene,
    col: parseOptionalNumber(searchParams, "col"),
    row: parseOptionalNumber(searchParams, "row"),
    spectate: hasSpectateQuery(location.search),
    bootMode: "direct",
    resumeScene: null,
  });
};

const resolveBareSceneRoute = (location: LocationLike, fallbackWorld?: GameProfile | null): string | null => {
  const sceneMatch = location.pathname.match(/^\/(map|hex|travel)\/?$/);
  if (!sceneMatch || !fallbackWorld) {
    return null;
  }

  const scene = sceneMatch[1] as PlayScene;
  const searchParams = new URLSearchParams(location.search);

  return buildPlayHref({
    ...parseRendererOptions(searchParams),
    chainId: fallbackWorld.chainId,
    gameId: fallbackWorld.gameId,
    scene,
    col: parseOptionalNumber(searchParams, "col"),
    row: parseOptionalNumber(searchParams, "row"),
    spectate: hasSpectateQuery(location.search),
    bootMode: "direct",
    resumeScene: null,
  });
};

export const normalizeLegacyPlayLocation = (
  location: LocationLike,
  fallbackWorld?: GameProfile | null,
): string | null => {
  if (parsePlayRoute(location)) {
    return null;
  }

  return resolveLegacySceneRoute(location, fallbackWorld) ?? resolveBareSceneRoute(location, fallbackWorld);
};
