interface ArmyRenderBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

interface ArmyHexPosition {
  col: number;
  row: number;
}

function isInBounds(position: ArmyHexPosition, bounds: ArmyRenderBounds): boolean {
  return (
    position.col >= bounds.minCol &&
    position.col <= bounds.maxCol &&
    position.row >= bounds.minRow &&
    position.row <= bounds.maxRow
  );
}

/**
 * Keep an army visible if either its destination (current animated position)
 * or tracked source hex lies inside the render bounds.
 */
export function shouldArmyRemainVisibleInBounds(
  destination: ArmyHexPosition,
  bounds: ArmyRenderBounds,
  source?: ArmyHexPosition,
): boolean {
  if (isInBounds(destination, bounds)) {
    return true;
  }
  if (!source) {
    return false;
  }
  return isInBounds(source, bounds);
}
