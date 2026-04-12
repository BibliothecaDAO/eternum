import { buildPlayRouteFromEntryContext } from "@/game-entry/context";
import type { PlayScene } from "@/play/navigation/play-route";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import type { Chain } from "@contracts";

type WorldMapPosition = {
  col: number;
  row: number;
};

type ResolveGameEntryTargetInput = {
  chain: Chain;
  worldName: string;
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

const resolveFallbackScene = (isSpectateMode: boolean): PlayScene => {
  return isSpectateMode ? "map" : "hex";
};

const buildCanonicalGameEntryUrl = ({
  chain,
  worldName,
  scene,
  worldMapPosition,
  isSpectateMode,
}: {
  chain: Chain;
  worldName: string;
  scene: PlayScene;
  worldMapPosition: WorldMapPosition;
  isSpectateMode: boolean;
}) => {
  return buildPlayRouteFromEntryContext({
    context: {
      chain,
      worldName,
      intent: isSpectateMode ? "spectate" : "play",
      autoSettle: false,
      hyperstructuresLeft: null,
      source: "landing",
    },
    scene,
    col: worldMapPosition.col,
    row: worldMapPosition.row,
    spectate: isSpectateMode,
  });
};

const resolveBootstrappedWorldMapTarget = (
  input: ResolveGameEntryTargetInput,
): { structureEntityId: number; worldMapPosition: WorldMapPosition } | null => {
  if (input.structureEntityId <= UNDEFINED_STRUCTURE_ENTITY_ID || input.worldMapReturnPosition == null) {
    return null;
  }

  const { col, row } = input.worldMapReturnPosition;
  if (!isFiniteCoordinate(col) || !isFiniteCoordinate(row)) {
    return null;
  }

  return {
    structureEntityId: input.structureEntityId,
    worldMapPosition: { col, row },
  };
};

const buildDirectGameEntryTarget = (
  input: ResolveGameEntryTargetInput,
  target: { structureEntityId: number; worldMapPosition: WorldMapPosition },
): ResolvedGameEntryTarget => {
  return {
    spectator: input.isSpectateMode,
    structureEntityId: target.structureEntityId,
    url: buildCanonicalGameEntryUrl({
      chain: input.chain,
      worldName: input.worldName,
      scene: "map",
      worldMapPosition: target.worldMapPosition,
      isSpectateMode: input.isSpectateMode,
    }),
    worldMapPosition: target.worldMapPosition,
  };
};

const buildFallbackGameEntryTarget = (input: ResolveGameEntryTargetInput): ResolvedGameEntryTarget => {
  const fallbackWorldMapPosition = { col: 0, row: 0 };

  return {
    spectator: input.isSpectateMode,
    structureEntityId: 0,
    url: buildCanonicalGameEntryUrl({
      chain: input.chain,
      worldName: input.worldName,
      scene: resolveFallbackScene(input.isSpectateMode),
      worldMapPosition: fallbackWorldMapPosition,
      isSpectateMode: input.isSpectateMode,
    }),
    worldMapPosition: null,
  };
};

export const resolveGameEntryTarget = ({
  chain,
  worldName,
  structureEntityId,
  worldMapReturnPosition,
  isSpectateMode,
}: ResolveGameEntryTargetInput): ResolvedGameEntryTarget => {
  const input = {
    chain,
    worldName,
    structureEntityId,
    worldMapReturnPosition,
    isSpectateMode,
  };
  const bootstrappedWorldMapTarget = resolveBootstrappedWorldMapTarget(input);

  if (input.isSpectateMode && bootstrappedWorldMapTarget) {
    return buildDirectGameEntryTarget(input, bootstrappedWorldMapTarget);
  }

  return buildFallbackGameEntryTarget(input);
};
