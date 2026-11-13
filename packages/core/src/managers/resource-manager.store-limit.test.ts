import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import type { GameSyncFact } from "../sync/game-sync-types";
import { ResourceManager } from "./resource-manager";

const PRECISION = 1_000_000_000n;
const upsert = (key: string, models: Record<string, Record<string, unknown>>): GameSyncFact[] =>
  Object.entries(models).map(([model, value]) => ({ model, key, value }));
const realm = (level: number) => ({
  game_id: 1,
  entity_id: 7,
  owner: 0x111n,
  base: {
    category: 1,
    level,
    created_at: 0n,
    troop_max_guard_count: 0,
    troop_max_explorer_count: 0,
    starting_troops_granted: false,
  },
  resources_packed: 0n,
  metadata: { realm_id: 1, village_realm: 0, mine_kind: 0, deepest_depth: 0, has_wonder: false, order: 0 },
});

const boardRealm = (wheat: bigint) => {
  const store = new NativeFactStore();
  store.setSnapshot({ gameId: 1, complete: true, actor: null, timestamp: 100 });
  store.applyFacts([
    ...upsert("0x1", { SliceRules: { ...preset.rules, game_id: 1, mode_rules: 0 } }),
    ...upsert("0x2", {
      BoardRules: {
        game_id: 1,
        demolition_refund_bps: 0,
        workshop_rate: 0n,
        output_step_bps: 2500,
        troop_store_deploys: 2,
        settlement_resource_cap: 6000,
        city_resource_cap: 18000,
        kingdom_resource_cap: 40000,
        empire_resource_cap: 80000,
        storage_step_bps: 5000,
        population_step_bps: 2500,
        ration_step: PRECISION / 4n,
        town: null,
        training_gate_tier: 2,
      },
    }),
    ...upsert("0x3", { Structure: realm(0) }),
    ...upsert("0x6", { RealmKnowledge: { game_id: 1, structure_id: 7, learned: 0n } }),
    ...upsert("0x4", { ResourceWeight: { game_id: 1, entity_id: 7, capacity: (1n << 128n) - 1n, weight: 0n } }),
    ...upsert("0x5", { ResourceBalance: { game_id: 1, entity_id: 7, resource_type: 35, balance: wheat } }),
  ]);
  return { store, manager: new ResourceManager(store, 7, 1) };
};

