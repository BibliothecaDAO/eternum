// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Token, tokenReading, tokenSize } from "./map-plate-token";
import type { ArmyPlate, StructurePlate } from "./map-plate-model";

const army: ArmyPlate = {
  kind: "army",
  relation: "enemy",
  owner: "Tamsin",
  homeName: "Niziz",
  troops: { type: "paladin", tier: 3, count: 1400 },
  stamina: { current: 30, max: 120 },
};

const realm: StructurePlate = {
  kind: "structure",
  relation: "enemy",
  owner: "Moonhand",
  name: "Xeswet",
  named: true,
  guards: [
    { type: "crossbowman", tier: 1, count: 516 },
    { type: "paladin", tier: 3, count: 638 },
  ],
  arrivals: [],
  icon: "realm",
};

const rift: StructurePlate = {
  ...realm,
  relation: "neutral",
  owner: "The Vanguard",
  name: "Essence Rift",
  named: false,
  place: "Duskmere",
  reward: "1,200 Essence",
  holding: { amount: 1200, unit: "Essence" },
  guards: [{ type: "knight", tier: 2, count: 300 }],
  icon: "rift",
};

describe("a thing's token, its plate closed (the owner's 2026-10-19 pick: tokens)", () => {
  it("reads an army's tier, troops and stamina, a structure's strongest guard tier and whole guard", () => {
    expect(tokenReading(army)).toMatchObject({ strength: { tier: 3, count: 1400 }, stamina: 0.25, undefended: false });
    expect(tokenReading(realm)).toMatchObject({ strength: { tier: 3, count: 1154 }, stamina: null, undefended: false });
    expect(tokenReading(rift).holding).toEqual({ amount: 1200, unit: "Essence" });
  });

  it("tells an undefended structure from a Frontier realm, which has no guard to tell", () => {
    expect(tokenReading({ ...realm, guards: [] })).toMatchObject({ strength: null, undefended: true });
    expect(tokenReading({ ...realm, guards: null })).toMatchObject({ strength: null, undefended: false });
  });

  it("writes a token's tier chip and count under its pin, and a site's holding beside them", () => {
    const words = (html: string) =>
      html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    expect(words(renderToStaticMarkup(<Token plate={army} />))).toBe("T3 1,400");
    expect(words(renderToStaticMarkup(<Token plate={rift} />))).toBe("T2 300 1,200");
    // An undefended structure: a dashed ring, nothing under it.
    const open = renderToStaticMarkup(<Token plate={{ ...realm, guards: [] }} />);
    expect(open).toContain('data-undefended="true"');
    expect(words(open)).toBe("");
  });

  it("says its reading in words: strength, stamina, what it holds; undefended", () => {
    expect(renderToStaticMarkup(<Token plate={army} />)).toContain('aria-label="T3 1,400, Stamina 25%"');
    expect(renderToStaticMarkup(<Token plate={rift} />)).toContain('aria-label="T2 300, 1,200 Essence"');
    expect(renderToStaticMarkup(<Token plate={{ ...realm, guards: [] }} />)).toContain('aria-label="Undefended"');
  });

  it("sizes a token's box for the layout: the disk, the strip one row high over its edge, an army's stamina bar", () => {
    expect(tokenSize(army).height).toBe(30 - 2 + 18 + 4);
    expect(tokenSize(realm).height).toBe(30 - 2 + 18);
    expect(tokenSize({ ...realm, guards: [] })).toEqual({ width: 30, height: 30 });
  });
});
