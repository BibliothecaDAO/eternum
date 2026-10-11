import { describe, expect, it } from "vitest";

import { shortfall } from "./type-upgrade";

const price = { essence: 48_000, labor: 9_000 };
const waits = { essenceWait: 3_600, laborWait: 1_800 };

describe("a type's Upgrade shortfall", () => {
  it("holds Essence first, then labor, with the exact wait, and nothing when the realm can pay", () => {
    expect(shortfall(price, 18_250, { amount: 20_000, limit: 30_000 }, waits)).toEqual({
      kind: "short",
      icon: "Es",
      held: 18_250,
      need: 48_000,
      wait: 3_600,
    });
    expect(shortfall(price, 50_000, { amount: 4_000, limit: 30_000 }, waits)).toMatchObject({
      icon: "La",
      wait: 1_800,
    });
    expect(shortfall(price, 50_000, { amount: 20_000, limit: 30_000 }, waits)).toBeUndefined();
  });

  it("shows the labor store's limit when the price is above it, since waiting never fills it", () => {
    expect(shortfall({ essence: 0, labor: 24_000 }, 50_000, { amount: 18_000, limit: 18_000 }, waits)).toEqual({
      kind: "short",
      icon: "Sg",
      held: 18_000,
      need: 24_000,
    });
  });

  it("never reads an unknown balance as enough", () => {
    expect(shortfall(price, undefined, undefined, waits)).toMatchObject({ icon: "Es", held: undefined });
    expect(shortfall(price, 50_000, undefined, waits)).toMatchObject({ icon: "La", held: undefined });
  });
});
