import type { ClientComponents, ContractAddress } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { buildSelectionFromCosmeticIds, resolveEligibleCosmeticIds } from "./ownership";
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
  private listeners = new Set<(owner?: string) => void>();

  private emitChange(owner?: string): void {
    this.listeners.forEach((listener) => listener(owner));
  }

  subscribe(listener: (owner?: string) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

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
    this.emitChange(snapshot.owner);
  }

  applySelection(owner: ContractAddress | string | bigint, selection: PlayerCosmeticSelection): void {
    const ownerKey = toHexString(toBigInt(owner));
    const snapshot = this.getSnapshot(ownerKey) ?? createEmptySnapshot(ownerKey);

    this.setSnapshot({
      ...snapshot,
      selection: {
        armies: {
          ...(snapshot.selection.armies ?? {}),
          ...(selection.armies ?? {}),
        },
        structures: {
          ...(snapshot.selection.structures ?? {}),
          ...(selection.structures ?? {}),
        },
        globalAttachments: selection.globalAttachments ?? snapshot.selection.globalAttachments ?? [],
      },
    });
  }

  setPendingBlitzLoadout(
    worldKey: string,
    owner: ContractAddress | string | bigint,
    draft: BlitzGameLoadoutDraft,
  ): void {
    const ownerKey = toHexString(toBigInt(owner));
    const snapshot = this.getSnapshot(ownerKey) ?? createEmptySnapshot(ownerKey);
    const selectedCosmeticIds = Object.values(draft.selectedBySlot ?? {}).flatMap((selection) => selection.cosmeticIds);
    const derivedSelection = buildSelectionFromCosmeticIds(selectedCosmeticIds);
    const hasAppliedLoadout = Boolean(snapshot.activeBlitzLoadouts?.[worldKey]);

    this.setSnapshot({
      ...snapshot,
      pendingBlitzLoadouts: {
        ...snapshot.pendingBlitzLoadouts,
        [worldKey]: {
          tokenIds: [...draft.tokenIds],
          selectedBySlot: draft.selectedBySlot ? { ...draft.selectedBySlot } : {},
        },
      },
      selection: hasAppliedLoadout ? snapshot.selection : derivedSelection,
    });
  }

  getPendingBlitzLoadout(
    worldKey: string,
    owner: ContractAddress | string | bigint,
  ): BlitzGameLoadoutDraft | undefined {
    const ownerKey = toHexString(toBigInt(owner));
    return this.getSnapshot(ownerKey)?.pendingBlitzLoadouts?.[worldKey];
  }

  markAppliedBlitzLoadout(worldKey: string, owner: ContractAddress | string | bigint): void {
    const ownerKey = toHexString(toBigInt(owner));
    const snapshot = this.getSnapshot(ownerKey) ?? createEmptySnapshot(ownerKey);
    const pendingLoadout = snapshot.pendingBlitzLoadouts?.[worldKey];

    if (!pendingLoadout) {
      return;
    }

    const selectedCosmeticIds = Object.values(pendingLoadout.selectedBySlot ?? {}).flatMap(
      (selection) => selection.cosmeticIds,
    );

    this.setSnapshot({
      ...snapshot,
      activeBlitzLoadouts: {
        ...snapshot.activeBlitzLoadouts,
        [worldKey]: pendingLoadout,
      },
      ownership: {
        ...snapshot.ownership,
        eligibleCosmeticIds: Array.from(new Set([...snapshot.ownership.eligibleCosmeticIds, ...selectedCosmeticIds])),
      },
      selection: buildSelectionFromCosmeticIds(selectedCosmeticIds),
    });
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
    const eligibleCosmeticIds = resolveEligibleCosmeticIds(ownedAttrs);
    const previous = this.snapshots.get(ownerKey) ?? createEmptySnapshot(ownerKey);

    const snapshot: PlayerCosmeticsSnapshot = {
      ...previous,
      ownership: {
        owner: ownerKey,
        version: DEFAULT_VERSION,
        ownedAttrs,
        eligibleCosmeticIds,
      },
      selection:
        Object.keys(previous.selection.armies ?? {}).length > 0 ||
        Object.keys(previous.selection.structures ?? {}).length > 0 ||
        (previous.selection.globalAttachments?.length ?? 0) > 0
          ? previous.selection
          : buildSelectionFromCosmeticIds(eligibleCosmeticIds),
    };

    this.snapshots.set(ownerKey, snapshot);
    this.emitChange(ownerKey);
    return snapshot;
  }

  clear() {
    this.snapshots.clear();
    this.emitChange();
  }
}

export const playerCosmeticsStore = new PlayerCosmeticsStore();
