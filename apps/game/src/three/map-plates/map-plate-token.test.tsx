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
  stamina: { current: 30, max: 120, perExplore: 20 },
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
  name: "Rift",
  named: false,
  place: "Duskmere",
  reward: "1,200 Essence",
  holding: { amount: 1200, unit: "Essence" },
  guards: [{ type: "knight", tier: 2, count: 300 }],
  icon: "rift",
};

describe("a thing's token, its plate closed (the owner's 2026-10-19 pick: tokens)", () => {
  it("reads an army's tier, troops and stamina, a structure's strongest guard tier and whole guard", () => {
    expect(tokenReading(army)).toMatchObject({
      strength: { tier: 3, count: 1400 },
      stamina: { current: 30, max: 120, perExplore: 20 },
      undefended: false,
    });
    expect(tokenReading(realm)).toMatchObject({ strength: { tier: 3, count: 1154 }, stamina: null, undefended: false });
    // A site's token tells its guard, never what it holds (owner, 2026-10-20: "dont display the rift essence").
    expect(tokenReading(rift)).toEqual({
      icon: "rift",
      strength: { tier: 2, count: 300 },
      beast: null,
      undefended: false,
      stamina: null,
      mark: null,
    });
  });

  it("tells an undefended structure from a Frontier realm, which has no guard to tell", () => {
    expect(tokenReading({ ...realm, guards: [] })).toMatchObject({ strength: null, undefended: true });
    expect(tokenReading({ ...realm, guards: null })).toMatchObject({ strength: null, undefended: false });
  });

  it("writes a token's tier chip and count under its pin; a site's, its guard alone", () => {
    const words = (html: string) =>
      html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    expect(words(renderToStaticMarkup(<Token plate={army} />))).toBe("T3 1,400");
    expect(words(renderToStaticMarkup(<Token plate={rift} />))).toBe("T2 300");
    expect(
      words(renderToStaticMarkup(<Token plate={{ ...rift, icon: "camp", holding: { amount: 650, unit: "Labor" } }} />)),
    ).toBe("T2 300");
    // An undefended structure: a dashed ring, nothing under it.
    const open = renderToStaticMarkup(<Token plate={{ ...realm, guards: [] }} />);
    expect(open).toContain('data-undefended="true"');
    expect(words(open)).toBe("");
  });

  it("carries its player's initial on its disk to a watching viewer, in the ink its seat colour reads in", () => {
    const watched = { ...army, watched: { seat: 8, colour: "#5f6fa1", mark: { letter: "T", ink: "light" as const } } };
    expect(renderToStaticMarkup(<Token plate={watched} />)).toContain(
      '<span class="ui-seat mp-token__seat" data-ink="light" aria-hidden="true">T</span>',
    );
    const nobody = { ...rift, watched: { seat: null, colour: "#b9b1a1", mark: null } };
    expect(renderToStaticMarkup(<Token plate={nobody} />)).not.toContain("ui-seat");
    expect(renderToStaticMarkup(<Token plate={army} />)).not.toContain("ui-seat");
  });

  it("says its reading in words: strength, stamina; undefended", () => {
    expect(renderToStaticMarkup(<Token plate={army} />)).toContain('aria-label="T3 1,400, Stamina 25%"');
    expect(renderToStaticMarkup(<Token plate={rift} />)).toContain('aria-label="T2 300"');
    expect(renderToStaticMarkup(<Token plate={{ ...realm, guards: [] }} />)).toContain('aria-label="Undefended"');
  });

  it("sizes a token's box for the layout: the disk, the strip one row high over its edge, an army's stamina bar", () => {
    expect(tokenSize(army).height).toBe(30 - 2 + 18 + 4);
    expect(tokenSize(realm).height).toBe(30 - 2 + 18);
    expect(tokenSize({ ...realm, guards: [] })).toEqual({ width: 30, height: 30 });
  });
});
