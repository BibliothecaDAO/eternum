import type { ID } from "@bibliothecadao/types";
import { TransferDirection } from "./transfer-direction";

export const BALANCE_TRANSFER_SLOT = "balance" as const;

type GuardSelection = number | typeof BALANCE_TRANSFER_SLOT | null;

interface SameStructureTransferParams {
  transferDirection: TransferDirection;
  selectedEntityId: ID;
  targetEntityId: ID;
  selectedExplorerOwner?: ID | bigint | number | string | null;
  selectedExplorerOwnerAddress?: ID | bigint | number | string | null;
  targetExplorerOwner?: ID | bigint | number | string | null;
  targetStructureOwnerAddress?: ID | bigint | number | string | null;
  guardSlot: GuardSelection;
}

const idsMatch = (
  left: ID | bigint | number | string | null | undefined,
  right: ID | bigint | number | string | null | undefined,
): boolean => {
  if (left === null || left === undefined || right === null || right === undefined) {
    return false;
  }

  return normalizeComparableId(left) === normalizeComparableId(right);
};

const normalizeComparableId = (value: ID | bigint | number | string): string => {
  try {
    return BigInt(value).toString();
  } catch {
    return String(value).trim().toLowerCase();
  }
};

export const getSameStructureTransferBlockReason = ({
  transferDirection,
  selectedEntityId,
  targetEntityId,
  selectedExplorerOwner,
  selectedExplorerOwnerAddress,
  targetExplorerOwner,
  targetStructureOwnerAddress,
  guardSlot,
}: SameStructureTransferParams): string | null => {
  if (transferDirection === TransferDirection.ExplorerToExplorer) {
    return idsMatch(selectedExplorerOwner, targetExplorerOwner)
      ? null
      : "Cannot transfer troops: Both explorers must belong to the same structure";
  }

  if (transferDirection === TransferDirection.ExplorerToStructure) {
    const sourceBelongsToTarget = idsMatch(selectedExplorerOwner, targetEntityId);
    const sourceOwnerMatchesTargetOwner = idsMatch(selectedExplorerOwnerAddress, targetStructureOwnerAddress);
    return sourceBelongsToTarget || sourceOwnerMatchesTargetOwner
      ? null
      : "Cannot transfer troops: Explorer must belong to the target structure";
  }

  if (transferDirection !== TransferDirection.StructureToExplorer) {
    return null;
  }

  if (guardSlot === BALANCE_TRANSFER_SLOT) {
    return idsMatch(targetExplorerOwner, selectedEntityId)
      ? null
      : "Cannot use structure balance: Explorer is not owned by this structure";
  }

  if (typeof guardSlot === "number") {
    return idsMatch(targetExplorerOwner, selectedEntityId)
      ? null
      : "Cannot transfer troops: Explorer must belong to the selected structure";
  }

  return null;
};
