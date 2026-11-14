import { describe, expect, it } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import { armyRelicsEnabled } from "./army-relics";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/conformance.json";

const sliceRules = (day_unit_seconds: number) => ({
  model: "SliceRules" as const,
  key: "0x1",
  value: { ...preset.rules, game_id: 1, day_unit_seconds },
});
const chestRules = {
  model: "ChestRules" as const,
  key: "0x2",
  value: {
    game_id: 1,
    price_ceiling: 50n,
    shares: { common: 1, uncommon: 2, rare: 4, epic: 10, legendary: 20 },
    claim_window_seconds: 604_800,
    pool_bps: 7_000,
    top_n: 10,
  },
};

/** The game's calendar and spacing, which the snapshot's scope is read from in a day game. */
const calendar = [
  {
    model: "GameRegistry",
    key: "0x3",
    value: {
      game_id: 1,
      name: 0n,
      preset_id: 7,
      settled: false,
      ready: true,
      dev_mode_on: false,
      start_settling_at: 0n,
      start_main_at: 100n,
      scheduled_end_at: 1_000_000n,
end_at: 1_000_000n,
      end_grace_seconds: 0,
      seed: 1n,
    },
  },
  {
    model: "SettlementRules",
    key: "0x4",
    value: { game_id: 1, spacing: 10, registration_start: 0, registration_limit: 0, mode: "Single" },
  },
];

const storeWith = (facts: readonly object[], complete: boolean) => {
  const store = new NativeFactStore();
  store.setSnapshot({ gameId: 1, complete, actor: "0x111", timestamp: 350 });
  store.applyFacts([...calendar, ...facts] as never);
  return store;
};

describe("armyRelicsEnabled", () => {
  it("is true for a day game with no chest rules once the snapshot is complete", () => {
    expect(armyRelicsEnabled(storeWith([sliceRules(3600)], true), 1)).toBe(true);
  });

  it("is false for a day game whose preset carries chest rules, complete or not", () => {
    expect(armyRelicsEnabled(storeWith([sliceRules(3600), chestRules], true), 1)).toBe(false);
    expect(armyRelicsEnabled(storeWith([sliceRules(3600), chestRules], false), 1)).toBe(false);
  });

  it("is false for a game without days", () => {
    expect(armyRelicsEnabled(storeWith([sliceRules(0)], false), 1)).toBe(false);
  });

  it("cannot tell while the chest rules may still be on their way, or the game's rules are not held", () => {
    expect(armyRelicsEnabled(storeWith([sliceRules(3600)], false), 1)).toBeUndefined();
    expect(armyRelicsEnabled(storeWith([], true), 1)).toBeUndefined();
  });
});
