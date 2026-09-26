import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { describe, expect, it, vi } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import { ResourceManager } from "./resource-manager";
import { realmSupportPercent } from "../utils/realm-support";
import type { GameSyncFact } from "../sync/game-sync-types";

const upsert = (key: string, models: Record<string, Record<string, unknown>>): GameSyncFact[] =>
  Object.entries(models).map(([model, value]) => ({ model, key, value }));
const weight = (game = 1) => ({ game_id: game, entity_id: 7, capacity: 1000n, weight: 0n });
const balance = (game = 1) => ({ game_id: game, entity_id: 7, resource_type: 23, balance: 9007199254740993n });
const game = {
  game_id: 1,
  name: 1n,
  preset_id: 1,
  creator: 1n,
  settled: false,
  ready: false,
  dev_mode_on: false,
  start_settling_at: 0n,
  start_main_at: 200n,
  end_at: 1100n,
  end_grace_seconds: 0,
  seed: 1n,
};
const production = {
  game_id: 1,
  entity_id: 7,
  resource_type: 23,
  building_count: 1,
  production_rate: 2n,
  output_amount_left: 10n,
  last_updated_at: 100,
};

describe("native resource facts", () => {
  it("reads sparse resources and observes a transaction once, including deletion", () => {
    const store = new NativeFactStore();
    store.setSnapshot({ gameId: 1, complete: true, actor: null, timestamp: 350 });
    store.applyFacts([...upsert("0x100", { SliceRules: { ...preset.rules, game_id: 1, mode_rules: 0 } })]);
    const manager = new ResourceManager(store, 7, 1);
    store.applyFacts([...upsert("0x1", { ResourceWeight: weight() })]);
    const changed = vi.fn();
    const unsubscribe = manager.subscribe(changed);
    expect(manager.hasResources()).toBe(true);
    expect(manager.balance(23)).toBe(0n);
    expect(manager.isActive(23)).toBe(false);
    store.applyFacts([...upsert("0x2", { ResourceBalance: balance(), ResourceProduction: production })]);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(manager.balance(23)).toBe(9007199254740993n);
    expect(manager.getActiveProductions()).toEqual([
      { resourceId: 23, productionRate: 2n, buildingCount: 1, outputAmountLeft: 10n, lastUpdatedAt: 100 },
    ]);
    store.applyFacts([{ model: "ResourceBalance", key: "0x2", value: null }]);
    expect(manager.balance(23)).toBe(0n);
    store.applyFacts([{ model: "ResourceProduction", key: "0x2", value: null }]);
    expect(manager.getActiveProductions()).toEqual([]);
    store.applyFacts([{ model: "ResourceWeight", key: "0x1", value: null }]);
    expect(manager.current(23)).toBeUndefined();
    expect(manager.hasResources()).toBe(false);
    expect(changed).toHaveBeenCalledTimes(4);
    unsubscribe();
    store.applyFacts([...upsert("0x1", { ResourceWeight: weight() })]);
    expect(changed).toHaveBeenCalledTimes(4);
  });

  it("scopes reads and notifications to their game, and knows no balance without a resource owner", () => {
    const store = new NativeFactStore();
    store.setSnapshot({ gameId: 1, complete: true, actor: null, timestamp: 350 });
    store.applyFacts([...upsert("0x100", { SliceRules: { ...preset.rules, game_id: 1, mode_rules: 0 } })]);
    const first = new ResourceManager(store, 7, 1);
    const second = new ResourceManager(store, 7, 2);
    const changed = vi.fn();
    first.subscribe(changed);
    store.applyFacts([...upsert("0x1", { ResourceBalance: balance() })]);
    expect(first.current(23)).toBeUndefined();
    expect(first.balance(23)).toBeUndefined();
    expect(first.balances()).toBeUndefined();
    expect(first.getStoreCapacityKg()).toBeUndefined();
    store.applyFacts([...upsert("0x2", { ResourceWeight: weight(2), ResourceBalance: balance(2) })]);
    store.applyFacts([...upsert("0x101", { SliceRules: { ...preset.rules, game_id: 2, mode_rules: 0 } })]);
    store.setSnapshot({ gameId: 2, complete: true, actor: null, timestamp: 350 });
    expect(second.balance(23)).toBe(9007199254740993n);
    expect(first.hasResources()).toBe(false);
    expect(changed).toHaveBeenCalledTimes(2);
    expect(() => second.current(0)).toThrow("Invalid resource");
  });
  it("starts every Blitz producer at the final main clock after delayed roster preparation", () => {
    const store = new NativeFactStore();
    store.setSnapshot({ gameId: 1, complete: true, actor: null, timestamp: 350 });
    store.applyFacts([
      ...upsert("0x1", { ResourceWeight: weight(), ResourceProduction: { ...production, last_updated_at: 100 } }),
      ...upsert("0x2", {
        SliceRules: { ...preset.rules, game_id: 1, mode_rules: nativeRuleConstants.PRODUCTION_START },
        GameRegistry: game,
      }),
    ]);
    const manager = new ResourceManager(store, 7, 1);
    const changed = vi.fn();
    manager.subscribe(changed);
    expect(manager.current(23)!.production.production_rate).toBe(0n);
    expect(manager.getActiveProductions()).toEqual([]);
    store.applyFacts([...upsert("0x2", { GameRegistry: { ...game, ready: true, start_main_at: 1000n } })]);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(manager.current(23)!.production).toMatchObject({ last_updated_at: 1000, production_rate: 2n });
    expect(manager.getActiveProductions()[0]).toMatchObject({ lastUpdatedAt: 1000, productionRate: 2n });
  });
  it("projects wheat-funded training and shared storage before allowing muster", () => {
    const store = new NativeFactStore();
    store.setSnapshot({ gameId: 1, complete: true, actor: null, timestamp: 350 });
    store.applyFacts([
      ...upsert("0x100", { SliceRules: { ...preset.rules, game_id: 1, mode_rules: 0 } }),
      ...upsert("0x1", { ResourceWeight: { ...weight(), capacity: 100n, weight: 90n } }),
      ...upsert("0x2", {
        ResourceBalance: { ...balance(), resource_type: 35, balance: 60n },
        ResourceProduction: {
          ...production,
          resource_type: 35,
          production_rate: 100n,
          output_amount_left: (1n << 128n) - 1n,
        },
        ResourceRule: { game_id: 1, resource_type: 35, unit_weight: 1n, realm_rate: 100n, village_rate: 0n },
      }),
      ...upsert("0x3", {
        ResourceBalance: { ...balance(), resource_type: 26, balance: 30n },
        ResourceProduction: {
          ...production,
          resource_type: 26,
          production_rate: 10n,
          output_amount_left: (1n << 128n) - 1n,
        },
        ResourceRule: { game_id: 1, resource_type: 26, unit_weight: 1n, realm_rate: 10n, village_rate: 0n },
        ProductionRecipe: {
          game_id: 1,
          resource_type: 26,
          simple_output: 1n,
          simple_inputs: [{ resource_type: 35, amount: 2n }],
          complex_output: 0n,
          complex_inputs: [],
        },
      }),
    ]);
    const manager = new ResourceManager(store, 7, 1);
    expect(manager.trainsFromWheat()).toBe(true);
    expect(new ResourceManager(store, 8, 1).trainsFromWheat()).toBe(false);
    // Farms grow 100 a second; the barracks trains 10 a second at 2 wheat each (rates in game precision).
    expect(manager.wheatPerHour()).toEqual({ produced: (100 / 1e9) * 3600, consumed: (20 / 1e9) * 3600 });
    expect(new ResourceManager(store, 8, 1).wheatPerHour()).toBeUndefined();
    expect(manager.balanceWithProduction(101, 26).balance).toBe(30);
    expect(manager.balanceWithProduction(101, 35).balance).toBe(70);
    expect(manager.balance(35)).toBe(60n);
    store.applyFacts([
      ...upsert("0x1", { ResourceWeight: { ...weight(), capacity: 100n, weight: 34n } }),
      ...upsert("0x2", {
        ResourceBalance: { ...balance(), resource_type: 35, balance: 4n },
        ResourceProduction: { ...production, resource_type: 35, production_rate: 0n },
      }),
    ]);
    expect(manager.balanceWithProduction(101, 26).balance).toBe(32);
    expect(manager.balanceWithProduction(110, 26).balance).toBe(32);
    store.applyFacts([
      ...upsert("0x2", {
        ResourceProduction: { ...production, resource_type: 35, production_rate: 4n, last_updated_at: 110 },
      }),
    ]);
    expect(manager.balanceWithProduction(111, 26).balance).toBe(34);
    expect(manager.balanceWithProduction(111, 35).balance).toBe(0);
  });
  it("leaves the wheat rate unknown while the barracks snapshot is incomplete", () => {
    const store = new NativeFactStore();
    store.setSnapshot({ gameId: 1, complete: false, actor: null, timestamp: 350 });
    store.applyFacts([
      ...upsert("0x100", { SliceRules: { ...preset.rules, game_id: 1, mode_rules: 0 } }),
      ...upsert("0x1", { ResourceWeight: weight() }),
      ...upsert("0x2", {
        ResourceBalance: { ...balance(), resource_type: 35 },
        ResourceProduction: { ...production, resource_type: 35 },
      }),
    ]);

    expect(new ResourceManager(store, 7, 1).wheatPerHour()).toBeUndefined();
  });
});

