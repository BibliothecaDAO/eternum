import type { GameRef } from "@bibliothecadao/eternum/game-client";

import { gameKey } from "@/runtime/world/store";
import { resolveSpectateIntent } from "@/utils/spectator-session";
import {
  buildEntryHref,
  buildPlayHref,
  parseEntryRoute,
  parsePlayRoute,
  type PlayScene,
} from "@/play/navigation/play-route";

export type EntryIntent = "play" | "settle" | "spectate";

type LocationLike = Pick<Location, "pathname" | "search">;

export interface ResolvedEntryContext extends GameRef {
  intent: EntryIntent;
  autoSettle: boolean;
  source: "landing" | "play-route";
}

interface LandingSelectionEntryContextInput {
  selection: GameRef;
  intent: EntryIntent;
  autoSettle?: boolean;
}

interface BuildPlayRouteFromEntryContextInput {
  context: ResolvedEntryContext;
  scene?: PlayScene;
  col?: number | null;
  row?: number | null;
  spectate?: boolean;
}

export const resolveEntryContextCacheKey = (context: GameRef): string => gameKey(context);

const resolveFallbackScene = (intent: EntryIntent): PlayScene => {
  return intent === "spectate" ? "map" : "hex";
};

const resolveSpectateFlag = (intent: EntryIntent): boolean => {
  return intent === "spectate";
};

export const resolveEntryContextFromLandingSelection = ({
  selection,
  intent,
  autoSettle = false,
}: LandingSelectionEntryContextInput): ResolvedEntryContext => {
  return {
    chainId: selection.chainId,
    gameId: selection.gameId,
    intent,
    autoSettle,
    source: "landing",
  };
};

export const resolveEntryContextFromEntryRoute = (location: LocationLike): ResolvedEntryContext | null => {
  const route = parseEntryRoute(location);
  if (!route) {
    return null;
  }

  return {
    chainId: route.chainId,
    gameId: route.gameId,
    intent: route.intent,
    autoSettle: route.autoSettle,
    source: "landing",
  };
};

export const resolveEntryContextFromPlayRoute = (location: LocationLike): ResolvedEntryContext | null => {
  const route = parsePlayRoute(location);
  if (!route) {
    return null;
  }

  return {
    chainId: route.chainId,
    gameId: route.gameId,
    intent: resolveSpectateIntent(location) ? "spectate" : "play",
    autoSettle: false,
    source: "play-route",
  };
};

export const buildEntryHrefFromEntryContext = (context: ResolvedEntryContext): string => {
  return buildEntryHref({
    chainId: context.chainId,
    gameId: context.gameId,
    intent: context.intent,
    autoSettle: context.autoSettle,
  });
};

export const buildPlayRouteFromEntryContext = ({
  context,
  scene = resolveFallbackScene(context.intent),
  col = null,
  row = null,
  spectate = resolveSpectateFlag(context.intent),
}: BuildPlayRouteFromEntryContextInput): string => {
  return buildPlayHref({
    chainId: context.chainId,
    gameId: context.gameId,
    scene,
    col,
    row,
    spectate,
  });
};
