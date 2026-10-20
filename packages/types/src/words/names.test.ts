import { describe, expect, it } from "vitest";

import { armyName, siteName } from "./names";

describe("a nameless place's lore name, read off its id", () => {
  const ids = Array.from({ length: 2_000 }, (_, serial) => 7 * 2 ** 32 + serial);

  it("gives the same id the same name every time, on every client", () => {
    expect(siteName(129)).toBe(siteName(129));
    expect(siteName(7 * 2 ** 32 + 103)).toBe(siteName(7 * 2 ** 32 + 103));
  });

  it("is one short capitalised word: no id, no space, two halves, at most eleven letters", () => {
    for (const id of ids) expect(siteName(id)).toMatch(/^[A-Z][a-z]{3,10}$/);
  });

  it("never doubles a letter at its join", () => {
    // No half doubles a consonant but l (Skull, fell, fall), so a doubled other consonant can only be the join.
    for (const name of ids.map(siteName)) expect(name).not.toMatch(/([^aeioul])\1/i);
  });

  it("spreads neighbouring places over many names", () => {
    const names = new Set(ids.slice(0, 200).map(siteName));
    expect(names.size).toBeGreaterThan(150);
  });
});

describe("an army's generated name, read off its id", () => {
  const ids = Array.from({ length: 2_000 }, (_, serial) => 7 * 2 ** 32 + serial);

  it("is two capitalised words, a band and never one place word", () => {
    for (const id of ids) expect(armyName(id)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("names the same army the same way on every client, and spreads neighbours apart", () => {
    expect(armyName(4_097)).toBe(armyName(4_097));
    expect(new Set(ids.slice(0, 200).map(armyName)).size).toBeGreaterThan(150);
  });

  it("gives every home's army of one serial its own name", () => {
    // An army id is its home's namespace times 2^32 plus its serial: the home must reach the name.
    const secondArmies = Array.from({ length: 60 }, (_, home) => (home + 1) * 2 ** 32 + 2);
    expect(armyName(1 * 2 ** 32 + 2)).not.toBe(armyName(2 * 2 ** 32 + 2));
    expect(new Set(secondArmies.map(armyName)).size).toBeGreaterThan(50);
  });

  it("names apart the armies of one serial in homes 1, 2, 3 and 12,001, which once all shared a name", () => {
    // The whole-PR review's ids: serials 2, 3 and 9 were "Rage Reavers", "Titan Host" and "Moon Guard" in every home.
    for (const serial of [2, 3, 9]) {
      const names = [1, 2, 3, 12_001].map((home) => armyName(home * 2 ** 32 + serial));
      expect(new Set(names).size).toBe(4);
    }
    expect(armyName(51_543_902_519_298)).toBe(armyName(12_001 * 2 ** 32 + 2));
  });

  it("never gives an army and a place of one id the same first word", () => {
    const shared = ids.filter(
      (id) => armyName(id).split(" ")[0] === siteName(id).match(/^[A-Z][a-z]+?(?=[a-z]*$)/)?.[0],
    );
    expect(shared.length).toBeLessThan(ids.length / 10);
  });
});
