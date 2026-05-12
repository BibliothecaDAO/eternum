import { parseMaybeBooleanFlag } from "@/config/game-modes/resolved-mode";
import { StructureType } from "@bibliothecadao/types";

export type SettlementSnapshot = {
  registered: boolean;
  onceRegistered: boolean;
  hasSettledStructure: boolean;
  coordsCount: number;
  settledCount: number;
};

// Torii SQL returns boolean columns as numeric (0/1) or string ("0"/"1"), so
// strict `=== true` on the raw row mis-reads genuine registrations as false.
export const parseSnapshotRegistrationRow = (
  row: { registered?: unknown; once_registered?: unknown } | null | undefined,
): { registered: boolean; onceRegistered: boolean } => ({
  registered: parseMaybeBooleanFlag(row?.registered) === true,
  onceRegistered: parseMaybeBooleanFlag(row?.once_registered) === true,
});

const hasIndexedSettlementProgress = (snapshot: SettlementSnapshot): boolean =>
  snapshot.hasSettledStructure || snapshot.coordsCount > 0 || snapshot.settledCount > 0;

export type SettlementStatus = {
  assignedCount: number;
  settledCount: number;
  remainingToSettle: number;
  canPlay: boolean;
  needsSettlement: boolean;
};

export type SettleStage = "idle" | "assigning" | "settling" | "syncing" | "done" | "error";

export type SettlementSubmissionStatus = "idle" | "submitting" | "syncing" | "failed" | "completed";

type IndexedSettlementStructure = {
  category?: number | null;
  entity_id?: number | null;
  realm_id?: number | null;
  coord_x?: number | null;
  coord_y?: number | null;
};

export type IndexedRealmSettlementTarget = {
  realmId: number | null;
  coordX: number | null;
  coordY: number | null;
};

type SettlementStepStatus = "pending" | "active" | "complete";

type SettlementPhaseViewModel = {
  progress: number;
  remainingToSettle: number;
  isComplete: boolean;
  showError: boolean;
  stepStatuses: Record<1 | 2 | 3, SettlementStepStatus>;
};

export const getExpectedSettlementCount = (singleRealmMode: boolean): number => (singleRealmMode ? 1 : 3);

export const deriveSettlementStatus = (snapshot: SettlementSnapshot): SettlementStatus => {
  const coordsCount = Math.max(0, snapshot.coordsCount);
  const settledCount = Math.max(0, snapshot.settledCount);
  const assignedCount = coordsCount + settledCount;
  const remainingToSettle = Math.max(0, assignedCount - settledCount);
  // Settle-finish rows can index ahead of the structure ownership query during Blitz entry.
  const hasIndexedCompletion = snapshot.hasSettledStructure || settledCount > 0;
  const canPlay = hasIndexedCompletion && assignedCount > 0 && remainingToSettle === 0;
  const isRegisteredForSettlement = snapshot.registered || snapshot.onceRegistered;
  const needsSettlement = isRegisteredForSettlement && !canPlay;

  return {
    assignedCount,
    settledCount,
    remainingToSettle,
    canPlay,
    needsSettlement,
  };
};

export const hasReachedSettlementTarget = (
  progress: Pick<SettlementSnapshot, "settledCount"> | Pick<SettlementStatus, "settledCount">,
  targetSettleCount: number,
): boolean => Math.max(0, progress.settledCount) >= Math.max(0, targetSettleCount);

const hasMatchingRealmId = (structure: IndexedSettlementStructure, target: IndexedRealmSettlementTarget): boolean =>
  target.realmId != null && structure.realm_id === target.realmId;

const hasMatchingCoordinates = (structure: IndexedSettlementStructure, target: IndexedRealmSettlementTarget): boolean =>
  target.coordX != null &&
  target.coordY != null &&
  structure.coord_x === target.coordX &&
  structure.coord_y === target.coordY;

export const findIndexedRealmSettlement = <T extends IndexedSettlementStructure>(
  structures: T[],
  target: IndexedRealmSettlementTarget,
): T | null =>
  structures.find(
    (structure) =>
      Number(structure.category) === StructureType.Realm &&
      (hasMatchingRealmId(structure, target) || hasMatchingCoordinates(structure, target)),
  ) ?? null;

export const findNewIndexedVillageSettlement = <T extends IndexedSettlementStructure>(
  structures: T[],
  existingVillageIds: Set<number>,
): T | null =>
  structures
    .filter(
      (structure) =>
        Number(structure.category) === StructureType.Village &&
        structure.entity_id != null &&
        !existingVillageIds.has(structure.entity_id),
    )
    .toSorted((left, right) => Number(right.entity_id ?? 0) - Number(left.entity_id ?? 0))[0] ?? null;

const buildCompletedStepStatuses = (): SettlementPhaseViewModel["stepStatuses"] => ({
  1: "complete",
  2: "complete",
  3: "complete",
});

