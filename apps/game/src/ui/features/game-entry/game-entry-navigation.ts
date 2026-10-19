import { buildPlayHref, type PlayRouteDescriptor } from "@/play/navigation/play-route";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import type { GameRef } from "@bibliothecadao/eternum/game-client";

type WorldMapPosition = {
  col: number;
  row: number;
};

/** What the entry's address asked of the renderer (a backend, diagnostics): the map's address carries it on. */
type RendererRequest = Pick<PlayRouteDescriptor, "rendererMode" | "verboseLogs">;

type ResolveGameEntryTargetInput = GameRef & {
  structureEntityId: number;
  worldMapReturnPosition: WorldMapPosition | null;
  isSpectateMode: boolean;
  renderer?: RendererRequest;
};

type ResolvedGameEntryTarget = {
  spectator: boolean;
  structureEntityId: number;
  url: string;
  worldMapPosition: WorldMapPosition | null;
};

const isFiniteCoordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * Every mode's session opens on the world map; the realm view is one press of Realm away. The renderer request the
 * entry was opened with goes on to the map, where the renderer reads it.
 */
const buildCanonicalGameEntryUrl = ({
  chainId,
  gameId,
  isSpectateMode,
  worldMapPosition,
  renderer,
}: GameRef & {
  isSpectateMode: boolean;
  worldMapPosition: WorldMapPosition | null;
  renderer?: RendererRequest;
}) => {
  return buildPlayHref({
    ...renderer,
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
      renderer: input.renderer,
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
      renderer: input.renderer,
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
  renderer,
}: ResolveGameEntryTargetInput): ResolvedGameEntryTarget => {
  const input = {
    chainId,
    gameId,
    structureEntityId,
    worldMapReturnPosition,
    isSpectateMode,
    renderer,
  };
  const bootstrappedWorldMapTarget = resolveBootstrappedWorldMapTarget(input);

  if (bootstrappedWorldMapTarget) {
    return buildWorldMapEntryTargetFromBootstrappedSelection(input, bootstrappedWorldMapTarget);
  }

  return buildFallbackGameEntryTarget(input);
};
