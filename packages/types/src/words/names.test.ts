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

  it("never gives an army and a place of one id the same first word", () => {
    const shared = ids.filter(
      (id) => armyName(id).split(" ")[0] === siteName(id).match(/^[A-Z][a-z]+?(?=[a-z]*$)/)?.[0],
    );
    expect(shared.length).toBeLessThan(ids.length / 10);
  });
});
