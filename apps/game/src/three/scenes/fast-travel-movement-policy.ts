import type {
  FastTravelArmyHydrationInput,
  FastTravelHexCoords,
  FastTravelSpireHydrationInput,
} from "./fast-travel-hydration";
import { getFastTravelWorldPositionForHex } from "./fast-travel-hex-field";

export interface FastTravelMovementResolution {
  selectedArmyEntityId: string;
  originHexCoords: FastTravelHexCoords;
  targetHexCoords: FastTravelHexCoords;
  pathHexes: FastTravelHexCoords[];
  worldPath: Array<{ x: number; y: number; z: number }>;
  anchorHexes: FastTravelHexCoords[];
}

const ADJACENT_HEX_DISTANCE_SQUARED = 3.0001;

function toHexKey(hexCoords: FastTravelHexCoords): string {
  return `${hexCoords.col},${hexCoords.row}`;
}

function getDistanceSquared(a: FastTravelHexCoords, b: FastTravelHexCoords): number {
  const aPosition = getFastTravelWorldPositionForHex(a);
  const bPosition = getFastTravelWorldPositionForHex(b);
  const dx = aPosition.x - bPosition.x;
  const dz = aPosition.z - bPosition.z;
  return dx * dx + dz * dz;
}

function getNeighborHexes(hexCoords: FastTravelHexCoords, visibleHexes: FastTravelHexCoords[]): FastTravelHexCoords[] {
  return visibleHexes
    .filter((candidate) => {
      if (candidate.col === hexCoords.col && candidate.row === hexCoords.row) {
        return false;
      }

      return getDistanceSquared(hexCoords, candidate) <= ADJACENT_HEX_DISTANCE_SQUARED;
    })
    .sort((left, right) => (left.row === right.row ? left.col - right.col : left.row - right.row));
}

export function resolveFastTravelMovement(input: {
  selectedArmyEntityId: string;
  targetHexCoords: FastTravelHexCoords;
  visibleHexWindow: FastTravelHexCoords[];
  armies: FastTravelArmyHydrationInput[];
  spireAnchors: FastTravelSpireHydrationInput[];
}): FastTravelMovementResolution | null {
  const selectedArmy = input.armies.find((army) => army.entityId === input.selectedArmyEntityId);
  if (!selectedArmy) {
    return null;
  }

  const visibleHexKeys = new Set(input.visibleHexWindow.map(toHexKey));
  const targetHexKey = toHexKey(input.targetHexCoords);
  if (!visibleHexKeys.has(targetHexKey)) {
    return null;
  }

  if (
    selectedArmy.hexCoords.col === input.targetHexCoords.col &&
    selectedArmy.hexCoords.row === input.targetHexCoords.row
  ) {
    return null;
  }

  const blockedHexKeys = new Set(
    input.armies.filter((army) => army.entityId !== input.selectedArmyEntityId).map((army) => toHexKey(army.hexCoords)),
  );

  if (blockedHexKeys.has(targetHexKey)) {
    return null;
  }

  const queue: FastTravelHexCoords[] = [selectedArmy.hexCoords];
  const visited = new Set<string>([toHexKey(selectedArmy.hexCoords)]);
  const parents = new Map<string, string | null>([[toHexKey(selectedArmy.hexCoords), null]]);
  const hexByKey = new Map(input.visibleHexWindow.map((hex) => [toHexKey(hex), hex]));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (toHexKey(current) === targetHexKey) {
      break;
    }

    const neighbors = getNeighborHexes(current, input.visibleHexWindow).sort((left, right) => {
      const leftDistance = getDistanceSquared(left, input.targetHexCoords);
      const rightDistance = getDistanceSquared(right, input.targetHexCoords);
      if (leftDistance === rightDistance) {
        return left.row === right.row ? left.col - right.col : left.row - right.row;
      }
      return leftDistance - rightDistance;
    });

    neighbors.forEach((neighbor) => {
      const neighborKey = toHexKey(neighbor);
      if (visited.has(neighborKey) || blockedHexKeys.has(neighborKey)) {
        return;
      }

      visited.add(neighborKey);
      parents.set(neighborKey, toHexKey(current));
      queue.push(neighbor);
    });
  }

  if (!parents.has(targetHexKey)) {
    return null;
  }

  const pathKeys: string[] = [];
  let currentKey: string | null = targetHexKey;
  while (currentKey) {
    pathKeys.push(currentKey);
    currentKey = parents.get(currentKey) ?? null;
  }
  pathKeys.reverse();

  const pathHexes = pathKeys
    .map((pathKey) => hexByKey.get(pathKey))
    .filter((hexCoords): hexCoords is FastTravelHexCoords => hexCoords !== undefined);

  return {
    selectedArmyEntityId: input.selectedArmyEntityId,
    originHexCoords: selectedArmy.hexCoords,
    targetHexCoords: input.targetHexCoords,
    pathHexes,
    worldPath: pathHexes.map((hexCoords) => getFastTravelWorldPositionForHex(hexCoords)),
    anchorHexes: input.spireAnchors
      .map((spire) => spire.travelHexCoords)
      .filter((hexCoords) => visibleHexKeys.has(toHexKey(hexCoords))),
  };
}