describe("a board realm's store limits", () => {
  const settlementLimit = 2n * BigInt(preset.rules.troop_limit_config.settlement_deployment_cap) * PRECISION;

  it("gives wheat, labor and troops each the castle's base, and Essence none", () => {
    const { manager } = boardRealm(0n);
    expect(manager.storeLimit(ResourcesIds.Wheat)).toBe(settlementLimit);
    expect(manager.storeLimit(ResourcesIds.Labor)).toBe(settlementLimit);
    expect(manager.storeLimit(ResourcesIds.Knight)).toBe(settlementLimit);
    expect(manager.storeLimit(ResourcesIds.Essence)).toBeNull();
    expect(manager.storeLimit(ResourcesIds.Lords)).toBeNull();
  });

  it("adds half the castle base per store choice, independently of troop storage", () => {
    const { store, manager } = boardRealm(0n);
    // One upgrade on each Farm and Workshop side.
    store.applyFacts(
      upsert("0x6", {
        RealmKnowledge: { game_id: 1, structure_id: 7, learned: 1n | (1n << 3n) | (1n << 7n) | (1n << 10n) },
      }),
    );
    expect(manager.storeLimit(ResourcesIds.Wheat)).toBe((settlementLimit * 3n) / 2n);
    expect(manager.storeLimit(ResourcesIds.Labor)).toBe((settlementLimit * 3n) / 2n);
    expect(manager.storeLimit(ResourcesIds.Knight)).toBe(settlementLimit);
  });

  it("raises the limits with the castle's level", () => {
    const { store, manager } = boardRealm(0n);
    store.applyFacts(upsert("0x3", { Structure: realm(1) }));
    expect(manager.storeLimit(ResourcesIds.Wheat)).toBe(18000n * PRECISION);
  });

  it("applies the exact S2 caps at every realm level and storage count, leaving troop caps unchanged", () => {
    const { store, manager } = boardRealm(0n);
    store.applyFacts(
      upsert("0x1", {
        SliceRules: {
          ...preset.rules,
          game_id: 1,
          mode_rules: 0,
          troop_limit_config: {
            ...preset.rules.troop_limit_config,
            settlement_deployment_cap: 3000,
            city_deployment_cap: 9000,
            kingdom_deployment_cap: 25000,
            empire_deployment_cap: 60000,
          },
        },
      }),
    );
    for (let level = 0; level < 4; level++) {
      store.applyFacts(upsert("0x3", { Structure: realm(level) }));
      for (let picks = 0; picks <= 4; picks++) {
        store.applyFacts(
          upsert("0x6", {
            RealmKnowledge: { game_id: 1, structure_id: 7, learned: (BigInt(picks) << 3n) | (BigInt(picks) << 10n) },
          }),
        );
        const cap = (BigInt([6000, 18000, 40000, 80000][level]!) * PRECISION * BigInt(2 + picks)) / 2n;
        expect(manager.storeLimit(ResourcesIds.Wheat)).toBe(cap);
        expect(manager.storeLimit(ResourcesIds.Labor)).toBe(cap);
        expect(manager.storeLimit(ResourcesIds.Knight)).toBe(BigInt([6000, 18000, 50000, 120000][level]!) * PRECISION);
      }
    }
  });

  it("keeps nothing more in a store at its limit, and shows it full", () => {
    const { manager } = boardRealm(settlementLimit);
    const wheat = manager.balanceWithProduction(100, ResourcesIds.Wheat)!;
    expect(wheat.balance).toBe(Number(settlementLimit));
    expect(wheat.hasReachedMaxCapacity).toBe(true);
  });

  it("has no limit of its own off a board", () => {
    const { store, manager } = boardRealm(0n);
    store.applyFacts([{ model: "BoardRules", key: "0x2", value: null }]);
    expect(manager.storeLimit(ResourcesIds.Wheat)).toBeNull();
  });
});

it("reads independent town caps and the standing Storeroom at every level, including replayed removal", () => {
  const { store, manager } = boardRealm(0n);
  const board = store.require("BoardRules", { game_id: 1 });
  store.applyFacts(
    upsert("0x2", {
      BoardRules: {
        ...board,
        town: {
          settlement_labor_cap: 5000,
          city_labor_cap: 15000,
          kingdom_labor_cap: 50000,
          empire_labor_cap: 100000,
        },
      },
    }),
  );
  const counts = (standing: boolean) =>
    upsert("0x7", {
      StructureBuildings: {
        game_id: 1,
        entity_id: 7,
        packed_counts_1: standing ? 256n : 0n,
        packed_counts_2: 0n,
        packed_counts_3: 0n,
        population: { current: 0, max: 0 },
      },
    });
  let notifications = 0;
  const unsubscribe = manager.subscribe(() => notifications++);
  for (let level = 0; level < 4; level++) {
    store.applyFacts(upsert("0x3", { Structure: realm(level) }));
    for (const standing of [false, true, false]) {
      const before = notifications;
      store.applyFacts(counts(standing));
      const multiplier = standing ? 2n : 1n;
      expect(manager.storeLimit(ResourcesIds.Labor)).toBe(
        BigInt([5000, 15000, 50000, 100000][level]!) * multiplier * PRECISION,
      );
      expect(manager.storeLimit(ResourcesIds.Wheat)).toBe(
        BigInt([6000, 18000, 40000, 80000][level]!) * multiplier * PRECISION,
      );
      expect(manager.storeLimit(ResourcesIds.Knight)).toBe(BigInt([6000, 30000, 90000, 180000][level]!) * PRECISION);
      if (standing) expect(notifications).toBeGreaterThan(before);
    }
  }
  expect(manager.storeLimitAtLevel(ResourcesIds.Labor, 1)).toBe(15000n * PRECISION);
  expect(manager.storeLimit(ResourcesIds.Essence)).toBeNull();
  unsubscribe();
});

