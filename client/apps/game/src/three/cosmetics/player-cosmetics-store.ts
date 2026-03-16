import type { ClientComponents, ContractAddress } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { resolveEligibleCosmeticIds } from "./ownership";
import { BlitzGameLoadoutDraft, PlayerCosmeticsSnapshot, PlayerCosmeticSelection } from "./types";

const DEFAULT_VERSION = 1;

const toBigInt = (value: ContractAddress | string | bigint): bigint => {
  if (typeof value === "bigint") return value;
  if (typeof value === "string") {
    if (value.startsWith("0x") || value.startsWith("0X")) {
      return BigInt(value);
    }
    return BigInt(value);
  }
  return BigInt(value);
};

const toHexString = (value: bigint): string => `0x${value.toString(16)}`;

const normalizeOwnedAttrs = (attrs: Iterable<bigint> | undefined): string[] => {
  if (!attrs) return [];
  const tokens: string[] = [];
  for (const value of attrs) {
    tokens.push(toHexString(value));
  }
  return tokens;
};

const createEmptySelection = (): PlayerCosmeticSelection => ({
  armies: {},
  structures: {},
  globalAttachments: [],
});

const createEmptySnapshot = (owner: string): PlayerCosmeticsSnapshot => ({
  owner,
  version: DEFAULT_VERSION,
  ownership: {
    owner,
    version: DEFAULT_VERSION,
    ownedAttrs: [],
    eligibleCosmeticIds: [],
  },
  selection: createEmptySelection(),
  pendingBlitzLoadouts: {},
  activeBlitzLoadouts: {},
});

/**
 * Simple in-memory store seeded from the recs component. Phase 2 will connect real data.
 */
class PlayerCosmeticsStore {
  private snapshots = new Map<string, PlayerCosmeticsSnapshot>();
  private readyPromise: Promise<void> = Promise.resolve();

  async prefetch(): Promise<void> {
    await this.readyPromise;
  }

  getSnapshot(address: string): PlayerCosmeticsSnapshot | undefined {
    return this.snapshots.get(address);
  }

  setSnapshot(snapshot: PlayerCosmeticsSnapshot) {
    this.snapshots.set(snapshot.owner, {
      ...createEmptySnapshot(snapshot.owner),
      ...snapshot,
      ownership: {
        ...createEmptySnapshot(snapshot.owner).ownership,
        ...snapshot.ownership,
      },
      selection: {
        ...createEmptySelection(),
        ...snapshot.selection,
      },
      pendingBlitzLoadouts: snapshot.pendingBlitzLoadouts ?? {},
      activeBlitzLoadouts: snapshot.activeBlitzLoadouts ?? {},
    });
  }

  setPendingBlitzLoadout(worldKey: string, owner: ContractAddress | string | bigint, draft: BlitzGameLoadoutDraft): void {
    const ownerKey = toHexString(toBigInt(owner));
    const snapshot = this.getSnapshot(ownerKey) ?? createEmptySnapshot(ownerKey);
    this.setSnapshot({
      ...snapshot,
      pendingBlitzLoadouts: {
        ...snapshot.pendingBlitzLoadouts,
        [worldKey]: {
          tokenIds: [...draft.tokenIds],
        },
      },
    });
  }

  getPendingBlitzLoadout(
    worldKey: string,
    owner: ContractAddress | string | bigint,
  ): BlitzGameLoadoutDraft | undefined {
    const ownerKey = toHexString(toBigInt(owner));
    return this.getSnapshot(ownerKey)?.pendingBlitzLoadouts?.[worldKey];
  }

  hydrateFromBlitzComponent(
    components: ClientComponents,
    owner: ContractAddress | string | bigint,
  ): PlayerCosmeticsSnapshot | undefined {
    const ownerBigInt = toBigInt(owner);
    const ownerKey = toHexString(ownerBigInt);
    const entityId = getEntityIdFromKeys([ownerBigInt]);

    const value = getComponentValue(components.BlitzCosmeticAttrsRegister, entityId);
    if (!value) {
      return undefined;
    }

    const ownedAttrs = normalizeOwnedAttrs(value.attrs as Iterable<bigint> | undefined);
    const previous = this.snapshots.get(ownerKey) ?? createEmptySnapshot(ownerKey);

    const snapshot: PlayerCosmeticsSnapshot = {
      ...previous,
      ownership: {
        owner: ownerKey,
        version: DEFAULT_VERSION,
        ownedAttrs,
        eligibleCosmeticIds: resolveEligibleCosmeticIds(ownedAttrs),
      },
    };

    this.snapshots.set(ownerKey, snapshot);
    return snapshot;
  }

  clear() {
    this.snapshots.clear();
  }
}

export const playerCosmeticsStore = new PlayerCosmeticsStore();
