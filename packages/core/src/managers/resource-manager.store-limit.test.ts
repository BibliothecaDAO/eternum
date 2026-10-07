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
        castle_store_deploys: 2,
        storage_step_bps: 5000,
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
    expect(manager.storeLimit(ResourcesIds.Essence)).toBeUndefined();
    expect(manager.storeLimit(ResourcesIds.Lords)).toBeUndefined();
  });

  it("adds half the castle base per store choice, independently of troop storage", () => {
    const { store, manager } = boardRealm(0n);
    // Farm rare: Granary, Fields. Workshop uncommon: Storeroom.
    store.applyFacts(
      upsert("0x6", {
        RealmKnowledge: { game_id: 1, structure_id: 7, learned: 2n | (1n << 3n) | (1n << 7n) | (1n << 10n) },
      }),
    );
    expect(manager.storeLimit(ResourcesIds.Wheat)).toBe((settlementLimit * 3n) / 2n);
    expect(manager.storeLimit(ResourcesIds.Labor)).toBe((settlementLimit * 3n) / 2n);
    expect(manager.storeLimit(ResourcesIds.Knight)).toBe(settlementLimit);
  });

  it("raises the limits with the castle's level", () => {
    const { store, manager } = boardRealm(0n);
    store.applyFacts(upsert("0x3", { Structure: realm(1) }));
    expect(manager.storeLimit(ResourcesIds.Wheat)).toBe(
      2n * BigInt(preset.rules.troop_limit_config.city_deployment_cap) * PRECISION,
    );
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
    expect(manager.storeLimit(ResourcesIds.Wheat)).toBeUndefined();
  });
});