export const deriveSettlementPhaseViewModel = ({
  stage,
  assignedCount,
  settledCount,
}: {
  stage: SettleStage;
  assignedCount: number;
  settledCount: number;
}): SettlementPhaseViewModel => {
  const normalizedAssignedCount = Math.max(0, assignedCount);
  const normalizedSettledCount = Math.max(0, settledCount);
  const remainingToSettle = Math.max(0, normalizedAssignedCount - normalizedSettledCount);
  const progress =
    normalizedAssignedCount > 0 ? Math.min(100, (normalizedSettledCount / normalizedAssignedCount) * 100) : 0;
  const isComplete = stage === "done" || (normalizedAssignedCount > 0 && remainingToSettle === 0);

  if (isComplete) {
    return {
      progress,
      remainingToSettle,
      isComplete: true,
      showError: false,
      stepStatuses: buildCompletedStepStatuses(),
    };
  }

  if (stage === "syncing") {
    return {
      progress,
      remainingToSettle,
      isComplete: false,
      showError: false,
      stepStatuses: {
        1: "complete",
        2: "complete",
        3: "active",
      },
    };
  }

  return {
    progress,
    remainingToSettle,
    isComplete: false,
    showError: stage === "error",
    stepStatuses: {
      1: normalizedAssignedCount > 0 ? "complete" : stage === "assigning" ? "active" : "pending",
      2:
        normalizedAssignedCount === 0
          ? "pending"
          : stage === "settling" || (remainingToSettle > 0 && normalizedSettledCount > 0)
            ? "active"
            : "pending",
      3: stage === "settling" && remainingToSettle <= 1 ? "active" : "pending",
    },
  };
};

const isDashboardSettlementEntryIntent = (entryIntent: "play" | "settle" | "spectate" | "forge"): boolean =>
  entryIntent === "play" || entryIntent === "settle";

export const applyDashboardRegistrationHint = ({
  snapshot,
  entryIntent,
  hasDashboardRegistrationEntry,
}: {
  snapshot: SettlementSnapshot;
  entryIntent: "play" | "settle" | "spectate" | "forge";
  hasDashboardRegistrationEntry: boolean;
}): SettlementSnapshot => {
  const shouldHintRegistration =
    isDashboardSettlementEntryIntent(entryIntent) &&
    hasDashboardRegistrationEntry &&
    !snapshot.registered &&
    !snapshot.onceRegistered &&
    !hasIndexedSettlementProgress(snapshot);

  if (!shouldHintRegistration) {
    return snapshot;
  }

  return {
    ...snapshot,
    registered: true,
  };
};

export type SettlementExecutionPlan = {
  targetSettleCount: number;
  shouldAssignAndSettle: boolean;
  initialSettleCount: number;
  extraSettleCalls: number;
  missingAssignmentRegistration: boolean;
};

const shouldContinueSettlementWithoutAssignment = ({
  registered,
  settledCount,
  targetSettleCount,
}: {
  registered: boolean;
  settledCount: number;
  targetSettleCount: number;
}): boolean => settledCount > 0 && settledCount < targetSettleCount && !registered;

export const buildSettlementExecutionPlan = ({
  isMainnet,
  singleRealmMode,
  snapshot,
}: {
  isMainnet: boolean;
  singleRealmMode: boolean;
  snapshot: SettlementSnapshot;
}): SettlementExecutionPlan => {
  const targetSettleCount = getExpectedSettlementCount(singleRealmMode);
  const settledCount = Math.max(0, snapshot.settledCount);
  const coordsCount = Math.max(0, snapshot.coordsCount);
  const remainingToTarget = Math.max(0, targetSettleCount - settledCount);

  if (settledCount >= targetSettleCount) {
    return {
      targetSettleCount,
      shouldAssignAndSettle: false,
      initialSettleCount: 0,
      extraSettleCalls: 0,
      missingAssignmentRegistration: false,
    };
  }

  if (shouldContinueSettlementWithoutAssignment({ registered: snapshot.registered, settledCount, targetSettleCount })) {
    return {
      targetSettleCount,
      shouldAssignAndSettle: false,
      initialSettleCount: 0,
      extraSettleCalls: remainingToTarget,
      missingAssignmentRegistration: false,
    };
  }

  if (coordsCount > 0) {
    return {
      targetSettleCount,
      shouldAssignAndSettle: false,
      initialSettleCount: 0,
      extraSettleCalls: Math.min(coordsCount, remainingToTarget),
      missingAssignmentRegistration: false,
    };
  }

  const initialSettleCount = isMainnet ? 1 : Math.max(0, targetSettleCount - settledCount);
  const extraSettleCalls = Math.max(0, targetSettleCount - (settledCount + initialSettleCount));

  return {
    targetSettleCount,
    shouldAssignAndSettle: true,
    initialSettleCount,
    extraSettleCalls,
    missingAssignmentRegistration: !snapshot.registered && !snapshot.onceRegistered,
  };
};
