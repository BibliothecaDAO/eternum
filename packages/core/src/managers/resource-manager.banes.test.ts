import { expect, it } from "vitest";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/conformance.json";
import { nativeBaneConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import { NativeFactStore } from "../client/native-fact-store";
import { dayOf } from "../utils/days";
import { ResourceManager } from "./resource-manager";

function baneProduction() {
  const store = new NativeFactStore();
  const start = dayOf({ seed: 5n, startMainAt: 100, endAt: 10_000, dayUnitSeconds: 100 }, 100)!.end;
  const now = start + 11;
  store.applyFacts([
    { model: "SliceRules", key: "0xd000", value: { ...preset.rules, game_id: 1, day_unit_seconds: 100, mode_rules: 0 } },
    {
      model: "GameRegistry",
      key: "0xd001",
      value: {
        game_id: 1,
        preset_id: 7,
        name: 1,
        start_settling_at: 1,
        start_main_at: 100,
        end_at: 10_000,
        settled: false,
        ready: true,
        dev_mode_on: false,
        end_grace_seconds: 0,
        seed: 5,
      },
    },
    {
      model: "Structure",
      key: "0xd002",
      value: {
        game_id: 1,
        entity_id: 7,
        owner: "0x111",
        resources_packed: 0,
        base: {
          category: 1,
          level: 0,
          created_at: 100,
          troop_max_guard_count: 0,
          troop_max_explorer_count: 0,
          starting_troops_granted: true,
        },
        metadata: { realm_id: 1, village_realm: 0, mine_kind: 0, deepest_depth: 0, has_wonder: false, order: 0 },
      },
    },
    { model: "HomeAspect", key: "0xd003", value: { game_id: 1, home: 7, aspect: 1 } },
    {
      model: "BaneRules",
      key: "0xd004",
      value: {
        game_id: 1,
        chance_step: 20,
        quorum_percent: 40,
        beast_percent: 150,
        stamina_percent: 50,
        production_percent: 50,
        quest_counts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10_000, 15_000],
      },
    },
    { model: "WorldBane", key: "0xd005", value: { game_id: 1, day: 0, kind: 0 } },
    { model: "WorldBane", key: "0xd006", value: { game_id: 1, day: 1, kind: nativeBaneConstants.ASH_FALL } },
    { model: "AspectActivity", key: "0xd007", value: { game_id: 1, aspect: 1, day: 0, active: 5 } },
    {
      model: "ResourceWeight",
      key: "0xd008",
      value: { game_id: 1, entity_id: 7, capacity: (1n << 128n) - 1n, weight: 0 },
    },
    { model: "ResourceBalance", key: "0xd009", value: { game_id: 1, entity_id: 7, resource_type: 3, balance: 0 } },
    {
      model: "ResourceProduction",
      key: "0xd00a",
      value: {
        game_id: 1,
        entity_id: 7,
        resource_type: 3,
        building_count: 1,
        production_rate: 7,
        output_amount_left: (1n << 128n) - 1n,
        last_settled_at: start - 10,
        remainder: 0,
      },
    },
  ]);
  store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: now });
  const manager = new ResourceManager(store, 7, 1);
  const endBane = () =>
    store.applyFacts([
      {
        model: "BaneProgress",
        key: "0xd00b",
        value: { game_id: 1, aspect: 1, day: 1, completed: 2, ended_at: start + 5 },
      },
    ]);
  return { store, manager, start, now, endBane };
}

it("settles the old and reduced rate separately and refreshes both balance and rate when quorum ends Ash Fall", () => {
  const { manager, now, endBane } = baneProduction();
  expect(manager.balanceWithProduction(now, 3)).toMatchObject({ balance: 108, amountProduced: 108n });
  expect(manager.productionData(3, now)).toMatchObject({ productionPerSecond: 3.5 / 1e9, isProducing: true });
  const observed: { balance: number | undefined; rate: number | undefined }[] = [];
  const stop = manager.subscribe(() =>
    observed.push({
      balance: manager.balanceWithProduction(now, 3)?.balance,
      rate: manager.productionData(3, now)?.productionPerSecond,
    }),
  );
  endBane();
  stop();
  expect(observed).toEqual([{ balance: 129, rate: 7 / 1e9 }]);
  expect(manager.balance(3)).toBe(0n);
});

it("does not forecast an ordinary rate or balance through an unknown recorded day", () => {
  const { store, manager, now } = baneProduction();
  store.applyFacts([{ model: "WorldBane", key: "0xd006", value: null }]);
  expect(manager.balanceWithProduction(now, 3)).toBeUndefined();
  expect(manager.productionData(3, now)).toBeUndefined();
  expect(manager.balance(3)).toBe(0n);
});

it("exhausts finite production at the slowed rate, carrying the fraction into the remaining-time estimate", () => {
  const { store, manager, start } = baneProduction();
  const production = store.require("ResourceProduction", { game_id: 1, entity_id: 7, resource_type: 3 });
  store.applyFacts([
    {
      model: "ResourceProduction",
      key: "0xd00a",
      value: {
        ...production,
        last_settled_at: start,
        output_amount_left: 8n,
      },
    },
  ]);
  expect(manager.balanceWithProduction(start + 1, 3)).toMatchObject({ balance: 3 });
  expect(manager.productionData(3, start + 1)).toMatchObject({
    isProducing: true,
    outputRemaining: 5 / 1e9,
    timeRemainingSeconds: 2,
  });
  expect(manager.balanceWithProduction(start + 3, 3)).toMatchObject({ balance: 8 });
  expect(manager.productionData(3, start + 3)).toMatchObject({
    isProducing: false,
    outputRemaining: 0,
    timeRemainingSeconds: 0,
  });
});