it("keeps a town balance unknown until the cap inputs arrive, then clips and recovers from replay", () => {
  const { store, manager } = boardRealm(5999n * PRECISION);
  const keys = { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Wheat };
  const carry = store.requireOrAbsent("ProductionCarry", keys).known!;
  store.applyFacts([
    ...upsert("0x2", {
      BoardRules: {
        ...store.require("BoardRules", { game_id: 1 }),
        town: {
          settlement_labor_cap: 5000,
          city_labor_cap: 15000,
          kingdom_labor_cap: 50000,
          empire_labor_cap: 100000,
        },
      },
    }),
    ...upsert("0x8", {
      ResourceProduction: {
        ...keys,
        building_count: 1,
        production_rate: 2n * PRECISION,
        output_amount_left: 0n,
        last_settled_at: 100,
      },
    }),
    ...upsert("0x9", { ProductionCarry: { ...carry, ...keys } }),
  ]);
  store.setSnapshot({ gameId: 1, complete: false, actor: null, timestamp: 100 });
  expect(manager.current(ResourcesIds.Wheat)).toBeDefined();
  expect(manager.storeLimit(ResourcesIds.Wheat)).toBeUndefined();
  expect(manager.storeLimitAtLevel(ResourcesIds.Labor, 1)).toBeUndefined();
  expect(manager.balanceWithProduction(101, ResourcesIds.Wheat)).toBeUndefined();
  let notices = 0;
  const stop = manager.subscribe(() => notices++);
  const counts = (packed: bigint) =>
    upsert("0x7", {
      StructureBuildings: {
        game_id: 1,
        entity_id: 7,
        packed_counts_1: packed,
        packed_counts_2: 0n,
        packed_counts_3: 0n,
        population: { current: 0, max: 0 },
      },
    });
  store.applyFacts(counts(0n));
  expect(manager.balanceWithProduction(101, ResourcesIds.Wheat)).toMatchObject({
    balance: Number(6000n * PRECISION),
    hasReachedMaxCapacity: true,
    amountProducedLimited: PRECISION,
  });
  store.applyFacts(counts(256n));
  expect(manager.balanceWithProduction(101, ResourcesIds.Wheat)).toMatchObject({
    balance: Number(6001n * PRECISION),
    hasReachedMaxCapacity: false,
    amountProducedLimited: 2n * PRECISION,
  });
  store.applyFacts([{ model: "StructureBuildings", key: "0x7", value: null }]);
  expect(manager.balanceWithProduction(101, ResourcesIds.Wheat)).toBeUndefined();
  store.applyFacts(counts(0n));
  expect(manager.storeLimit(ResourcesIds.Wheat)).toBe(6000n * PRECISION);
  expect(notices).toBe(4);
  stop();
});

it("distinguishes an unknown board or research dependency from a known unlimited store", () => {
  const { store, manager } = boardRealm(0n);
  store.setSnapshot({ gameId: 1, complete: false, actor: null, timestamp: 100 });
  store.applyFacts([{ model: "RealmKnowledge", key: "0x6", value: null }]);
  expect(manager.storeLimit(ResourcesIds.Wheat)).toBeUndefined();
  store.applyFacts([{ model: "BoardRules", key: "0x2", value: null }]);
  expect(manager.storeLimit(ResourcesIds.Wheat)).toBeUndefined();
  store.setSnapshot({ gameId: 1, complete: true, actor: null, timestamp: 100 });
  expect(manager.storeLimit(ResourcesIds.Wheat)).toBeNull();
  expect(manager.storeLimit(ResourcesIds.Essence)).toBeNull();
});
