interface ResolveArmyTabSelectionPositionInput {
  renderedArmyPosition?: { col: number; row: number };
  selectableArmyNormalizedPosition: { col: number; row: number };
}

/**
 * Tab cycling should prioritize the position currently rendered in the worldmap.
 * Fallback to selectable-army snapshot coordinates when render state is unavailable.
 */
export function resolveArmyTabSelectionPosition(input: ResolveArmyTabSelectionPositionInput): { col: number; row: number } {
  if (input.renderedArmyPosition) {
    return input.renderedArmyPosition;
  }

  return input.selectableArmyNormalizedPosition;
}
