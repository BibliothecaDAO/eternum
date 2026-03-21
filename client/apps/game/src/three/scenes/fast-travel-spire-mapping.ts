import type { FastTravelHexCoords, FastTravelSpireHydrationInput } from "./fast-travel-hydration";

export type FastTravelSpireMapping = FastTravelSpireHydrationInput;

function hexesMatch(left: FastTravelHexCoords, right: FastTravelHexCoords): boolean {
  return left.col === right.col && left.row === right.row;
}

export function resolveFastTravelSpireByWorldHex(input: {
  worldHexCoords: FastTravelHexCoords;
  spireMappings: readonly FastTravelSpireMapping[];
}): FastTravelSpireMapping | null {
  return input.spireMappings.find((spire) => hexesMatch(spire.worldHexCoords, input.worldHexCoords)) ?? null;
}

export function resolveFastTravelSpireByTravelHex(input: {
  travelHexCoords: FastTravelHexCoords;
  spireMappings: readonly FastTravelSpireMapping[];
}): FastTravelSpireMapping | null {
  return input.spireMappings.find((spire) => hexesMatch(spire.travelHexCoords, input.travelHexCoords)) ?? null;
}
