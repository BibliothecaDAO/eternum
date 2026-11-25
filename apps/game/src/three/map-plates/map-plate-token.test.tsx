// @vitest-environment jsdom

// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { skillPointGain } from "@bibliothecadao/types";
import { Plate } from "./map-plates";

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
      combat: { label: "Blade", icon: "attack" },
      stamina: null,
      mark: null,
      crest: null,
    });
  });

  it("marks on its disk how it fights: an army's troops, a structure's guard that an attacker meets first", () => {
    const mark = (plate: ArmyPlate | StructurePlate) => tokenReading(plate).combat?.label;
    expect(mark(army)).toBe("Blade");
    expect(mark({ ...army, troops: { ...army.troops, type: "crossbowman" } })).toBe("Bow");
    expect(mark({ ...army, troops: { ...army.troops, type: "knight" } })).toBe("Blade");
    expect(mark(realm)).toBe("Blade");
    expect(mark({ ...realm, guards: [...realm.guards!].reverse() })).toBe("Bow");
    expect(mark({ ...realm, guards: [] })).toBeUndefined();
    expect(mark({ ...realm, guards: null })).toBeUndefined();
    expect(
      renderToStaticMarkup(<Token plate={{ ...rift, guards: [{ type: "crossbowman", tier: 1, count: 9 }] }} />),
    ).toContain('data-combat-mark="Bow"');
  });

  it("wears the crest its plate names on the disk's corner", () => {
    expect(tokenReading({ ...rift, crest: 7 }).crest).toBe(7);
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

  it("writes a Frontier army's and guard's count alone, with no tier chip", () => {
    const scouts: ArmyPlate = { ...army, troops: { type: "paladin", tier: null, count: 505 } };
    const camp: StructurePlate = { ...rift, guards: [{ type: "knight", tier: null, count: 300 }] };
    const words = (html: string) =>
      html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    expect(words(renderToStaticMarkup(<Token plate={scouts} />))).toBe("505");
    expect(words(renderToStaticMarkup(<Token plate={camp} />))).toBe("300");
    expect(renderToStaticMarkup(<Token plate={scouts} />)).toContain('aria-label="Blade, 505, Stamina 25%"');
    expect(renderToStaticMarkup(<Token plate={scouts} />)).not.toContain("ui-chip");
  });

  it("says its reading in words: how it fights, strength, stamina; undefended", () => {
    expect(renderToStaticMarkup(<Token plate={army} />)).toContain('aria-label="Blade, T3 1,400, Stamina 25%"');
    expect(renderToStaticMarkup(<Token plate={rift} />)).toContain('aria-label="Blade, T2 300"');
    expect(renderToStaticMarkup(<Token plate={{ ...realm, guards: [] }} />)).toContain('aria-label="Undefended"');
  });

  it("sizes a token's box for the layout: the disk, the strip one row high over its edge, an army's stamina bar", () => {
    expect(tokenSize(army).height).toBe(30 - 2 + 18 + 4);
    expect(tokenSize(realm).height).toBe(30 - 2 + 18);
    expect(tokenSize({ ...realm, guards: [] })).toEqual({ width: 30, height: 30 });
  });
});

describe("a plate opened", () => {
  it("marks each troop stack's painting with how it fights, as its token did", () => {
    const marks = (html: string) => [...html.matchAll(/data-combat-mark="(\w+)"/g)].map((match) => match[1]);
    expect(marks(renderToStaticMarkup(<Plate plate={realm} />))).toEqual(["Blade", "Bow"]);
    expect(marks(renderToStaticMarkup(<Plate plate={army} />))).toEqual(["Blade"]);
  });
});

describe("a Shrine's plate opened", () => {
  it("draws its point as the gem filling its row, then +1", () => {
    const shrine: StructurePlate = {
      ...rift,
      owner: "",
      place: undefined,
      name: "Shrine",
      guards: null,
      reward: skillPointGain(3),
    };
    const html = renderToStaticMarkup(<Plate plate={shrine} />);
    // The row's gem is the kit's own size (no line or card size), named for a screen reader.
    expect(html).toContain(
      '<span class="mp-label mp-ranked"><span class="ui-tier" data-tier="3" role="img" aria-label="III">III</span> +1</span>',
    );
  });
});
