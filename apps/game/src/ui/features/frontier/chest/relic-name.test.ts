import { describe, expect, it } from "vitest";
import { LOOT_ITEMS, LOOT_NAME_PREFIXES, LOOT_NAME_SUFFIXES, LOOT_ORDER_SUFFIXES } from "./loot-words";
import { relicName } from "./relic-name";

describe("a relic's Loot name", () => {
  it("is the same for the same story and built from Loot's own words", () => {
    const story = ["7", "1024", "3"] as const;
    const name = relicName(story);
    expect(relicName(story)).toBe(name);
    const [prefix, nameSuffix, ...rest] = name.split(" ");
    expect(LOOT_NAME_PREFIXES).toContain(prefix);
    expect(LOOT_NAME_SUFFIXES).toContain(nameSuffix);
    const order = LOOT_ORDER_SUFFIXES.find((suffix) => rest.join(" ").endsWith(suffix))!;
    expect(order).toBeDefined();
    expect(LOOT_ITEMS).toContain(rest.join(" ").slice(0, -order.length - 1));
  });

  it("differs between stories", () => {
    const names = new Set(Array.from({ length: 20 }, (_, index) => relicName(["7", "1024", String(index)])));
    expect(names.size).toBeGreaterThan(15);
  });
});
