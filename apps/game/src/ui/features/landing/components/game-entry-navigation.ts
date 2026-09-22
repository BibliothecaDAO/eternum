import { normalizeWorldMapRoutePosition } from "@/play/navigation/play-route-target";
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
  mapCenterOffset?: number | null;
};

type ResolvedGameEntryTarget = {
  spectator: boolean;
  structureEntityId: number;
  url: string;
  worldMapPosition: WorldMapPosition | null;
};

const isFiniteCoordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const CONTRACT_MAP_CENTER = 2147483646;

const resolveMapCenter = (mapCenterOffset?: number | null): number | null => {
  if (typeof mapCenterOffset !== "number" || !Number.isFinite(mapCenterOffset)) {
    return null;
  }

  return CONTRACT_MAP_CENTER - mapCenterOffset;
};

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

  const normalizedWorldMapPosition = normalizeWorldMapRoutePosition(input.worldMapReturnPosition, {
    mapCenter: resolveMapCenter(input.mapCenterOffset),
  });
  if (normalizedWorldMapPosition == null) {
    return null;
  }

  const { col, row } = normalizedWorldMapPosition;
  if (!isFiniteCoordinate(col) || !isFiniteCoordinate(row)) {
    return null;
  }

  return {
    structureEntityId: input.structureEntityId,
    worldMapPosition: normalizedWorldMapPosition,
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
  mapCenterOffset,
}: ResolveGameEntryTargetInput): ResolvedGameEntryTarget => {
  const input = {
    chainId,
    gameId,
    structureEntityId,
    worldMapReturnPosition,
    isSpectateMode,
    mapCenterOffset,
  };
  const bootstrappedWorldMapTarget = resolveBootstrappedWorldMapTarget(input);

  if (bootstrappedWorldMapTarget) {
    return buildWorldMapEntryTargetFromBootstrappedSelection(input, bootstrappedWorldMapTarget);
  }

  return buildFallbackGameEntryTarget(input);
};
