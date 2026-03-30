import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";

type WorldMapPosition = {
  col: number;
  row: number;
};

type ResolveGameEntryTargetInput = {
  structureEntityId: number;
  worldMapReturnPosition: WorldMapPosition | null;
  isSpectateMode: boolean;
};

type ResolvedGameEntryTarget = {
  spectator: boolean;
  structureEntityId: number;
  url: string;
  worldMapPosition: WorldMapPosition;
};

const isFiniteCoordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export const resolveGameEntryTarget = ({
  structureEntityId,
  worldMapReturnPosition,
  isSpectateMode,
}: ResolveGameEntryTargetInput): ResolvedGameEntryTarget | null => {
  if (structureEntityId <= UNDEFINED_STRUCTURE_ENTITY_ID || worldMapReturnPosition == null) {
    return null;
  }

  const { col, row } = worldMapReturnPosition;
  if (!isFiniteCoordinate(col) || !isFiniteCoordinate(row)) {
    return null;
  }

  return {
    spectator: isSpectateMode,
    structureEntityId,
    url: isSpectateMode ? `/play/map?col=${col}&row=${row}&spectate=true` : `/play/map?col=${col}&row=${row}`,
    worldMapPosition: { col, row },
  };
};
