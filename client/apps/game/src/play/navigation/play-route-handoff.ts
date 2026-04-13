import type { Chain } from "@contracts";

import { parsePlayRoute, type PlayScene } from "./play-route";

const PLAY_ROUTE_HANDOFF_STORAGE_KEY = "eternum:play-route-handoff";
const PLAY_ROUTE_HANDOFF_TTL_MS = 60_000;

interface PlayRouteHandoffTarget {
  chain: Chain;
  worldName: string;
  scene: PlayScene;
  col: number | null;
  row: number | null;
  spectate: boolean;
}

interface PersistedPlayRouteHandoff extends PlayRouteHandoffTarget {
  createdAt: number;
}

const readSessionStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const matchesRoute = (left: PlayRouteHandoffTarget, right: PlayRouteHandoffTarget): boolean => {
  return (
    left.chain === right.chain &&
    left.worldName === right.worldName &&
    left.scene === right.scene &&
    left.col === right.col &&
    left.row === right.row &&
    left.spectate === right.spectate
  );
};

const isFreshHandoff = (handoff: PersistedPlayRouteHandoff): boolean => {
  return Date.now() - handoff.createdAt <= PLAY_ROUTE_HANDOFF_TTL_MS;
};

const clearPlayRouteHandoff = () => {
  const storage = readSessionStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(PLAY_ROUTE_HANDOFF_STORAGE_KEY);
};

const parsePersistedHandoff = (): PersistedPlayRouteHandoff | null => {
  const storage = readSessionStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(PLAY_ROUTE_HANDOFF_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PersistedPlayRouteHandoff;
  } catch {
    clearPlayRouteHandoff();
    return null;
  }
};

const resolveLocationLikeFromHref = (href: string): Pick<Location, "pathname" | "search"> | null => {
  try {
    const url = new URL(href, "https://realms.invalid");
    return {
      pathname: url.pathname,
      search: url.search,
    };
  } catch {
    return null;
  }
};

export const recordPlayRouteHandoff = (target: PlayRouteHandoffTarget): void => {
  const storage = readSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(
    PLAY_ROUTE_HANDOFF_STORAGE_KEY,
    JSON.stringify({
      ...target,
      createdAt: Date.now(),
    } satisfies PersistedPlayRouteHandoff),
  );
};

export const recordPlayRouteHandoffFromHref = (href: string): void => {
  const location = resolveLocationLikeFromHref(href);
  if (!location) {
    return;
  }

  const route = parsePlayRoute(location);
  if (!route) {
    return;
  }

  recordPlayRouteHandoff(route);
};

export const consumePlayRouteHandoff = (target: PlayRouteHandoffTarget): boolean => {
  const persisted = parsePersistedHandoff();
  clearPlayRouteHandoff();

  if (!persisted || !isFreshHandoff(persisted)) {
    return false;
  }

  return matchesRoute(persisted, target);
};
