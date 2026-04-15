interface ArmyHexPosition {
  col: number;
  row: number;
}

interface StaleTrackedArmyTileRemovalInput {
  reason: "tile" | "zero";
  trackedPosition?: ArmyHexPosition;
  removalPosition?: ArmyHexPosition;
}

function isExactPosition(a: ArmyHexPosition, b: ArmyHexPosition): boolean {
  return a.col === b.col && a.row === b.row;
}

export function isStaleTrackedArmyTileRemoval(input: StaleTrackedArmyTileRemovalInput): boolean {
  const { reason, trackedPosition, removalPosition } = input;

  if (reason !== "tile" || !trackedPosition || !removalPosition) {
    return false;
  }

  return !isExactPosition(trackedPosition, removalPosition);
}
