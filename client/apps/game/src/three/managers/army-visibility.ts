export interface ArmyRenderBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

export interface ArmyHexPosition {
  col: number;
  row: number;
}

interface ResolveArmyVisibilityBoundsDecisionInput {
  destination: ArmyHexPosition;
  bounds: ArmyRenderBounds;
  source?: ArmyHexPosition;
}

export interface ArmyVisibilityBoundsDecision {
  shouldRemainVisible: boolean;
  visibleBy: "destination" | "source" | "none";
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
export function resolveArmyVisibilityBoundsDecision(
  input: ResolveArmyVisibilityBoundsDecisionInput,
): ArmyVisibilityBoundsDecision {
  const { destination, bounds, source } = input;

  if (isInBounds(destination, bounds)) {
    return {
      shouldRemainVisible: true,
      visibleBy: "destination",
    };
  }

  if (!source) {
    return {
      shouldRemainVisible: false,
      visibleBy: "none",
    };
  }

  if (isInBounds(source, bounds)) {
    return {
      shouldRemainVisible: true,
      visibleBy: "source",
    };
  }

  return {
    shouldRemainVisible: false,
    visibleBy: "none",
  };
}

export function shouldArmyRemainVisibleInBounds(
  destination: ArmyHexPosition,
  bounds: ArmyRenderBounds,
  source?: ArmyHexPosition,
): boolean {
  return resolveArmyVisibilityBoundsDecision({
    destination,
    bounds,
    source,
  }).shouldRemainVisible;
}
