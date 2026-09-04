import { executeObservedClientTransaction } from "@/observability/observed-client-transaction";
import { gameCallArgs, getGameNamespace } from "@/sync/game-scope";
import { getActiveWorld, type WorldProfile } from "@/runtime/world";
import { normalizeSelector } from "@/runtime/world/normalize";
import { getGameManifest } from "@contracts";
import type { GameChain as Chain } from "@realms-world/chain";
import { DEFAULT_COORD_ALT, Position } from "@bibliothecadao/eternum";
import type { HexPosition } from "@bibliothecadao/types";
import { getContractByName } from "@dojoengine/core";
import { CallData } from "starknet";

const RESERVED_HYPERSTRUCTURE_CREATE_TIMEOUT_MS = 30_000;

type HyperstructureCreationAccount = Parameters<typeof executeObservedClientTransaction>[0]["account"];
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

const resolveActiveWorldOrThrow = () => {
  const activeWorld = getActiveWorld();
  if (!activeWorld) {
    throw new Error("Active world profile is unavailable for hyperstructure creation.");
  }

  return activeWorld;
};

const resolveHyperstructureCreateSystemsSelector = (chain: Chain) => {
  const manifest = getGameManifest(chain);
  const hyperstructureCreateSystems = getContractByName(
    manifest,
    getGameNamespace(),
    "hyperstructure_create_systems",
  ) as { selector?: string };
  const selector = hyperstructureCreateSystems.selector
    ? normalizeSelector(hyperstructureCreateSystems.selector)
    : null;

  if (!selector) {
    throw new Error("hyperstructure_create_systems selector not found in manifest");
  }

  return selector;
};

const resolveHyperstructureCreateSystemsAddress = (world: WorldProfile): string => {
  const selector = resolveHyperstructureCreateSystemsSelector(world.chain);
  const contractAddress = world.contractsBySelector[selector] ?? null;

  if (!contractAddress) {
    throw new Error("hyperstructure_create_systems contract not found in the committed world manifest");
  }

  return contractAddress;
};

const resolvePendingReservedHyperstructureCreationKey = (hexCoords: HexPosition): string => {
  const normalizedPosition = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();

  return `${normalizedPosition.x}:${normalizedPosition.y}`;
};

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

const resolveHyperstructureCreateCalldata = (hexCoords: HexPosition) => {
  const contractCoords = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();

  return CallData.compile([
    ...gameCallArgs(),
    {
      alt: DEFAULT_COORD_ALT,
      x: contractCoords.x,
      y: contractCoords.y,
    },
  ]);
};

export const createActiveWorldBlitzHyperstructure = async ({
  account,
  hexCoords,
}: {
  account: HyperstructureCreationAccount;
  hexCoords: HexPosition;
}) => {
  const activeWorld = resolveActiveWorldOrThrow();
  const contractAddress = resolveHyperstructureCreateSystemsAddress(activeWorld);

  return executeObservedClientTransaction({
    account,
    calls: {
      contractAddress,
      entrypoint: "create_hyperstructure",
      calldata: resolveHyperstructureCreateCalldata(hexCoords),
    },
    surface: "settlement",
    operation: "hyperstructure_create_systems.create_hyperstructure",
    chain: activeWorld.chain,
    worldName: activeWorld.name,
    worldAddress: activeWorld.worldAddress,
    waitForConfirmation: false,
  });
};

export const submitActiveWorldBlitzHyperstructureCreation = async ({
  account,
  hexCoords,
}: {
  account: HyperstructureCreationAccount;
  hexCoords: HexPosition;
}) => {
  const markedPending = markPendingReservedHyperstructureCreation(hexCoords);
  if (!markedPending) {
    return false;
  }

  try {
    await createActiveWorldBlitzHyperstructure({
      account,
      hexCoords,
    });
    return true;
  } catch (error) {
    clearPendingReservedHyperstructureCreation(hexCoords);
    throw error;
  }
};
