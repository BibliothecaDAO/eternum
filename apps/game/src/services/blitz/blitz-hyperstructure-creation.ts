import { canIssueOrders } from "@/utils/can-issue-orders";
import { DEFAULT_COORD_ALT } from "@bibliothecadao/eternum";
import type { HexPosition, SystemCalls } from "@bibliothecadao/types";
import type { AccountInterface } from "starknet";

const RESERVED_HYPERSTRUCTURE_CREATE_TIMEOUT_MS = 30_000;

type HyperstructureCreationAccount = AccountInterface;
type PendingCreationListener = () => void;

const pendingReservedHyperstructureCreationTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const pendingReservedHyperstructureCreationListeners = new Set<PendingCreationListener>();

const notifyPendingReservedHyperstructureCreationListeners = () => {
  pendingReservedHyperstructureCreationListeners.forEach((listener) => listener());
};

const subscribePendingReservedHyperstructureCreation = (listener: PendingCreationListener) => {
  pendingReservedHyperstructureCreationListeners.add(listener);

  return () => {
    pendingReservedHyperstructureCreationListeners.delete(listener);
  };
};

const resolvePendingReservedHyperstructureCreationKey = (hexCoords: HexPosition): string =>
  `${hexCoords.col}:${hexCoords.row}`;

const markPendingReservedHyperstructureCreation = (hexCoords: HexPosition) => {
  const creationKey = resolvePendingReservedHyperstructureCreationKey(hexCoords);

  if (pendingReservedHyperstructureCreationTimeouts.has(creationKey)) {
    return false;
  }

  const timeoutId = setTimeout(() => {
    pendingReservedHyperstructureCreationTimeouts.delete(creationKey);
    notifyPendingReservedHyperstructureCreationListeners();
  }, RESERVED_HYPERSTRUCTURE_CREATE_TIMEOUT_MS);

  pendingReservedHyperstructureCreationTimeouts.set(creationKey, timeoutId);
  notifyPendingReservedHyperstructureCreationListeners();
  return true;
};

export const isPendingReservedHyperstructureCreation = (hexCoords: HexPosition): boolean => {
  return pendingReservedHyperstructureCreationTimeouts.has(resolvePendingReservedHyperstructureCreationKey(hexCoords));
};

export const clearPendingReservedHyperstructureCreation = (hexCoords: HexPosition) => {
  const creationKey = resolvePendingReservedHyperstructureCreationKey(hexCoords);
  const timeoutId = pendingReservedHyperstructureCreationTimeouts.get(creationKey);

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  pendingReservedHyperstructureCreationTimeouts.delete(creationKey);
  notifyPendingReservedHyperstructureCreationListeners();
};

export const subscribeBlitzHyperstructureCreationPending = subscribePendingReservedHyperstructureCreation;

/**
 * Creates the reserved hyperstructure at a contract hex, the reservation's own coordinates: every action input takes
 * contract hexes, so a caller holding a scene hex converts it first. False when that hex already has a creation pending.
 */
export const submitActiveWorldBlitzHyperstructureCreation = async ({
  account,
  contractHex,
  systemCalls,
}: {
  account: HyperstructureCreationAccount;
  contractHex: HexPosition;
  systemCalls: Pick<SystemCalls, "create_hyperstructure">;
}) => {
  assertHyperstructureCreationAllowed();
  if (!markPendingReservedHyperstructureCreation(contractHex)) return false;

  try {
    await systemCalls.create_hyperstructure({
      signer: account,
      alt: DEFAULT_COORD_ALT,
      x: contractHex.col,
      y: contractHex.row,
    });
    return true;
  } catch (error) {
    clearPendingReservedHyperstructureCreation(contractHex);
    throw error;
  }
};

function assertHyperstructureCreationAllowed(): void {
  if (!canIssueOrders())
    throw new Error("Hyperstructure creation is unavailable while spectating or after the game ends.");
}
