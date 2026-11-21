import { describe, expect, it } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import { armyRelicsEnabled } from "./army-relics";
import release from "../../../../contracts/l3/world-native/schema/release-definition.json";

const sliceRules = (day_unit_seconds: number) => ({
  model: "SliceRules" as const,
  key: "0x1",
  value: { ...release.definition.rules, game_id: 1, day_unit_seconds },
});

const storeWith = (facts: readonly object[]) => {
  const store = new NativeFactStore();
  store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
  store.applyFacts(facts as never);
  return store;
};

describe("armyRelicsEnabled", () => {
  it("is true for a day game", () => {
    expect(armyRelicsEnabled(storeWith([sliceRules(3600)]), 1)).toBe(true);
  });

  it("is false for a game without days", () => {
    expect(armyRelicsEnabled(storeWith([sliceRules(0)]), 1)).toBe(false);
  });

  it("cannot tell while the game's rules are not held", () => {
    expect(armyRelicsEnabled(storeWith([]), 1)).toBeUndefined();
  });
});
