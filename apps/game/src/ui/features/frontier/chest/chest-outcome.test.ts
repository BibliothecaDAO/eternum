import { describe, expect, it } from "vitest";
import { readChestOutcome } from "./chest-outcome";
import { LOOT_ITEMS, LOOT_NAME_PREFIXES, LOOT_NAME_SUFFIXES, LOOT_ORDER_SUFFIXES } from "./loot-words";
import { relicName } from "./relic-name";

const RULES = { lords_amounts: { common: 100n, uncommon: 400n, rare: 1_500n, epic: 6_000n } };

describe("what a chest gave", () => {
  it("pays a Token the game's own amount for its quality", () => {
    expect(
      [0, 1, 2, 3].map((quality) => readChestOutcome({ kind: "Token", quality, lordsExhausted: false }, RULES)),
    ).toEqual([
      { kind: "lords", intensity: 0, lords: 100 },
      { kind: "lords", intensity: 1, lords: 400 },
      { kind: "lords", intensity: 2, lords: 1_500 },
      { kind: "lords", intensity: 3, lords: 6_000 },
    ]);
  });

  it("gives a relic, saying when it stands in for LORDS the season could not pay today", () => {
    expect(readChestOutcome({ kind: "Relic", quality: 2, lordsExhausted: false }, RULES)).toEqual({
      kind: "relic",
      intensity: 2,
      lordsSpent: false,
    });
    expect(readChestOutcome({ kind: "Relic", quality: 3, lordsExhausted: true }, RULES)).toEqual({
      kind: "relic",
      intensity: 3,
      lordsSpent: true,
    });
  });

  it("refuses an unknown quality and a LORDS chest marked unpaid", () => {
    expect(() => readChestOutcome({ kind: "Relic", quality: 4, lordsExhausted: false }, RULES)).toThrow("quality 4");
    expect(() => readChestOutcome({ kind: "Token", quality: 1, lordsExhausted: true }, RULES)).toThrow("unpaid");
  });
});

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
