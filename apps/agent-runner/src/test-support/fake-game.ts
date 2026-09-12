import {
  ClientConfigManager,
  createGameActions,
  createGameViews,
  gameEntityKey,
  getEntityIdFromKeys,
  type GameActions,
  type GameClient,
} from "@bibliothecadao/eternum";
import { WorldSpatialProjection, type HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import {
  type ClientComponents,
  ContractAddress,
  createClientComponents,
  defineContractComponents,
  StructureType,
} from "@bibliothecadao/types";
import { type Component, type ComponentValue, createWorld, type Schema, setComponent, Type } from "@dojoengine/recs";
import type { AccountInterface } from "starknet";
import { vi } from "vitest";

import type { RecentStoryEvent, RunnerGame } from "../game";

const GAME_ID = 28;
export const PLAYER = ContractAddress(0xabcn);
const PLAYER_SIGNER = { address: "0xabc" } as AccountInterface;

type ProviderListener = (event: { transactionHash: string }) => void;

interface FakeGame extends RunnerGame {
  components: ClientComponents;
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
 * An in-memory RECS world behind the shape of a booted client: views and the projection are real, actions and the
 * transaction wait are stubs the tests script.
 */
export const createFakeGame = (signer: AccountInterface | null = PLAYER_SIGNER): FakeGame => {
  ClientConfigManager.instance().setActiveGame(GAME_ID, 0);
  const components = createClientComponents({ contractComponents: defineContractComponents(createWorld(), "s2") });
  const projection = new WorldSpatialProjection({
    tileOptComponent: components.TileOpt,
    explorerTroopsComponent: components.ExplorerTroops,
  });
  projection.start();
  const listeners = new Set<ProviderListener>();
  const provider = {
    on: (_event: string, listener: ProviderListener) => listeners.add(listener),
    off: (_event: string, listener: ProviderListener) => listeners.delete(listener),
  };
  const actions = Object.fromEntries(
    Object.keys(createGameActions({ setup: { components } } as GameClient)).map((name) => [name, vi.fn()]),
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
    setup: { components, systemCalls: {}, network: { provider } },
    signer,
    projection,
    runtime,
    actions,
  } as unknown as GameClient;
  Object.assign(client, { views: createGameViews(client, ContractAddress(signer?.address ?? 0n)) });
  const events: RecentStoryEvent[] = [];
  return {
    client,
    components,
    actions,
    events,
    listing: { name: "lab-game", game_id: GAME_ID, mode: "blitz" } as HeraldGameDirectoryEntry,
    systems: { blitzRealm: "0xb117" },
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

export const seedStructure = (
  components: ClientComponents,
  input: { entityId: number; owner: ContractAddress; x: number; y: number; category?: StructureType; level?: number },
): void =>
  setComponent(
    components.Structure,
    gameEntityKey([BigInt(input.entityId)]),
    rowOf(components.Structure, {
      game_id: GAME_ID,
      entity_id: input.entityId,
      owner: input.owner,
      category: input.category ?? StructureType.Realm,
      base: {
        category: input.category ?? StructureType.Realm,
        coord_x: input.x,
        coord_y: input.y,
        level: input.level ?? 1,
        troop_max_guard_count: 4,
        troop_max_explorer_count: 3,
      },
    }),
  );

export const seedExplorer = (
  components: ClientComponents,
  input: { explorerId: number; owner: number; x: number; y: number; stamina?: bigint; count?: bigint },
): void =>
  setComponent(
    components.ExplorerTroops,
    gameEntityKey([BigInt(input.explorerId)]),
    rowOf(components.ExplorerTroops, {
      game_id: GAME_ID,
      explorer_id: input.explorerId,
      owner: input.owner,
      troops: {
        category: "Knight",
        tier: "T1",
        count: input.count ?? 10_000_000_000n,
        stamina: { amount: input.stamina ?? 50n },
      },
      coord: { x: input.x, y: input.y, alt: false },
    }),
  );

export const seedGameRegistry = (
  components: ClientComponents,
  input: { status: string; startMainAt: number; endAt: number },
): void =>
  // The registry row is keyed by the game id alone, not under the active game prefix.
  setComponent(
    components.GameRegistry,
    getEntityIdFromKeys([BigInt(GAME_ID)]),
    rowOf(components.GameRegistry, {
      game_id: GAME_ID,
      status: input.status,
      start_main_at: BigInt(input.startMainAt),
      end_at: BigInt(input.endAt),
    }),
  );

type DeepPartial<T> = { [Key in keyof T]?: T[Key] extends object ? DeepPartial<T[Key]> : T[Key] };

/** A full row for a component: every field zeroed from the schema, with the fields under test overridden. */
const rowOf = <S extends Schema>(
  component: Component<S>,
  overrides: DeepPartial<ComponentValue<S>>,
): ComponentValue<S> => merge(zeroRow(component.schema), overrides) as ComponentValue<S>;

const zeroRow = (schema: Schema): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(schema).map(([key, type]) => [key, typeof type === "object" ? zeroRow(type) : zeroValue(type)]),
  );

const zeroValue = (type: Type): unknown => {
  switch (type) {
    case Type.Boolean:
      return false;
    case Type.BigInt:
      return 0n;
    case Type.String:
      return "";
    case Type.NumberArray:
      return [];
    default:
      return 0;
  }
};

const merge = (base: Record<string, unknown>, overrides: object): Record<string, unknown> => {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    merged[key] =
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? merge(base[key] as Record<string, unknown>, value)
        : value;
  }
  return merged;
};
