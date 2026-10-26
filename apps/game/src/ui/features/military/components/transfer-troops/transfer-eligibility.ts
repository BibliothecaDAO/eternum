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

interface TroopKind {
  tier?: unknown;
  category?: unknown;
  count?: number | bigint;
}

/**
 * The chain's merge rule (`transfer_troops`, `add_guard_troops`): troops join an army or guard slot that holds none,
 * whatever their type, or one that holds the same tier and type. An empty slot has no type to compare against.
 */
export const acceptsTroops = (holder: TroopKind | null | undefined, incoming: TroopKind | null | undefined): boolean =>
  !holder ||
  Number(holder.count ?? 0) === 0 ||
  (!!incoming && holder.tier === incoming.tier && holder.category === incoming.category);

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
      : "Cannot reinforce: different owners";
  }
  if (transferDirection === TransferDirection.StructureToExplorer && guardSlot === BALANCE_TRANSFER_SLOT) {
    return idsMatch(targetExplorerOwner, selectedEntityId) ? null : "Not this structure's army";
  }
  return null;
};
