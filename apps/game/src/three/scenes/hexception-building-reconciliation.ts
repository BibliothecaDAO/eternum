import type { HexPosition } from "@bibliothecadao/types";

export interface PositionedBuilding {
  col: number;
  row: number;
}

interface BuildingUpdateIdentity {
  innerCol?: unknown;
  innerRow?: unknown;
}

export type BuildingInstanceAction = "create" | "keep" | "remove" | "replace";

export interface TargetedBuildingReconciliation<TBuilding extends PositionedBuilding> {
  buildings: TBuilding[];
  nextBuilding: TBuilding | undefined;
  position: HexPosition;
}

interface ReconcileBuildingUpdateInput<TBuilding extends PositionedBuilding> {
  applyFullFallback(): void;
  applyTargeted(reconciliation: TargetedBuildingReconciliation<TBuilding>): void;
  buildings: readonly TBuilding[];
  reportMissingIdentity(): void;
  resolveBuilding(position: HexPosition): TBuilding | undefined;
  update: BuildingUpdateIdentity;
}

export function reconcileBuildingUpdate<TBuilding extends PositionedBuilding>(
  input: ReconcileBuildingUpdateInput<TBuilding>,
): void {
  const position = resolveBuildingUpdatePosition(input.update);
  if (!position) {
    input.reportMissingIdentity();
    input.applyFullFallback();
    return;
  }

  const nextBuilding = input.resolveBuilding(position);
  const buildings = input.buildings.filter((building) => buildingKey(building) !== buildingKey(position));
  if (nextBuilding) {
    buildings.push(nextBuilding);
  }

  input.applyTargeted({ buildings, nextBuilding, position });
}

function resolveBuildingUpdatePosition(update: BuildingUpdateIdentity): HexPosition | null {
  if (!Number.isInteger(update.innerCol) || !Number.isInteger(update.innerRow)) {
    return null;
  }

  return { col: update.innerCol as number, row: update.innerRow as number };
}

export function buildingKey(position: PositionedBuilding): string {
  return `${position.col},${position.row}`;
}

export function resolveBuildingInstanceAction(
  currentSignature: string | undefined,
  nextSignature: string | undefined,
): BuildingInstanceAction {
  if (nextSignature === undefined) return currentSignature === undefined ? "keep" : "remove";
  if (currentSignature === undefined) return "create";
  return currentSignature === nextSignature ? "keep" : "replace";
}

/** Two render signatures that differ only in their tier, the last field: an upgrade, not a new building. */
export const isTierChange = (current: string | undefined, next: string): boolean => {
  if (current === undefined || current === next) return false;
  const withoutTier = (signature: string) => signature.slice(0, signature.lastIndexOf(":"));
  return withoutTier(current) === withoutTier(next);
};

/**
 * How a building enters its plot: one the player's own ghost stood for (`ghostPlot`, the plot a build sheet pinned its
 * ghost on) takes the ghost's place at once, springing from near its size; any other grows in. Grown from nothing where
 * the ghost had stood, the plot showed empty between the ghost leaving and the building growing visible.
 */
export const buildingEntrance = (plot: HexPosition, ghostPlot: HexPosition | null): "grow" | "overshoot" =>
  ghostPlot?.col === plot.col && ghostPlot?.row === plot.row ? "overshoot" : "grow";
