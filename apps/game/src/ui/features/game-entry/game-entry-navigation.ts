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
};

type ResolvedGameEntryTarget = {
  spectator: boolean;
  structureEntityId: number;
  url: string;
  worldMapPosition: WorldMapPosition | null;
};

const isFiniteCoordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const buildCanonicalGameEntryUrl = ({
  chainId,
  gameId,
  isSpectateMode,
  worldMapPosition,
}: GameRef & {
  isSpectateMode: boolean;
  worldMapPosition: WorldMapPosition | null;
}) => {
  return buildPlayHref({
    bootMode: "direct",
    chainId,
    gameId,
    col: worldMapPosition?.col ?? null,
    resumeScene: null,
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
}: ResolveGameEntryTargetInput): ResolvedGameEntryTarget => {
  const input = {
    chainId,
    gameId,
    structureEntityId,
    worldMapReturnPosition,
    isSpectateMode,
  };
  const bootstrappedWorldMapTarget = resolveBootstrappedWorldMapTarget(input);

  if (bootstrappedWorldMapTarget) {
    return buildWorldMapEntryTargetFromBootstrappedSelection(input, bootstrappedWorldMapTarget);
  }

  return buildFallbackGameEntryTarget(input);
};
