import type { Chain } from "@contracts";

import type { WorldProfile } from "@/runtime/world/types";

type PlayScene = "map" | "hex" | "travel";
type EntryIntent = "play" | "settle" | "spectate" | "forge";

interface PlayRouteDescriptor {
  chain: Chain;
  worldName: string;
  scene: PlayScene;
  col: number | null;
  row: number | null;
  spectate: boolean;
}

interface EntryRouteDescriptor {
  chain: Chain;
  worldName: string;
  intent: EntryIntent;
  hyperstructuresLeft: number | null;
}

type LocationLike = Pick<Location, "pathname" | "search">;

const CHAIN_VALUES: Chain[] = ["sepolia", "mainnet", "slot", "slottest", "local"];
const PLAY_SCENES: PlayScene[] = ["map", "hex", "travel"];
const ENTRY_INTENTS: EntryIntent[] = ["play", "settle", "spectate", "forge"];

const isValidChain = (value: string): value is Chain => CHAIN_VALUES.includes(value as Chain);
const isPlayScene = (value: string): value is PlayScene => PLAY_SCENES.includes(value as PlayScene);
const isEntryIntent = (value: string): value is EntryIntent => ENTRY_INTENTS.includes(value as EntryIntent);

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

  return {
    chain: rawChain,
    worldName: decodeURIComponent(rawWorldName),
    scene: rawScene,
    col: parseOptionalNumber(searchParams, "col"),
    row: parseOptionalNumber(searchParams, "row"),
    spectate: searchParams.get("spectate") === "true",
  };
};

export const buildPlayHref = (route: PlayRouteDescriptor): string => {
  const searchParams = new URLSearchParams();

  if (route.col !== null) {
    searchParams.set("col", String(route.col));
  }

  if (route.row !== null) {
    searchParams.set("row", String(route.row));
  }

  if (route.spectate) {
    searchParams.set("spectate", "true");
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
    hyperstructuresLeft: parseOptionalNumber(searchParams, "hyperstructuresLeft"),
  };
};

export const buildEntryHref = (route: EntryRouteDescriptor): string => {
  const searchParams = new URLSearchParams();

  if (route.intent !== "play") {
    searchParams.set("intent", route.intent);
  }

  if (route.hyperstructuresLeft !== null) {
    searchParams.set("hyperstructuresLeft", String(route.hyperstructuresLeft));
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
    spectate: searchParams.get("spectate") === "true",
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
    spectate: searchParams.get("spectate") === "true",
  });
};

export const normalizeLegacyPlayLocation = (
  location: LocationLike,
  fallbackWorld?: WorldProfile | null,
): string | null => {
  if (parsePlayRoute(location)) {
    return null;
  }

  return resolveLegacySceneRoute(location, fallbackWorld) ?? resolveLegacyWorldRoute(location, fallbackWorld);
};
