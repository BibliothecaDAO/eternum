interface ArmyHexPosition {
  col: number;
  row: number;
}

interface PendingArmyRemovalCandidate<TArmyId> {
  entityId: TArmyId;
  scheduledAt: number;
  chunkKey: string;
  reason: "tile" | "zero";
  ownerAddress?: bigint;
  ownerStructureId?: unknown;
  position?: ArmyHexPosition;
}

interface FindSupersededArmyRemovalInput<TArmyId> {
  incomingEntityId: TArmyId;
  incomingOwnerAddress?: bigint;
  incomingOwnerStructureId?: unknown;
  incomingPosition: ArmyHexPosition;
  pending: PendingArmyRemovalCandidate<TArmyId>[];
}

function isWithinReplacementRadius(a: ArmyHexPosition, b: ArmyHexPosition): boolean {
  const colDelta = Math.abs(a.col - b.col);
  const rowDelta = Math.abs(a.row - b.row);
  return Math.max(colDelta, rowDelta) <= 1;
}

function hasUsableStructureId(structureId: unknown): boolean {
  return structureId !== undefined && structureId !== null && structureId !== 0 && structureId !== 0n;
}

function isExactPosition(a: ArmyHexPosition, b: ArmyHexPosition): boolean {
  return a.col === b.col && a.row === b.row;
}

/**
 * Find an older pending tile-removal entry that should be superseded by a newly
 * arrived army update (e.g. boat despawn immediately followed by land spawn).
 */
export function findSupersededArmyRemoval<TArmyId>(
  input: FindSupersededArmyRemovalInput<TArmyId>,
): TArmyId | undefined {
  const { incomingEntityId, incomingOwnerAddress, incomingOwnerStructureId, incomingPosition, pending } = input;

  if (incomingOwnerAddress === undefined || incomingOwnerAddress === 0n) {
    return undefined;
  }

  const now = Date.now();
  const freshnessWindowMs = 8_000;
  const candidatePool = pending.filter((candidate) => {
    if (candidate.entityId === incomingEntityId) {
      return false;
    }
    if (candidate.reason !== "tile") {
      return false;
    }
    if (candidate.ownerAddress !== incomingOwnerAddress) {
      return false;
    }
    if (!candidate.position || !isWithinReplacementRadius(candidate.position, incomingPosition)) {
      return false;
    }
    if (now - candidate.scheduledAt > freshnessWindowMs) {
      return false;
    }
    return true;
  });

  if (hasUsableStructureId(incomingOwnerStructureId)) {
    const structureMatches = candidatePool.filter(
      (candidate) =>
        hasUsableStructureId(candidate.ownerStructureId) && candidate.ownerStructureId === incomingOwnerStructureId,
    );
    if (structureMatches.length === 1) {
      return structureMatches[0].entityId;
    }
    if (structureMatches.length > 1) {
      return undefined;
    }
  }

  const exactPositionMatches = candidatePool.filter(
    (candidate) => candidate.position && isExactPosition(candidate.position, incomingPosition),
  );
  if (exactPositionMatches.length === 1) {
    return exactPositionMatches[0].entityId;
  }
  if (exactPositionMatches.length > 1) {
    return undefined;
  }

  if (candidatePool.length === 1) {
    return candidatePool[0].entityId;
  }

  return undefined;
}
