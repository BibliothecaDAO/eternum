import type { Chain } from "@contracts";

import type { WorldSelectionInput } from "@/runtime/world";
import {
  buildEntryHref,
  buildPlayHref,
  parseEntryRoute,
  parsePlayRoute,
  type PlayScene,
} from "@/play/navigation/play-route";

export type LandingPrimaryChain = "mainnet" | "slot";
export type EntryIntent = "play" | "settle" | "spectate" | "forge";

type LocationLike = Pick<Location, "pathname" | "search">;

export interface ResolvedEntryContext {
  chain: Chain;
  worldName: string;
  worldAddress?: string;
  intent: EntryIntent;
  autoSettle: boolean;
  hyperstructuresLeft: number | null;
  source: "landing" | "play-route";
}

interface LandingSelectionEntryContextInput {
  selection: WorldSelectionInput;
  intent: EntryIntent;
  autoSettle?: boolean;
  hyperstructuresLeft?: number | null;
}

interface BuildPlayRouteFromEntryContextInput {
  context: ResolvedEntryContext;
  scene?: PlayScene;
  col?: number | null;
  row?: number | null;
  spectate?: boolean;
}

export const isLandingPrimaryChain = (chain: Chain | null | undefined): chain is LandingPrimaryChain => {
  return chain === "mainnet" || chain === "slot";
};

export const resolveEntryContextCacheKey = (context: Pick<ResolvedEntryContext, "chain" | "worldName">): string => {
  return `${context.chain}:${context.worldName}`;
};

const resolveFallbackScene = (intent: EntryIntent): PlayScene => {
  return intent === "spectate" ? "map" : "hex";
};

const resolveSpectateFlag = (intent: EntryIntent): boolean => {
  return intent === "spectate";
};

const resolveLandingEntryChain = (chain: Chain | null | undefined): LandingPrimaryChain | null => {
  return isLandingPrimaryChain(chain) ? chain : null;
};

export const resolveEntryContextFromLandingSelection = ({
  selection,
  intent,
  autoSettle = false,
  hyperstructuresLeft = null,
}: LandingSelectionEntryContextInput): ResolvedEntryContext | null => {
  const resolvedChain = resolveLandingEntryChain(selection.chain);
  if (!resolvedChain) {
    return null;
  }

  return {
    chain: resolvedChain,
    worldName: selection.name,
    worldAddress: selection.worldAddress,
    intent,
    autoSettle,
    hyperstructuresLeft,
    source: "landing",
  };
};

export const resolveEntryContextFromEntryRoute = (location: LocationLike): ResolvedEntryContext | null => {
  const route = parseEntryRoute(location);
  if (!route) {
    return null;
  }

  const resolvedChain = resolveLandingEntryChain(route.chain);
  if (!resolvedChain) {
    return null;
  }

  return {
    chain: resolvedChain,
    worldName: route.worldName,
    intent: route.intent,
    autoSettle: route.autoSettle,
    hyperstructuresLeft: route.hyperstructuresLeft,
    source: "landing",
  };
};

export const resolveEntryContextFromPlayRoute = (location: LocationLike): ResolvedEntryContext | null => {
  const route = parsePlayRoute(location);
  if (!route) {
    return null;
  }

  return {
    chain: route.chain,
    worldName: route.worldName,
    intent: route.spectate ? "spectate" : "play",
    autoSettle: false,
    hyperstructuresLeft: null,
    source: "play-route",
  };
};

export const buildEntryHrefFromEntryContext = (context: ResolvedEntryContext): string => {
  return buildEntryHref({
    chain: context.chain,
    worldName: context.worldName,
    intent: context.intent,
    hyperstructuresLeft: context.hyperstructuresLeft,
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
    chain: context.chain,
    worldName: context.worldName,
    scene,
    col,
    row,
    spectate,
  });
};
