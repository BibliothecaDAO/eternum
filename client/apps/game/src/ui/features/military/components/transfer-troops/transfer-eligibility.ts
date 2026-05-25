import type { ID } from "@bibliothecadao/types";
import { TransferDirection } from "./transfer-direction";

export const BALANCE_TRANSFER_SLOT = "balance" as const;

type GuardSelection = number | typeof BALANCE_TRANSFER_SLOT | null;

interface SameStructureTransferParams {
  transferDirection: TransferDirection;
  selectedEntityId: ID;
  targetEntityId: ID;
  selectedExplorerOwner?: ID | bigint | null;
  targetExplorerOwner?: ID | bigint | null;
  guardSlot: GuardSelection;
}

const idsMatch = (left: ID | bigint | null | undefined, right: ID | bigint | null | undefined): boolean => {
  if (left === null || left === undefined || right === null || right === undefined) {
    return false;
  }

  return String(left) === String(right);
};

export const getSameStructureTransferBlockReason = ({
  transferDirection,
  selectedEntityId,
  targetEntityId,
  selectedExplorerOwner,
  targetExplorerOwner,
  guardSlot,
}: SameStructureTransferParams): string | null => {
  if (transferDirection === TransferDirection.ExplorerToExplorer) {
    return idsMatch(selectedExplorerOwner, targetExplorerOwner)
      ? null
      : "Cannot transfer troops: Both explorers must belong to the same structure";
  }

  if (transferDirection === TransferDirection.ExplorerToStructure) {
    return idsMatch(selectedExplorerOwner, targetEntityId)
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
