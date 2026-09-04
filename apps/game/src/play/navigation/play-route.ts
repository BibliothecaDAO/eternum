import type { GameChain as Chain } from "@realms-world/chain";

import type { WorldProfile } from "@/runtime/world/types";
import { hasSpectateQuery, isExplicitSpectateSession } from "@/utils/spectator-session";

export type PlayScene = "map" | "hex" | "travel";
type EntryIntent = "play" | "settle" | "spectate";
export type PlayBootMode = "direct" | "map-first";

export interface PlayRouteDescriptor {
  chain: Chain;
  worldName: string;
  scene: PlayScene;
  col: number | null;
  row: number | null;
  bootMode?: PlayBootMode;
  resumeScene?: PlayScene | null;
}

/**
 * A play href carries the spectate flag; the parsed route never does — `utils/spectator-session` owns that fact.
 * A builder that does not say otherwise writes the session's intent, so no navigation can drop it.
 */
type PlayHrefInput = PlayRouteDescriptor & { spectate?: boolean };

interface EntryRouteDescriptor {
  chain: Chain;
  worldName: string;
  intent: EntryIntent;
  autoSettle: boolean;
}

type LocationLike = Pick<Location, "pathname" | "search">;

const CHAIN_VALUES: Chain[] = ["madara", "appchain"];
const PLAY_SCENES: PlayScene[] = ["map", "hex", "travel"];
const ENTRY_INTENTS: EntryIntent[] = ["play", "settle", "spectate"];
const PLAY_BOOT_MODES: PlayBootMode[] = ["direct", "map-first"];

const isValidChain = (value: string): value is Chain => CHAIN_VALUES.includes(value as Chain);
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

export const parsePlayRoute = (location: LocationLike): PlayRouteDescriptor | null => {
  const match = location.pathname.match(/^\/play\/([^/]+)\/([^/]+)\/([^/]+)\/?$/);
  if (!match) {
    return null;
  }

  const [, rawChain, rawWorldName, rawScene] = match;
  if (!isValidChain(rawChain) || !isPlayScene(rawScene)) {
    return null;
  }

  const searchParams = new URLSearchParams(location.search);
  const rawBootMode = searchParams.get("boot");
  const bootMode = rawBootMode && isPlayBootMode(rawBootMode) ? rawBootMode : "direct";
  const rawResumeScene = searchParams.get("resumeScene");
  const resumeScene = bootMode === "map-first" && rawResumeScene && isPlayScene(rawResumeScene) ? rawResumeScene : null;

  return {
    chain: rawChain,
    worldName: decodeURIComponent(rawWorldName),
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

  return `/play/${route.chain}/${encodeURIComponent(route.worldName)}/${route.scene}${buildSearch(searchParams)}`;
};

export const parseEntryRoute = (location: LocationLike): EntryRouteDescriptor | null => {
  const match = location.pathname.match(/^\/enter\/([^/]+)\/([^/]+)\/?$/);
  if (!match) {
    return null;
  }

  const [, rawChain, rawWorldName] = match;
  if (!isValidChain(rawChain)) {
    return null;
  }

  const searchParams = new URLSearchParams(location.search);
  const intent = searchParams.get("intent") ?? "play";
  if (!isEntryIntent(intent)) {
    return null;
  }

  return {
    chain: rawChain,
    worldName: decodeURIComponent(rawWorldName),
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

  return `/enter/${route.chain}/${encodeURIComponent(route.worldName)}${buildSearch(searchParams)}`;
};

const resolveLegacySceneRoute = (location: LocationLike, fallbackWorld?: WorldProfile | null): string | null => {
  const sceneMatch = location.pathname.match(/^\/play\/(map|hex|travel)\/?$/);
  if (!sceneMatch || !fallbackWorld) {
    return null;
  }

  const scene = sceneMatch[1] as PlayScene;
  const searchParams = new URLSearchParams(location.search);

  return buildPlayHref({
    chain: fallbackWorld.chain,
    worldName: fallbackWorld.name,
    scene,
    col: parseOptionalNumber(searchParams, "col"),
    row: parseOptionalNumber(searchParams, "row"),
    spectate: hasSpectateQuery(location.search),
    bootMode: "direct",
    resumeScene: null,
  });
};

const resolveLegacyWorldRoute = (location: LocationLike, fallbackWorld?: WorldProfile | null): string | null => {
  const worldMatch = location.pathname.match(/^\/play\/([^/]+)\/?$/);
  if (!worldMatch || !fallbackWorld) {
    return null;
  }

  const candidateWorldName = decodeURIComponent(worldMatch[1]);
  if (isPlayScene(candidateWorldName)) {
    return null;
  }

  const searchParams = new URLSearchParams(location.search);

  return buildPlayHref({
    chain: fallbackWorld.chain,
    worldName: candidateWorldName,
    scene: "map",
    col: parseOptionalNumber(searchParams, "col"),
    row: parseOptionalNumber(searchParams, "row"),
    spectate: hasSpectateQuery(location.search),
    bootMode: "direct",
    resumeScene: null,
  });
};

const resolveBareSceneRoute = (location: LocationLike, fallbackWorld?: WorldProfile | null): string | null => {
  const sceneMatch = location.pathname.match(/^\/(map|hex|travel)\/?$/);
  if (!sceneMatch || !fallbackWorld) {
    return null;
  }

  const scene = sceneMatch[1] as PlayScene;
  const searchParams = new URLSearchParams(location.search);

  return buildPlayHref({
    chain: fallbackWorld.chain,
    worldName: fallbackWorld.name,
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
  fallbackWorld?: WorldProfile | null,
): string | null => {
  if (parsePlayRoute(location)) {
    return null;
  }

  return (
    resolveLegacySceneRoute(location, fallbackWorld) ??
    resolveBareSceneRoute(location, fallbackWorld) ??
    resolveLegacyWorldRoute(location, fallbackWorld)
  );
};
