import { expect, it } from "vitest";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/conformance.json";
import { NativeFactStore } from "../client/native-fact-store";
import type { GameSyncFact } from "../sync/game-sync-types";
import { openingChargePercent } from "./army-charge";

const army = { game_id: 1, explorer_id: 7n };
const fact = (model: string, key: string, value: Record<string, unknown>): GameSyncFact => ({ model, key, value });
const rules = (day: number) => fact("SliceRules", "0x1", { ...preset.rules, game_id: 1, day_unit_seconds: day });
const combat = (target: bigint) =>
  fact("ArmyCombat", "0x2", { game_id: 1, explorer_id: 7n, charge: 3, last_target: target });
const snapshot = (facts: GameSyncFact[]) => {
  const store = new NativeFactStore();
  store.setSnapshot({ gameId: 1, complete: true, actor: null, timestamp: 100 });
  store.applyFacts(facts);
  return store;
};

it("keeps a missing Frontier combat fact unknown, but Blitz does not need one", () => {
  expect(openingChargePercent(snapshot([rules(100)]), army, 8n)).toBeUndefined();
  expect(openingChargePercent(snapshot([rules(0)]), army, 8n)).toBe(0);
});

it("reads the opening share from confirmed targets and retains it across a new snapshot", () => {
  const store = snapshot([rules(100), combat(0n)]);
  expect(openingChargePercent(store, army, 8n)).toBe(30);
  store.applyFacts([combat(8n)]);
  expect(openingChargePercent(store, army, 8n)).toBe(0);
  expect(openingChargePercent(store, army, 9n)).toBe(30);
  const reconnected = snapshot([rules(100), combat(8n)]);
  expect(openingChargePercent(reconnected, army, 8n)).toBe(0);
  expect(openingChargePercent(reconnected, army, 9n)).toBe(30);
});
