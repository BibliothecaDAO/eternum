import type { ClientComponents, ContractAddress } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { PlayerCosmeticsSnapshot } from "./types";

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

const normalizeTokenIds = (attrs: Iterable<bigint> | undefined): string[] => {
  if (!attrs) return [];
  const tokens: string[] = [];
  for (const value of attrs) {
    tokens.push(toHexString(value));
  }
  return tokens;
};

/**
 * Simple in-memory store seeded from the recs component. Phase 2 will connect real data.
 */
export class PlayerCosmeticsStore {
  private snapshots = new Map<string, PlayerCosmeticsSnapshot>();
  private readyPromise: Promise<void> = Promise.resolve();

  async prefetch(): Promise<void> {
    await this.readyPromise;
  }

  getSnapshot(address: string): PlayerCosmeticsSnapshot | undefined {
    return this.snapshots.get(address);
  }

  setSnapshot(snapshot: PlayerCosmeticsSnapshot) {
    this.snapshots.set(snapshot.owner, snapshot);
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

    const tokens = normalizeTokenIds(value.attrs as Iterable<bigint> | undefined);

    const snapshot: PlayerCosmeticsSnapshot = {
      owner: ownerKey,
      version: DEFAULT_VERSION,
      selection: {
        armies: {},
        structures: {},
        attachments: [],
        tokens,
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
