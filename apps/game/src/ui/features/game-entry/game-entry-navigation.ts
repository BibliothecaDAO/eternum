import { buildPlayHref } from "@/play/navigation/play-route";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import type { GameRef } from "@bibliothecadao/eternum/game-client";

type WorldMapPosition = {
  col: number;
  row: number;
};

type ResolveGameEntryTargetInput = GameRef & {
  structureEntityId: number;
  worldMapReturnPosition: WorldMapPosition | null;
  isSpectateMode: boolean;
  /** The mode's first view for a player with a realm: the map, or the realm's board. */
  entryScene: "map" | "hex";
};

type ResolvedGameEntryTarget = {
  spectator: boolean;
  structureEntityId: number;
  url: string;
  worldMapPosition: WorldMapPosition | null;
};

const isFiniteCoordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** The map boots first either way; a realm-first mode then hands off to the realm's board. */
const buildCanonicalGameEntryUrl = ({
  chainId,
  gameId,
  isSpectateMode,
  worldMapPosition,
  realmFirst,
}: GameRef & {
  isSpectateMode: boolean;
  worldMapPosition: WorldMapPosition | null;
  realmFirst: boolean;
}) => {
  return buildPlayHref({
    bootMode: realmFirst ? "map-first" : "direct",
    chainId,
    gameId,
    col: worldMapPosition?.col ?? null,
    resumeScene: realmFirst ? "hex" : null,
    row: worldMapPosition?.row ?? null,
    scene: "map",
    spectate: isSpectateMode,
  });
};

const resolveBootstrappedWorldMapTarget = (
  input: ResolveGameEntryTargetInput,
): { structureEntityId: number; worldMapPosition: WorldMapPosition } | null => {
  if (input.structureEntityId <= UNDEFINED_STRUCTURE_ENTITY_ID || input.worldMapReturnPosition == null) {
    return null;
  }

  // The store keeps the map URL's hex already normalized (mapRouteHex), so it is used as it is.
  const { col, row } = input.worldMapReturnPosition;
  if (!isFiniteCoordinate(col) || !isFiniteCoordinate(row)) {
    return null;
  }

  return {
    structureEntityId: input.structureEntityId,
    worldMapPosition: { col, row },
  };
};

const buildWorldMapEntryTargetFromBootstrappedSelection = (
  input: ResolveGameEntryTargetInput,
  target: { structureEntityId: number; worldMapPosition: WorldMapPosition },
): ResolvedGameEntryTarget => {
  return {
    spectator: input.isSpectateMode,
    structureEntityId: target.structureEntityId,
    url: buildCanonicalGameEntryUrl({
      chainId: input.chainId,
      gameId: input.gameId,
      worldMapPosition: target.worldMapPosition,
      isSpectateMode: input.isSpectateMode,
      // Only a player entering their own realm opens on it; a spectator starts on the map.
      realmFirst: input.entryScene === "hex" && !input.isSpectateMode,
    }),
    worldMapPosition: target.worldMapPosition,
  };
};

const buildFallbackGameEntryTarget = (input: ResolveGameEntryTargetInput): ResolvedGameEntryTarget => {
  return {
    spectator: input.isSpectateMode,
    structureEntityId: 0,
    url: buildCanonicalGameEntryUrl({
      chainId: input.chainId,
      gameId: input.gameId,
      worldMapPosition: null,
      isSpectateMode: input.isSpectateMode,
      realmFirst: false,
    }),
    worldMapPosition: null,
  };
};

export const resolveGameEntryTarget = ({
  chainId,
  gameId,
  structureEntityId,
  worldMapReturnPosition,
  isSpectateMode,
  entryScene,
}: ResolveGameEntryTargetInput): ResolvedGameEntryTarget => {
  const input = {
    chainId,
    gameId,
    structureEntityId,
    worldMapReturnPosition,
    isSpectateMode,
    entryScene,
  };
  const bootstrappedWorldMapTarget = resolveBootstrappedWorldMapTarget(input);

  if (bootstrappedWorldMapTarget) {
    return buildWorldMapEntryTargetFromBootstrappedSelection(input, bootstrappedWorldMapTarget);
  }

  return buildFallbackGameEntryTarget(input);
};
