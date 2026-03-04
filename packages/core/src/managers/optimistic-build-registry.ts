import { type BuildingType, type ID } from "@bibliothecadao/types";

type OptimisticBuildStatus = "submitted" | "confirmed" | "failed" | "stale";

interface ActiveProductionCount {
  buildingType: BuildingType;
  buildingCount: number;
}

interface RegisterOptimisticBuildOperationInput {
  operationId: string;
  structureEntityId: ID;
  outerCol: number;
  outerRow: number;
  innerCol: number;
  innerRow: number;
  buildingType: BuildingType;
  expectedBuildingCount: number;
  startedAtMs: number;
  staleAfterMs: number;
  removeOverride: () => void;
}

interface ReconcileOptimisticBuildOperationsInput {
  structureEntityId: ID;
  activeProductions: ActiveProductionCount[];
}

interface OptimisticBuildOperation extends RegisterOptimisticBuildOperationInput {
  status: OptimisticBuildStatus;
  staleTimeout: ReturnType<typeof setTimeout>;
}

const pendingOpsById = new Map<string, OptimisticBuildOperation>();
const pendingOpIdsByStructure = new Map<ID, string[]>();
const pendingOpCountByHex = new Map<string, number>();

const isDevelopmentRuntime = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

function getHexKey(input: {
  outerCol: number;
  outerRow: number;
  innerCol: number;
  innerRow: number;
}): string {
  return `${input.outerCol},${input.outerRow},${input.innerCol},${input.innerRow}`;
}

function addPendingHex(input: { outerCol: number; outerRow: number; innerCol: number; innerRow: number }): void {
  const key = getHexKey(input);
  const current = pendingOpCountByHex.get(key) ?? 0;
  pendingOpCountByHex.set(key, current + 1);
}

function removePendingHex(input: { outerCol: number; outerRow: number; innerCol: number; innerRow: number }): void {
  const key = getHexKey(input);
  const current = pendingOpCountByHex.get(key);
  if (current === undefined) {
    return;
  }

  if (current <= 1) {
    pendingOpCountByHex.delete(key);
    return;
  }

  pendingOpCountByHex.set(key, current - 1);
}

function getPendingOperationsForStructure(structureEntityId: ID): OptimisticBuildOperation[] {
  const operationIds = pendingOpIdsByStructure.get(structureEntityId) ?? [];
  return operationIds
    .map((operationId) => pendingOpsById.get(operationId))
    .filter((operation): operation is OptimisticBuildOperation => operation !== undefined)
    .sort((a, b) => {
      if (a.startedAtMs !== b.startedAtMs) {
        return a.startedAtMs - b.startedAtMs;
      }

      return a.operationId.localeCompare(b.operationId);
    });
}

function adjustSubsequentExpectedCounts(
  removedOperation: OptimisticBuildOperation,
  reason: Exclude<OptimisticBuildStatus, "submitted">,
): void {
  if (reason !== "failed" && reason !== "stale") {
    return;
  }

  getPendingOperationsForStructure(removedOperation.structureEntityId).forEach((operation) => {
    if (operation.status !== "submitted") {
      return;
    }

    if (operation.buildingType !== removedOperation.buildingType) {
      return;
    }

    if (operation.expectedBuildingCount <= removedOperation.expectedBuildingCount) {
      return;
    }

    operation.expectedBuildingCount -= 1;
  });
}

function cleanupOperation(
  operationId: string,
  reason: Exclude<OptimisticBuildStatus, "submitted">,
): OptimisticBuildOperation | null {
  const operation = pendingOpsById.get(operationId);
  if (!operation) {
    return null;
  }

  operation.status = reason;
  clearTimeout(operation.staleTimeout);
  pendingOpsById.delete(operationId);

  const structureOps = pendingOpIdsByStructure.get(operation.structureEntityId);
  if (structureOps) {
    const remaining = structureOps.filter((id) => id !== operationId);
    if (remaining.length === 0) {
      pendingOpIdsByStructure.delete(operation.structureEntityId);
    } else {
      pendingOpIdsByStructure.set(operation.structureEntityId, remaining);
    }
  }

  removePendingHex(operation);
  adjustSubsequentExpectedCounts(operation, reason);

  try {
    operation.removeOverride();
  } catch (error) {
    console.error("[OptimisticBuildRegistry] Failed to remove optimistic override", error);
  }

  if (isDevelopmentRuntime && reason === "stale") {
    console.warn("[OptimisticBuildRegistry] Cleared stale optimistic build operation", {
      operationId: operation.operationId,
      structureEntityId: operation.structureEntityId,
      buildingType: operation.buildingType,
      expectedBuildingCount: operation.expectedBuildingCount,
      staleAfterMs: operation.staleAfterMs,
    });
  }

  return operation;
}

export function registerOptimisticBuildOperation(input: RegisterOptimisticBuildOperationInput): void {
  const existing = pendingOpsById.get(input.operationId);
  if (existing) {
    cleanupOperation(existing.operationId, "failed");
  }

  const operation: OptimisticBuildOperation = {
    ...input,
    status: "submitted",
    staleTimeout: setTimeout(() => {
      cleanupOperation(input.operationId, "stale");
    }, input.staleAfterMs),
  };

  pendingOpsById.set(input.operationId, operation);
  const structureOps = pendingOpIdsByStructure.get(input.structureEntityId) ?? [];
  structureOps.push(input.operationId);
  pendingOpIdsByStructure.set(input.structureEntityId, structureOps);
  addPendingHex(input);
}

export function markOptimisticBuildOperationFailed(operationId: string): void {
  cleanupOperation(operationId, "failed");
}

export function reconcileOptimisticBuildOperations(input: ReconcileOptimisticBuildOperationsInput): number {
  const pendingOperations = getPendingOperationsForStructure(input.structureEntityId).filter(
    (operation) => operation.status === "submitted",
  );
  if (pendingOperations.length === 0) {
    return 0;
  }

  const activeCounts = new Map<BuildingType, number>();
  input.activeProductions.forEach((production) => {
    activeCounts.set(production.buildingType, production.buildingCount);
  });

  let reconciledCount = 0;

  pendingOperations.forEach((operation) => {
    const authoritativeCount = activeCounts.get(operation.buildingType) ?? 0;
    if (authoritativeCount < operation.expectedBuildingCount) {
      return;
    }

    const cleared = cleanupOperation(operation.operationId, "confirmed");
    if (cleared) {
      reconciledCount += 1;
    }
  });

  return reconciledCount;
}

export function isOptimisticBuildPendingAtHex(input: {
  outerCol: number;
  outerRow: number;
  innerCol: number;
  innerRow: number;
}): boolean {
  return (pendingOpCountByHex.get(getHexKey(input)) ?? 0) > 0;
}

export function hasPendingOptimisticBuildsForStructure(structureEntityId: ID): boolean {
  return getPendingOperationsForStructure(structureEntityId).some((operation) => operation.status === "submitted");
}

export function getPendingOptimisticBuildCountForStructureAndType(
  structureEntityId: ID,
  buildingType: BuildingType,
): number {
  return getPendingOperationsForStructure(structureEntityId).filter(
    (operation) => operation.status === "submitted" && operation.buildingType === buildingType,
  ).length;
}

export function __resetOptimisticBuildRegistryForTests(): void {
  pendingOpsById.forEach((operation) => {
    clearTimeout(operation.staleTimeout);
  });
  pendingOpsById.clear();
  pendingOpIdsByStructure.clear();
  pendingOpCountByHex.clear();
}
