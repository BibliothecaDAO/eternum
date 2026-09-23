import { canIssueOrders } from "@/utils/can-issue-orders";
import { DEFAULT_COORD_ALT, Position } from "@bibliothecadao/eternum";
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

const createActiveWorldBlitzHyperstructure = async ({
  account,
  hexCoords,
  systemCalls,
}: {
  account: HyperstructureCreationAccount;
  hexCoords: HexPosition;
  systemCalls: Pick<SystemCalls, "create_hyperstructure">;
}) => {
  assertHyperstructureCreationAllowed();
  const coord = Position.fromNormalized({ x: hexCoords.col, y: hexCoords.row }).getContract();
  return systemCalls.create_hyperstructure({ signer: account, alt: DEFAULT_COORD_ALT, x: coord.x, y: coord.y });
};

export const submitActiveWorldBlitzHyperstructureCreation = async ({
  account,
  hexCoords,
  systemCalls,
}: {
  account: HyperstructureCreationAccount;
  hexCoords: HexPosition;
  systemCalls: Pick<SystemCalls, "create_hyperstructure">;
}) => {
  assertHyperstructureCreationAllowed();
  const markedPending = markPendingReservedHyperstructureCreation(hexCoords);
  if (!markedPending) {
    return false;
  }

  try {
    await createActiveWorldBlitzHyperstructure({
      account,
      hexCoords,
      systemCalls,
    });
    return true;
  } catch (error) {
    clearPendingReservedHyperstructureCreation(hexCoords);
    throw error;
  }
};

function assertHyperstructureCreationAllowed(): void {
  if (!canIssueOrders())
    throw new Error("Hyperstructure creation is unavailable while spectating or after the game ends.");
}
