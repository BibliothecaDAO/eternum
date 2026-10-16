import type { ID } from "@bibliothecadao/types";
import { TransferDirection } from "./transfer-direction";

export const BALANCE_TRANSFER_SLOT = "balance" as const;

type GuardSelection = number | typeof BALANCE_TRANSFER_SLOT | null;

interface TroopTransferParams {
  transferDirection: TransferDirection;
  selectedEntityId: ID;
  sourceHomeOwner?: bigint;
  targetOwner?: bigint;
  targetExplorerOwner?: ID | bigint | null;
  guardSlot: GuardSelection;
}

const idsMatch = (left: ID | bigint | null | undefined, right: ID | bigint | null | undefined): boolean => {
  if (left === null || left === undefined || right === null || right === undefined) {
    return false;
  }

  return String(left) === String(right);
};

/** Armies of one owner merge across realms; the chain still refuses mixed troop types. */
export const getTroopTransferBlockReason = ({
  transferDirection,
  selectedEntityId,
  targetExplorerOwner,
  guardSlot,
  sourceHomeOwner,
  targetOwner,
}: TroopTransferParams): string | null => {
  if (transferDirection === TransferDirection.ExplorerToStructure) {
    return sourceHomeOwner !== undefined && sourceHomeOwner === targetOwner
      ? null
      : "Cannot reinforce: Explorer home and target must have the same owner";
  }
  if (transferDirection === TransferDirection.StructureToExplorer && guardSlot === BALANCE_TRANSFER_SLOT) {
    return idsMatch(targetExplorerOwner, selectedEntityId)
      ? null
      : "Cannot use structure balance: Explorer is not owned by this structure";
  }
  return null;
};
