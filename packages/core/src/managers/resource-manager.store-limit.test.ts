import release from "../../../../contracts/l3/world-native/schema/release-definition.json";
import { ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import {
  nativeResearchConstants as research,
  nativeStructureConstants,
} from "../../../../contracts/l3/world-native/schema/balance.gen";
import { NativeFactStore } from "../client/native-fact-store";
import type { GameSyncFact } from "../sync/game-sync-types";
import { setBuildingCount } from "../utils/packed-data";
import { ResourceManager } from "./resource-manager";

const PRECISION = 1_000_000_000n;
const storerooms = (count: number) => ({
  StructureBuildings: {
    game_id: 1,
    entity_id: 7,
    packed_counts_1: setBuildingCount(research.STOREROOM, [0n, 0n, 0n], count)[0]!,
    packed_counts_2: 0n,
    packed_counts_3: 0n,
    population: { current: 0, max: 0 },
  },
});
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
    ...upsert("0x1", { SliceRules: { ...release.definition.rules, game_id: 1, mode_rules: 0, day_unit_seconds: 0 } }),
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
        ration_step: PRECISION / 4n,
      },
    }),
    ...upsert("0x3", { Structure: realm(0) }),
    ...upsert("0x6", storerooms(0)),
    ...upsert("0x4", { ResourceWeight: { game_id: 1, entity_id: 7, capacity: (1n << 128n) - 1n, weight: 0n } }),
    ...upsert("0x5", { ResourceBalance: { game_id: 1, entity_id: 7, resource_type: 35, balance: wheat } }),
  ]);
  return { store, manager: new ResourceManager(store, 7, 1) };
};

describe("a board realm's store limits", () => {
  const settlementLimit =
    2n * BigInt(release.definition.rules.troop_limit_config.settlement_deployment_cap) * PRECISION;

  it("gives wheat and troops the board's base, labor the release's settlement store, and Essence none", () => {
    const { manager } = boardRealm(0n);
    expect(manager.storeLimit(ResourcesIds.Wheat)).toBe(settlementLimit);
    expect(manager.storeLimit(ResourcesIds.Labor)).toBe(5_000n * PRECISION);
    expect(manager.storeLimit(ResourcesIds.Knight)).toBe(settlementLimit);
    expect(manager.storeLimit(ResourcesIds.Essence)).toBeUndefined();
    expect(manager.storeLimit(ResourcesIds.Lords)).toBeUndefined();
  });

  it("adds half the castle base for a Storeroom, independently of troop storage", () => {
    const { store, manager } = boardRealm(0n);
    store.applyFacts(upsert("0x6", storerooms(1)));
    expect(manager.storeLimit(ResourcesIds.Wheat)).toBe((settlementLimit * 3n) / 2n);
    expect(manager.storeLimit(ResourcesIds.Labor)).toBe((5_000n * PRECISION * 3n) / 2n);
    expect(manager.storeLimit(ResourcesIds.Knight)).toBe(settlementLimit);
  });

  it("counts no Storeroom on a realm whose buildings were never written, as the chain reads it", () => {
    const { store, manager } = boardRealm(0n);
    store.applyFacts([{ model: "StructureBuildings", key: "0x6", value: null }]);
    expect(manager.storeLimit(ResourcesIds.Wheat)).toBe(settlementLimit);
  });

  it("raises the limits with the castle's level", () => {
    const { store, manager } = boardRealm(0n);
    store.applyFacts(upsert("0x3", { Structure: realm(1) }));
    expect(manager.storeLimit(ResourcesIds.Wheat)).toBe(18000n * PRECISION);
  });

  it("applies the exact S2 caps at every realm level with and without a Storeroom, leaving troop caps unchanged", () => {
    const { store, manager } = boardRealm(0n);
    store.applyFacts(
      upsert("0x1", {
        SliceRules: {
          ...release.definition.rules,
          game_id: 1,
          mode_rules: 0,
          day_unit_seconds: 0,
          troop_limit_config: {
            ...release.definition.rules.troop_limit_config,
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
      for (const count of [0, 1]) {
        store.applyFacts(upsert("0x6", storerooms(count)));
        const cap = (BigInt([6000, 18000, 40000, 80000][level]!) * PRECISION * BigInt(2 + count)) / 2n;
        expect(manager.storeLimit(ResourcesIds.Wheat)).toBe(cap);
        expect(manager.storeLimit(ResourcesIds.Labor)).toBe(
          (BigInt([5_000, 15_000, 50_000, 100_000][level]!) * PRECISION * BigInt(2 + count)) / 2n,
        );
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

  it("stores at each castle level the labor the release's LABOR_STORES names, which is 5k, 15k, 50k and 100k", () => {
    const { store } = boardRealm(0n);
    expect(nativeStructureConstants.LABOR_STORES).toEqual([5_000, 15_000, 50_000, 100_000]);
    nativeStructureConstants.LABOR_STORES.forEach((labor, level) =>
      expect(ResourceManager.castleStoreLimit(store, 1, level, ResourcesIds.Labor)).toBe(BigInt(labor) * PRECISION),
    );
    expect(() => ResourceManager.castleStoreLimit(store, 1, 4, ResourcesIds.Labor)).toThrow("Unknown castle level 4");
  });

  it("has no limit of its own off a board", () => {
    const { store, manager } = boardRealm(0n);
    store.applyFacts([{ model: "BoardRules", key: "0x2", value: null }]);
    expect(manager.storeLimit(ResourcesIds.Wheat)).toBeUndefined();
  });
});
