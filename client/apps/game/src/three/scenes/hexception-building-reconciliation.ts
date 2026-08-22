import type { HexPosition } from "@bibliothecadao/types";

export interface PositionedBuilding {
  col: number;
  row: number;
}

interface BuildingUpdateIdentity {
  innerCol?: unknown;
  innerRow?: unknown;
}

type BuildingInstanceAction = "create" | "keep" | "remove" | "replace";

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

interface RunOwnedBuildingWorkAfterModelsLoadInput {
  apply(): void;
  isOwned(): boolean;
  modelLoadPromises: readonly Promise<unknown>[];
}

export async function runOwnedBuildingWorkAfterModelsLoad(
  input: RunOwnedBuildingWorkAfterModelsLoadInput,
): Promise<void> {
  await Promise.allSettled(input.modelLoadPromises);
  if (!input.isOwned()) return;
  input.apply();
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
