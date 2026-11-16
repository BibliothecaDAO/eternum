import { describe, expect, it } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import type { GameSyncFact } from "../sync/game-sync-types";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/conformance.json";
import { canPayTroopRaise, readTroopRaiseCost } from "./troop-raise-cost";

const PRECISION = 1_000_000_000n;
const upsert = (key: string, model: string, value: Record<string, unknown>): GameSyncFact => ({ model, key, value });

/** A realm holding `wheat`, its farm idle, on a game with or without a building board. */
const realm = (board: boolean, wheat: bigint) => {
  const store = new NativeFactStore();
  store.setSnapshot({ gameId: 1, complete: true, actor: null, timestamp: 100 });
  store.applyFacts([
    upsert("0x8", "RealmKnowledge", { game_id: 1, structure_id: 7, learned: 0n }),
    upsert("0x1", "SliceRules", { ...preset.rules, game_id: 1, mode_rules: 0 }),
    upsert("0x2", "ResourceWeight", { game_id: 1, entity_id: 7, capacity: 1000n * PRECISION, weight: 0n }),
    upsert("0x3", "ResourceBalance", { game_id: 1, entity_id: 7, resource_type: 35, balance: wheat }),
    upsert("0x4", "ResourceProduction", {
      remainder: 0,

      game_id: 1,
      entity_id: 7,
      resource_type: 35,
      building_count: 0,
      production_rate: 0n,
      output_amount_left: 0n,
      last_settled_at: 0,
    }),
    upsert("0x7", "ResourceRule", { game_id: 1, resource_type: 35, unit_weight: 1n, realm_rate: 0n, village_rate: 0n }),
    upsert("0x5", "ProductionRecipe", {
      game_id: 1,
      resource_type: 26,
      simple_output: PRECISION,
      simple_inputs: [{ resource_type: 35, amount: 2n * PRECISION }],
      complex_output: 0n,
      complex_inputs: [],
    }),
    ...(board
      ? [
          upsert("0x6", "BoardRules", {
            game_id: 1,
            demolition_refund_bps: 0,
            workshop_rate: 0n,
            output_step_bps: 2500,
            storage_step_bps: 5000,
            population_step_bps: 2500,
            ration_step: PRECISION / 4n,
            troop_store_deploys: 2,
            settlement_resource_cap: 6000,
            city_resource_cap: 18000,
            kingdom_resource_cap: 40000,
            empire_resource_cap: 80000,
          }),
        ]
      : []),
  ]);
  return store;
};

describe("troop raise cost", () => {
  it("charges a board realm its troops' recipe wheat and refuses it when the realm is short", () => {
    const store = realm(true, 10n * PRECISION);
    const five = readTroopRaiseCost(store, 1, 7, 26, 5, 100);
    expect(five).toEqual([{ resource: 35, amount: 10n * PRECISION, held: 10n * PRECISION }]);
    expect(canPayTroopRaise(five)).toBe(true);
    expect(canPayTroopRaise(readTroopRaiseCost(store, 1, 7, 26, 6, 100))).toBe(false);
  });

  it("keeps the recipe cost unchanged by Conscription research", () => {
    const store = realm(true, 10n * PRECISION);
    for (const tier of [0n, 1n, 5n]) {
      store.applyFacts([upsert("0x8", "RealmKnowledge", { game_id: 1, structure_id: 7, learned: tier << 14n })]);
      expect(readTroopRaiseCost(store, 1, 7, 26, 4, 100)![0]!.amount).toBe(8n * PRECISION);
    }
  });

  it("rounds a fraction of a recipe up, as the contract never undercharges", () => {
    const store = realm(true, 0n);
    store.applyFacts([
      upsert("0x5", "ProductionRecipe", {
        game_id: 1,
        resource_type: 26,
        simple_output: 3n,
        simple_inputs: [{ resource_type: 35, amount: 2n }],
        complex_output: 0n,
        complex_inputs: [],
      }),
    ]);
    expect(readTroopRaiseCost(store, 1, 7, 26, 1, 100)![0]!.amount).toBe((2n * PRECISION + 2n) / 3n);
  });

  it("costs nothing beyond the troops on a game without a board, whatever its recipes say", () => {
    const store = realm(false, 0n);
    expect(readTroopRaiseCost(store, 1, 7, 26, 5, 100)).toEqual([]);
    expect(canPayTroopRaise([])).toBe(true);
  });

  it("is unknown while the realm's holding is", () => {
    expect(readTroopRaiseCost(realm(true, 10n), 1, 8, 26, 5, 100)).toBeUndefined();
    expect(canPayTroopRaise(undefined)).toBe(false);
  });
});

it("prices every Depot tier independently of Conscription and waits for knowledge", () => {
  const store = realm(true, 100n * PRECISION);
  for (let tier = 0n; tier <= 5n; tier++) {
    store.applyFacts([upsert("0x8", "RealmKnowledge", {game_id: 1, structure_id: 7, learned: (5n << 14n) | (tier << 24n)})]);
    expect(readTroopRaiseCost(store, 1, 7, 26, 4, 100)).toEqual([{resource: 35, amount: (8n - tier) * PRECISION, held: 100n * PRECISION}]);
  }
  store.applyFacts([{model: "RealmKnowledge", key: "0x8", value: null}]);
  expect(readTroopRaiseCost(store, 1, 7, 26, 4, 100)).toBeUndefined();
});
