import type { GameRef } from "@bibliothecadao/eternum/game-client";

import { gameKey } from "@/runtime/world/store";
import { resolveSpectateIntent } from "@/utils/spectator-session";
import { buildEntryHref, parseEntryRoute, parsePlayRoute } from "@/play/navigation/play-route";

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

export const resolveEntryContextCacheKey = (context: GameRef): string => gameKey(context);

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