it("integrates yesterday's Support for wheat and training after refresh, and uses declared absence for an unboosted realm", () => {
  const facts: GameSyncFact[] = [
    ...upsert("rules", { SliceRules: { ...preset.rules, game_id: 1, epoch_seconds: 100, mode_rules: 0 } }),
    ...upsert("game", { GameRegistry: { ...game, ready: true, start_main_at: 0n } }),
    ...upsert("settlement", {
      SettlementRules: { game_id: 1, registration_start: 0, registration_limit: 0, mode: "Single", spacing: 100 },
    }),
    ...upsert("realm", {
      Structure: {
        game_id: 1,
        entity_id: 7,
        owner: "0xa",
        resources_packed: 0n,
        base: {
          category: 1,
          level: 0,
          created_at: 0n,
          troop_max_guard_count: 0,
          troop_max_explorer_count: 0,
          starting_troops_granted: false,
        },
        metadata: { realm_id: 1, village_realm: 0, mine_kind: 0, deepest_depth: 0, has_wonder: false, order: 0 },
      },
    }),
    ...upsert("weight", { ResourceWeight: { ...weight(), capacity: 100000n } }),
    ...upsert("support", { RealmSupport: { game_id: 1, structure_id: 7, epoch: 0n, level: 3 } }),
    ...[35, 26].flatMap((resourceId) =>
      upsert(`resource-${resourceId}`, {
        ResourceProduction: {
          ...production,
          resource_type: resourceId,
          production_rate: resourceId === 35 ? 100n : 10n,
          output_amount_left: (1n << 128n) - 1n,
          last_updated_at: 90,
        },
        ResourceRule: { game_id: 1, resource_type: resourceId, unit_weight: 1n, realm_rate: 0n, village_rate: 0n },
      }),
    ),
    ...upsert("recipe", {
      ProductionRecipe: {
        game_id: 1,
        resource_type: 26,
        simple_output: 1n,
        simple_inputs: [{ resource_type: 35, amount: 2n }],
        complex_output: 0n,
        complex_inputs: [],
      },
    }),
  ];
  const refresh = (rows: GameSyncFact[]) => {
    const store = new NativeFactStore();
    store.applyFacts(rows.map((row, index) => ({ ...row, key: `0x${index + 1}` })));
    store.setSnapshot({ gameId: 1, complete: true, actor: "0xa", timestamp: 110 });
    return { store, manager: new ResourceManager(store, 7, 1) };
  };
  for (let refreshCount = 0; refreshCount < 2; refreshCount++) {
    const { store, manager } = refresh(facts);
    expect(manager.balanceWithProduction(110, 26)?.balance).toBe(220);
    expect(manager.balanceWithProduction(110, 35)?.balance).toBe(1760);
    expect(ResourceManager.calculateResourceProductionData(35, manager.current(35)!, 110).productionPerSecond).toBe(
      100 / 1e9,
    );
    expect(store.requireOrAbsent("RealmSupport", { game_id: 1, structure_id: 7, epoch: 1n }).known?.level).toBe(0);
    // Today's boost: the day's earned level past the first, none on a day that earned nothing.
    expect(realmSupportPercent(store, 1, 7, 90)).toEqual({ known: 20 });
    expect(realmSupportPercent(store, 1, 7, 150)).toEqual({ known: 0 });
    const readCurrent = manager.current.bind(manager);
    const unknownTrainer = vi
      .spyOn(manager, "current")
      .mockImplementation((id) => (id === 26 ? undefined : readCurrent(id)));
    expect(manager.current(35)).toBeDefined();
    expect(manager.balanceWithProduction(110, 35)).toBeUndefined();
    unknownTrainer.mockRestore();
    store.setSnapshot({ gameId: 1, complete: false, actor: "0xa", timestamp: 110 });
    expect(manager.balanceWithProduction(110, 35)).toBeUndefined();
    // An incomplete scope cannot vouch for a day without a row.
    expect(realmSupportPercent(store, 1, 7, 150).unknown).toBeDefined();
  }
  const unboosted = refresh(facts.filter((row) => row.model !== "RealmSupport"));
  expect(unboosted.manager.balanceWithProduction(110, 26)?.balance).toBe(200);
  expect(unboosted.manager.balanceWithProduction(110, 35)?.balance).toBe(1600);
});
