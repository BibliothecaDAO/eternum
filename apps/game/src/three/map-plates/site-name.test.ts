import { describe, expect, it } from "vitest";

import { siteName } from "./site-name";

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
