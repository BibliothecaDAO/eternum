export interface ArmyHexPosition {
  col: number;
  row: number;
}

export interface PendingArmyRemovalCandidate<TArmyId> {
  entityId: TArmyId;
  scheduledAt: number;
  chunkKey: string;
  reason: "tile" | "zero";
  ownerAddress?: bigint;
  position?: ArmyHexPosition;
}

export interface FindSupersededArmyRemovalInput<TArmyId> {
  incomingEntityId: TArmyId;
  incomingOwnerAddress?: bigint;
  incomingPosition: ArmyHexPosition;
  pending: PendingArmyRemovalCandidate<TArmyId>[];
}

function isWithinReplacementRadius(a: ArmyHexPosition, b: ArmyHexPosition): boolean {
  const colDelta = Math.abs(a.col - b.col);
  const rowDelta = Math.abs(a.row - b.row);
  return Math.max(colDelta, rowDelta) <= 1;
}

/**
 * Find an older pending tile-removal entry that should be superseded by a newly
 * arrived army update (e.g. boat despawn immediately followed by land spawn).
 */
export function findSupersededArmyRemoval<TArmyId>(input: FindSupersededArmyRemovalInput<TArmyId>): TArmyId | undefined {
  const { incomingEntityId, incomingOwnerAddress, incomingPosition, pending } = input;

  if (incomingOwnerAddress === undefined || incomingOwnerAddress === 0n) {
    return undefined;
  }

  const now = Date.now();
  const freshnessWindowMs = 8_000;

  for (const candidate of pending) {
    if (candidate.entityId === incomingEntityId) {
      continue;
    }
    if (candidate.reason !== "tile") {
      continue;
    }
    if (candidate.ownerAddress !== incomingOwnerAddress) {
      continue;
    }
    if (!candidate.position || !isWithinReplacementRadius(candidate.position, incomingPosition)) {
      continue;
    }
    if (now - candidate.scheduledAt > freshnessWindowMs) {
      continue;
    }
    return candidate.entityId;
  }

  return undefined;
}
