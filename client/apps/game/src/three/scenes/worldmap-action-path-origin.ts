import type { HexPosition } from "@bibliothecadao/types";

interface ArmyActionPathOriginInput {
  feltCenter: number;
  worldmapArmyPosition?: HexPosition;
  explorerTroopsCoord?: { x: number; y: number };
}

interface ArmyActionPathOriginResult {
  startPositionOverride: HexPosition | undefined;
  hasDivergentOrigin: boolean;
}

export function resolveArmyActionPathOrigin(input: ArmyActionPathOriginInput): ArmyActionPathOriginResult {
  if (!input.worldmapArmyPosition) {
    return {
      startPositionOverride: undefined,
      hasDivergentOrigin: false,
    };
  }

  const startPositionOverride = {
    col: input.worldmapArmyPosition.col + input.feltCenter,
    row: input.worldmapArmyPosition.row + input.feltCenter,
  };

  if (!input.explorerTroopsCoord) {
    return {
      startPositionOverride,
      hasDivergentOrigin: false,
    };
  }

  const ecsNormalized = {
    col: input.explorerTroopsCoord.x - input.feltCenter,
    row: input.explorerTroopsCoord.y - input.feltCenter,
  };

  return {
    startPositionOverride,
    hasDivergentOrigin:
      ecsNormalized.col !== input.worldmapArmyPosition.col || ecsNormalized.row !== input.worldmapArmyPosition.row,
  };
}
