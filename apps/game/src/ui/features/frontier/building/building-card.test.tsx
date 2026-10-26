// @vitest-environment jsdom
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MID_REALM } from "../research/progression-fixture";
import { readResearchTree, type RealmResearchFacts } from "../research/research-tree";
import { type CardMakes, BuildingCardView } from "./building-card";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/**
 * Rifts took Uncommon and Rare, Beasts Epic, Trolls Legendary: each kind holds its own tiers' Scouting steps
 * (rules.cairo: +10%, +20%, +30%, +40%), Rifts 10 + 20.
 */
const LODGE_LEGENDARY = [
  ["Trolls", "+40%"],
  ["Rifts", "+30%"],
  ["Beasts", "+30%"],
];

const nodeOf = (realm: RealmResearchFacts, row: number) =>
  readResearchTree(realm).find((node) => node.row === row && node.maxTier === 4)!;

/** The card as a building's tap opens it, on the lab's realm some days in (a City; Farm rare, Barracks rare). */
const draw = (
  row: number,
  { realm = MID_REALM, makes, standing = 4 }: { realm?: RealmResearchFacts; makes?: CardMakes; standing?: number } = {},
) => {
  const onResearch = vi.fn();
  const onFix = vi.fn();
  act(() =>
    root.render(
      <BuildingCardView
        name="Farm"
        icon="farm"
        standing={standing}
        makes={makes}
        node={nodeOf(realm, row)}
        sending={false}
        fix={() => ({ icon: "realm", word: "Level up the castle", onFix })}
        onResearch={onResearch}
        demolish={<button type="button">Delete</button>}
        onClose={() => undefined}
      />,
    ),
  );
  return { onResearch, onFix };
};
const card = () => host.querySelector("[data-building-card]")!;
const rows = () =>
  [...card().querySelectorAll("[data-compare] > :not(:first-child)")].map((row) =>
    [...row.children].map((cell) => cell.textContent),
  );
/** The tier gems as drawn: the head's, then the table's now and next. */
const gems = () => [...card().querySelectorAll(".ui-tier")].map((gem) => gem.textContent);
const button = (text: RegExp) => [...host.querySelectorAll("button")].find((each) => text.test(each.textContent ?? ""));

it("says what all the Farms make as one number, with research's share only as its why", () => {
  draw(research.ROW_FARM, { makes: { icon: "wheat", rate: "+25/min", why: "+25% from Fields" } });
  const made = [...card().querySelectorAll("[data-tip]")].find((each) => each.textContent === "+25/min")!;
  expect(made.getAttribute("data-tip")).toBe("+25% from Fields");
  expect(card().textContent).toContain("4 standing");
  // Never a formula on the card (owner, 26 October: "its a game not a math demo").
  expect(card().textContent).not.toMatch(/×|\(\d|\d \+ \d/);
});

it("reads each side now against the next tier, picks a side by its row, and researches the side picked", () => {
  const { onResearch } = draw(research.ROW_FARM);
  expect(rows()).toEqual([
    ["Fields", "+25%", "→", "+50%"],
    ["Granary", "+50%", "→", "+100%"],
  ]);
  expect(button(/^Research Fields$/)).toBeDefined();
  act(() => button(/^Granary/)!.click());
  expect(button(/^Granary/)!.getAttribute("aria-pressed")).toBe("true");
  act(() => button(/^Research Granary$/)!.click());
  expect(onResearch).toHaveBeenCalledWith(1);
  // The tier is its gem, never its word: a Rare Farm holds II, its next tier III.
  expect(gems()).toEqual(["III", "III", "IV"]);
  expect(card().textContent).not.toMatch(/Common|Uncommon|Rare|Epic|Legendary/);
});

it("keeps Research, dimmed, when the labor storage cannot hold the tier's price, saying why with its fix", () => {
  const { onResearch, onFix } = draw(research.ROW_BARRACKS);
  const verb = button(/^Research Drill$/)!;
  expect(verb.disabled).toBe(true);
  expect(host.querySelector('[role="status"]')!.textContent).toBe("Labor storage 18,000 / 24,000 · a Kingdom holds it");
  act(() => verb.click());
  expect(onResearch).not.toHaveBeenCalled();
  act(() => button(/^Level up the castle$/)!.click());
  expect(onFix).toHaveBeenCalled();
});

it("shows a training building's one figure, what every new army starts with, now and next", () => {
  draw(research.ROW_WAR_HALL, { standing: 1 });
  expect(rows()).toEqual([["Battle", "0% damage", "→", "+10% damage"]]);
  expect(button(/^Research$/)).toBeDefined();
  // Common is I on the card and current column; the next tier is II.
  expect(gems()).toEqual(["I", "I", "II"]);
});

it("at Legendary shows what research gave, with no next column and no Research", () => {
  const legendary: RealmResearchFacts = {
    ...MID_REALM,
    learned: { ...MID_REALM.learned, [research.ROW_FARM]: { tier: 4, sides: [0, 1, 0, 0] } },
  };
  draw(research.ROW_FARM, { realm: legendary });
  expect(rows()).toEqual([
    ["Fields", "+75%"],
    ["Granary", "+50%"],
  ]);
  expect(button(/^Research/)).toBeUndefined();
  expect(gems()).toEqual(["V", "V"]);
});

/** The lab's realm with the Essence and labor for a Scouts' lodge tier. */
const RICH: RealmResearchFacts = { ...MID_REALM, essence: 1_000_000, labor: 15_000 };

it("shows the Scouts' lodge's three kinds, each held now and next, and researches the kind picked by its row", () => {
  const { onResearch } = draw(research.ROW_SCOUTS_LODGE, { realm: RICH, standing: 1 });
  // The lodge took Rifts at Uncommon.
  expect(rows()).toEqual([
    ["Trolls", "0%", "→", "+20%"],
    ["Rifts", "+10%", "→", "+30%"],
    ["Beasts", "0%", "→", "+20%"],
  ]);
  act(() => button(/^Rifts/)!.click());
  act(() => button(/^Research Rifts$/)!.click());
  expect(onResearch).toHaveBeenLastCalledWith(1);
  act(() => button(/^Beasts/)!.click());
  act(() => button(/^Research Beasts$/)!.click());
  expect(onResearch).toHaveBeenLastCalledWith(2);
});

it("at the lodge's Legendary says which kind holds what research gave it", () => {
  const legendary: RealmResearchFacts = {
    ...MID_REALM,
    learned: { ...MID_REALM.learned, [research.ROW_SCOUTS_LODGE]: { tier: 4, sides: [1, 1, 2, 0] } },
  };
  draw(research.ROW_SCOUTS_LODGE, { realm: legendary, standing: 1 });
  expect(rows()).toEqual(LODGE_LEGENDARY);
  expect(button(/^Research/)).toBeUndefined();
});
