import type {
  FastTravelArmyHydrationInput,
  FastTravelHexCoords,
  FastTravelSpireHydrationInput,
} from "./fast-travel-hydration";
import { getFastTravelWorldPositionForHex } from "./fast-travel-hex-field";

export interface FastTravelEntityAnchor {
  entityId: string;
  kind: "army" | "spire";
  hexCoords: FastTravelHexCoords;
  label: string;
  worldPosition: {
    x: number;
    y: number;
    z: number;
  };
}

function toHexKey(hexCoords: FastTravelHexCoords): string {
  return `${hexCoords.col},${hexCoords.row}`;
}

export function buildFastTravelEntityAnchors(input: {
  visibleHexWindow: FastTravelHexCoords[];
  armies: FastTravelArmyHydrationInput[];
  spireAnchors: FastTravelSpireHydrationInput[];
}): FastTravelEntityAnchor[] {
  const visibleHexKeys = new Set(input.visibleHexWindow.map(toHexKey));

  const armyAnchors = input.armies
    .filter((army) => visibleHexKeys.has(toHexKey(army.hexCoords)))
    .map((army) => ({
      entityId: army.entityId,
      kind: "army" as const,
      hexCoords: army.hexCoords,
      label: army.ownerName,
      worldPosition: getFastTravelWorldPositionForHex(army.hexCoords),
    }));

  const spireAnchors = input.spireAnchors
    .filter((spire) => visibleHexKeys.has(toHexKey(spire.travelHexCoords)))
    .map((spire) => ({
      entityId: spire.entityId,
      kind: "spire" as const,
      hexCoords: spire.travelHexCoords,
      label: spire.label,
      worldPosition: getFastTravelWorldPositionForHex(spire.travelHexCoords),
    }));

  return [...armyAnchors, ...spireAnchors];
}
