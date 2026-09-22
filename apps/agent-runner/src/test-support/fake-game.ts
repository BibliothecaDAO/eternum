import {
  ClientConfigManager,
  createGameActions,
  createGameViews,
  type GameActions,
  type GameClient,
} from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { WorldSpatialProjection, type HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import { ContractAddress, StructureType } from "@bibliothecadao/types";
import { hash, type AccountInterface } from "starknet";
import { vi } from "vitest";
import preset from "../../../../contracts/l3/world-native/fixtures/preset-3.json";
import explorer from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import type { RecentStoryEvent, RunnerGame } from "../game";

const GAME_ID = 28;
export const PLAYER = ContractAddress(0xabcn);
const PLAYER_SIGNER = { address: "0xabc" } as AccountInterface;

type ProviderListener = (event: { transactionHash: string }) => void;

interface FakeGame extends RunnerGame {
  store: NativeFactStore;
  actions: { [Key in keyof GameActions]: ReturnType<typeof vi.fn> };
  /** Announce a submitted hash the way the provider does after an action signs. */
  announceSubmitted(transactionHash: string): void;
  /** Tell slice subscribers a batch of rows landed, the way the runtime does after each applied slice. */
  applySlice(): void;
  /** Report the live stream as broken, the way the observer's onLiveApplyFailed does. */
  failSync(error: Error): void;
  events: RecentStoryEvent[];
}

/**
 * An in-memory native store behind the shape of a booted client: views and the projection are real, actions and the
 * transaction wait are stubs the tests script.
 */
export const createFakeGame = (signer: AccountInterface | null = PLAYER_SIGNER): FakeGame => {
  ClientConfigManager.instance().setActiveGame(GAME_ID, 0);
  const store = new NativeFactStore();
  writeFact(store, "SliceRules", [GAME_ID], { ...preset.rules, game_id: GAME_ID, map_center_offset: 2147483646 });
  writeFact(store, "SettlementRules", [GAME_ID], {
    game_id: GAME_ID,
    registration_start: 0,
    registration_limit: 100,
    mode: "Triple",
    spacing: 6,
  });
  ClientConfigManager.instance().setStore(store);
  const projection = new WorldSpatialProjection({
    store,
  });
  projection.start();
  const listeners = new Set<ProviderListener>();
  const provider = {
    on: (_event: string, listener: ProviderListener) => listeners.add(listener),
    off: (_event: string, listener: ProviderListener) => listeners.delete(listener),
  };
  const actions = Object.fromEntries(
    Object.keys(createGameActions({ setup: { store } } as GameClient)).map((name) => [name, vi.fn()]),
  ) as FakeGame["actions"];
  const sliceListeners = new Set<() => void>();
  const syncFailureListeners = new Set<(error: Error) => void>();
  const runtime = {
    waitForTransaction: vi.fn(async (hash: string) => ({ hash, status: "ACCEPTED_ON_L2", block: 7 })),
    subscribeSliceApplied: (listener: () => void) => {
      sliceListeners.add(listener);
      return () => sliceListeners.delete(listener);
    },
  };
  const client = {
    gameId: GAME_ID,
    setup: {
      store,
      systemCalls: { provision_realm: vi.fn(async () => ({ transaction_hash: "0x123" })) },
      network: { provider },
    },
    signer,
    projection,
    runtime,
    actions,
  } as unknown as GameClient;
  Object.assign(client, { views: createGameViews(client, ContractAddress(signer?.address ?? 0n)) });
  const events: RecentStoryEvent[] = [];
  return {
    client,
    store,
    actions,
    events,
    listing: { name: "lab-game", game_id: GAME_ID, mode: "blitz" } as HeraldGameDirectoryEntry,
    viewer: () => ContractAddress(client.signer?.address ?? 0n),
    recentEvents: () => events,
    onSyncFailed: (listener) => {
      syncFailureListeners.add(listener);
      return () => syncFailureListeners.delete(listener);
    },
    announceSubmitted: (transactionHash) => listeners.forEach((listener) => listener({ transactionHash })),
    applySlice: () => sliceListeners.forEach((listener) => listener()),
    failSync: (error) => syncFailureListeners.forEach((listener) => listener(error)),
  };
};

export function writeFact(
  store: NativeFactStore,
  model: string,
  keys: (number | bigint)[],
  value: Record<string, unknown>,
): void {
  store.applyEntityOperations([
    {
      type: "upsert",
      entities: [{ hashed_keys: hash.computePoseidonHashOnElements(keys), models: { [model]: value } }],
    },
  ]);
}

export const seedStructure = (
  store: NativeFactStore,
  input: { entityId: number; owner: ContractAddress; x: number; y: number; category?: StructureType; level?: number },
): void => {
  writeFact(store, "Structure", [GAME_ID, input.entityId], {
    game_id: GAME_ID,
    entity_id: input.entityId,
    owner: input.owner,
    base: {
      category: input.category ?? StructureType.Realm,
      coord_x: input.x,
      coord_y: input.y,
      alt: false,
      level: input.level ?? 1,
      troop_max_guard_count: 4,
      troop_max_explorer_count: 3,
      troop_explorer_count: 0,
      created_at: 0,
      starting_troops_granted: true,
    },
    metadata: {
      realm_id: input.entityId,
      order: 1,
      has_wonder: false,
      village_realm: 0,
      mine_kind: 0,
      attunement: 0,
      barracks_tier: 0,
    },
    troop_explorers: [],
    resources_packed: 0n,
  });
  writeFact(store, "ResourceWeight", [GAME_ID, input.entityId], {
    game_id: GAME_ID,
    entity_id: input.entityId,
    capacity: 1000000000000n,
    weight: 0n,
  });
};

export const seedExplorer = (
  store: NativeFactStore,
  input: { explorerId: number; owner: number; x: number; y: number; stamina?: bigint; count?: bigint; alt?: boolean },
): void => {
  writeFact(store, "ExplorerTroops", [GAME_ID, input.explorerId], {
    ...explorer.expected.value,
    game_id: GAME_ID,
    explorer_id: input.explorerId,
    owner: input.owner,
    troops: {
      ...explorer.expected.value.troops,
      category: "Knight",
      tier: "T1",
      count: input.count ?? 10000000000n,
      stamina: { amount: input.stamina ?? 20n, updated_tick: 0n },
    },
    coord: { x: input.x, y: input.y, alt: input.alt ?? false },
  });
};

export const seedGameRegistry = (
  store: NativeFactStore,
  input: { status: string; startMainAt: number; endAt: number },
): void => {
  writeFact(store, "GameRegistry", [GAME_ID], {
    game_id: GAME_ID,
    name: 0n,
    preset_id: 3,
    creator: 0n,
    settled: input.status === "Ended",
    ready: true,
    dev_mode_on: true,
    start_settling_at: 0n,
    start_main_at: BigInt(input.startMainAt),
    end_at: BigInt(input.endAt),
    end_grace_seconds: 0,
    seed: 0n,
  });
};
