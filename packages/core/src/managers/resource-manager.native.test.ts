import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { describe, expect, it, vi } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import { waitForWorldState } from "../client/wait-for-world-state";
import { ResourceManager } from "./resource-manager";
import type { GameSyncFact } from "../sync/game-sync-types";
import { ResourcesIds } from "@bibliothecadao/types";

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

  it("resolves a fresh realm's absent Essence only after its scoped snapshot is complete", async () => {
    const store = new NativeFactStore();
    store.setSnapshot({ gameId: 1, complete: false, actor: "0xaaa", timestamp: 350 });
    store.applyFacts([
      ...upsert("0x100", { SliceRules: { ...preset.rules, game_id: 1, epoch_seconds: 100, mode_rules: 0 } }),
      ...upsert("0x101", { GameRegistry: { ...game, ready: true } }),
      ...upsert("0x102", {
        SettlementRules: {
          game_id: 1,
          registration_start: 1,
          registration_limit: 0,
          spacing: 100,
          mode: "Single",
        },
      }),
      ...upsert("0x103", { PlayerEntry: { game_id: 1, owner: 0x111n, player: 0xaaan } }),
      ...upsert("0x104", {
        Structure: {
          game_id: 1,
          entity_id: 7,
          owner: 0x111n,
          base: {
            category: 1,
            level: 0,
            created_at: 0n,
            troop_max_guard_count: 0,
            troop_max_explorer_count: 0,
            starting_troops_granted: false,
          },
          resources_packed: 0n,
          metadata: { realm_id: 1, village_realm: 0, mine_kind: 0, deepest_depth: 0, has_wonder: false, order: 0 },
        },
      }),
      ...upsert("0x105", { ResourceWeight: weight() }),
      ...[23, 26, 35].flatMap((resource_type, index) =>
        upsert(`0x${106 + index}`, { ResourceBalance: { ...balance(), resource_type, balance: 10n } }),
      ),
    ]);

    const manager = new ResourceManager(store, 7, 1);
    expect(manager.current(ResourcesIds.Essence)).toBeUndefined();
    expect(manager.balance(ResourcesIds.Essence)).toBeUndefined();

    const completeBalance = waitForWorldState(
      store,
      () => manager.current(ResourcesIds.Essence)?.balance,
      1_000,
      () => "Complete fresh-realm Essence snapshot",
    );

    store.setSnapshot({ gameId: 1, complete: true, actor: "0xaaa", timestamp: 350 });

    const scope = store.subscriptionScope();
    expect(scope.known?.expedition?.realms.has(String(7))).toBe(true);
    expect(manager.current(ResourcesIds.Essence)?.balance).toBe(0n);
    expect(manager.balance(ResourcesIds.Essence)).toBe(0n);
    expect(
      Boolean(scope.known?.expedition?.realms.has(String(7))) && manager.current(ResourcesIds.Essence) !== undefined,
    ).toBe(true);

    await expect(completeBalance).resolves.toBe(0n);
    await expect(
      waitForWorldState(
        store,
        () => manager.current(ResourcesIds.Essence)?.balance,
        1_000,
        () => "Already complete fresh-realm Essence snapshot",
      ),
    ).resolves.toBe(0n);
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
  it("settles troops and wheat alone against shared storage, and nothing consumes wheat", () => {
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
    // Farms grow 100 a second (rates in game precision); the barracks's recipe wheat is paid only when troops deploy.
    expect(manager.wheatPerHour(101)).toBe((100 / 1e9) * 3600);
    expect(new ResourceManager(store, 8, 1).wheatPerHour(101)).toBeUndefined();
    // Each settles alone into the 10 the store has left, as the contract settles one touched resource at a time.
    expect(manager.balanceWithProduction(101, 26).balance).toBe(40);
    expect(manager.balanceWithProduction(101, 35).balance).toBe(70);
    expect(manager.balance(35)).toBe(60n);
    store.applyFacts([
      ...upsert("0x1", { ResourceWeight: { ...weight(), capacity: 100n, weight: 34n } }),
      ...upsert("0x2", {
        ResourceBalance: { ...balance(), resource_type: 35, balance: 4n },
        ResourceProduction: { ...production, resource_type: 35, production_rate: 0n },
      }),
    ]);
    // With no farm and almost no wheat the barracks still trains, up to the store's room.
    expect(manager.balanceWithProduction(101, 26).balance).toBe(40);
    expect(manager.balanceWithProduction(110, 26).balance).toBe(96);
    expect(manager.balanceWithProduction(110, 35).balance).toBe(4);
  });
});
