import type { HexPosition } from "@bibliothecadao/types";

interface WorldmapCameraStoreSyncPlanInput {
  currentDistance: number | null;
  currentHex: HexPosition | null | undefined;
  isScriptedTransitionActive: boolean;
  nextDistance: number;
  nextHex: HexPosition;
}

export function resolveWorldmapCameraStoreSyncPlan(
  input: WorldmapCameraStoreSyncPlanInput,
): { shouldUpdateDistance: boolean; shouldUpdateHex: boolean } {
  const shouldUpdateHex =
    !input.currentHex || input.currentHex.col !== input.nextHex.col || input.currentHex.row !== input.nextHex.row;

  const distanceChanged =
    input.currentDistance === null || Math.abs(input.currentDistance - input.nextDistance) > 0.01;

  return {
    shouldUpdateDistance: distanceChanged && !input.isScriptedTransitionActive,
    shouldUpdateHex,
  };
}
