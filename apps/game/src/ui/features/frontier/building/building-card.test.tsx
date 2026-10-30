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
  ["Trolls", "Trolls found by new armies", "+55%"],
  ["Rifts", "Rifts found by new armies", "+25%"],
  ["Beasts", "Beasts found by new armies", "+20%"],
];

const nodeOf = (realm: RealmResearchFacts, row: number) =>
  readResearchTree(realm).find((node) => node.row === row && node.maxTier === 5)!;

/** The card as a building's tap opens it, on the lab's realm some days in (a City; Farm rare, Barracks rare). */
const draw = (
  row: number,
  {
    realm = MID_REALM,
    makes,
    standing = 4,
    viewer = false,
  }: { realm?: RealmResearchFacts; makes?: CardMakes; standing?: number; viewer?: boolean } = {},
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
        orders={
          viewer
            ? undefined
            : {
                sending: false,
                fix: () => ({ icon: "realm", word: "Level up the castle", onFix }),
                onResearch,
                demolish: <button type="button">Delete</button>,
              }
        }
        onClose={() => undefined}
      />,
    ),
  );
  return { onResearch, onFix };
};
const card = () => host.querySelector("[data-building-card]")!;
/** Each figure's row as read: its word, what it does (the line under the word), then its figures. */
const rows = () =>
  [...card().querySelectorAll("[data-compare] > :not(:first-child)")].map((row) =>
    [...row.children].flatMap((cell, index) => {
      const line = cell.querySelector("[data-line]")?.textContent;
      return index === 0
        ? [cell.textContent!.slice(0, cell.textContent!.length - (line?.length ?? 0)), line]
        : [cell.textContent];
    }),
  );
/** The tier gems as drawn: the head's, then the table's now and next. */
const gems = () => [...card().querySelectorAll(".ui-tier")].map((gem) => gem.textContent);
const button = (text: RegExp) => [...host.querySelectorAll("button")].find((each) => text.test(each.textContent ?? ""));

it("says what all the Farms make as one number, and their research only as gems", () => {
  draw(research.ROW_FARM, { makes: { icon: "wheat", rate: "+25/min" } });
  expect(card().textContent).toContain("+25/min");
  // How many stand, counted as buildings (owner, 27 October: "6 buildings instead of 6 standing").
  expect(card().textContent).toContain("4 buildings");
  expect(card().textContent).not.toContain("standing");
  // The research behind the rate is the gem on the painting's corner, never words for it (owner, 27 October: "why no
  // gems instead of the text ?", "the III as a badge to the barracks icon"), not even on a hover.
  expect(card().querySelector("[data-badged] .ui-tier")?.textContent).toBe("I");
  expect(card().textContent).not.toMatch(/ from (Fields|Tools|Drill)/);
  expect(card().querySelector('[data-tip*=" from "]')).toBeNull();
  // Never a formula on the card (owner, 26 October: "its a game not a math demo").
  expect(card().textContent).not.toMatch(/×|\(\d|\d \+ \d/);
});

it("reads each side now against the next tier, picks a side by its row, and researches the side picked", () => {
  const { onResearch } = draw(research.ROW_FARM);
  expect(rows()).toEqual([
    ["Fields", "Wheat from every Farm", "+20%", "→", "+40%"],
    ["Granary", "The castle's wheat storage", "+40%", "→", "+80%"],
  ]);
  expect(button(/^Research Fields$/)).toBeDefined();
  act(() => button(/^Granary/)!.click());
  expect(button(/^Granary/)!.getAttribute("aria-pressed")).toBe("true");
  act(() => button(/^Research Granary$/)!.click());
  expect(onResearch).toHaveBeenCalledWith(1);
  // The tier is its gem, never its word: a Rare Farm holds II, its next tier III.
  expect(gems()).toEqual(["I", "I", "II"]);
  expect(card().textContent).not.toMatch(/Common|Uncommon|Rare|Epic|Legendary/);
});

it("keeps Research, dimmed, when the labor storage cannot hold the tier's price, saying why with its fix", () => {
  const { onResearch, onFix } = draw(research.ROW_BARRACKS, {
    realm: { ...MID_REALM, learned: { ...MID_REALM.learned, 2: { tier: 3, sides: [0, 0, 0] } } },
  });
  const verb = button(/^Research Drill$/)!;
  expect(verb.disabled).toBe(true);
  expect(host.querySelector('[role="status"]')!.textContent).toBe("Labor storage 18,000 / 24,000 · Kingdom");
  act(() => verb.click());
  expect(onResearch).not.toHaveBeenCalled();
  act(() => button(/^Level up the castle$/)!.click());
  expect(onFix).toHaveBeenCalled();
});

it("says the Essence the Workshops need against what is held, beside Research dimmed, and nothing else", () => {
  // The game offers no fix for a price held short of: the line is the whole answer (owner, 27 October).
  act(() =>
    root.render(
      <BuildingCardView
        name="Workshop"
        icon="workshop"
        standing={3}
        makes={undefined}
        node={nodeOf({ ...MID_REALM, essence: 1_000 }, research.ROW_WORKSHOP)}
        orders={{
          sending: false,
          fix: () => undefined,
          onResearch: vi.fn(),
          demolish: <button type="button">Delete</button>,
        }}
        onClose={() => undefined}
      />,
    ),
  );
  const verb = button(/^Research Tools$/)!;
  expect(verb.disabled).toBe(true);
  const foot = verb.closest(".ui-window__foot")!;
  expect(foot.textContent).toMatch(/^Needs [\d,.K]+ Essence, have 1,000Research Tools$/);
  expect(foot.querySelectorAll("button")).toHaveLength(1);
});

it("shows a training building's one figure, what every new army starts with, now and next", () => {
  draw(research.ROW_WAR_HALL, { standing: 1 });
  expect(card().textContent).toContain("1 building");
  expect(card().textContent).not.toContain("1 buildings");
  expect(rows()).toEqual([["Battle", "New armies start with Battle", "+10% damage", "→", "+25% damage"]]);
  expect(button(/^Research$/)).toBeDefined();
  // Common is I on the card and current column; the next tier is II.
  expect(gems()).toEqual(["I", "I", "II"]);
});

it("at Legendary shows what research gave, with no next column and no Research", () => {
  const legendary: RealmResearchFacts = {
    ...MID_REALM,
    learned: { ...MID_REALM.learned, [research.ROW_FARM]: { tier: 5, sides: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1] } },
  };
  draw(research.ROW_FARM, { realm: legendary });
  expect(rows()).toEqual([
    ["Fields", "Wheat from every Farm", "+100%"],
    ["Granary", "The castle's wheat storage", "+200%"],
  ]);
  expect(button(/^Research/)).toBeUndefined();
  expect(gems()).toEqual(["V", "V"]);
});

it("reads a viewer's building as it stands: what it makes and its tier, with nothing to pay or order", () => {
  draw(research.ROW_FARM, { viewer: true, makes: { icon: "wheat", rate: "+25/min" } });
  expect(card().textContent).toContain("+25/min");
  expect(card().textContent).toContain("4 buildings");
  expect(rows()).toEqual([
    ["Fields", "Wheat from every Farm", "+20%"],
    ["Granary", "The castle's wheat storage", "+40%"],
  ]);
  expect(gems()).toEqual(["I", "I"]);
  // The sheet's close is its one control.
  expect([...host.querySelectorAll("button")].map((each) => each.getAttribute("aria-label"))).toEqual(["Close"]);
  expect(host.querySelector(".ui-window__foot")?.textContent ?? "").toBe("");
  expect(card().textContent).not.toMatch(/Essence|labor|Needs/);
});

/** The lab's realm with the Essence and labor for a Scouts' lodge tier. */
const RICH: RealmResearchFacts = { ...MID_REALM, essence: 1_000_000, labor: 15_000 };

it("shows the Scouts' lodge's three kinds, each held now and next, and researches the kind picked by its row", () => {
  const { onResearch } = draw(research.ROW_SCOUTS_LODGE, { realm: RICH, standing: 1 });
  // The lodge took Rifts at Uncommon.
  expect(rows()).toEqual([
    ["Trolls", "Trolls found by new armies", "0%", "→", "+15%"],
    ["Rifts", "Rifts found by new armies", "+10%", "→", "+25%"],
    ["Beasts", "Beasts found by new armies", "0%", "→", "+15%"],
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
    learned: { ...MID_REALM.learned, [research.ROW_SCOUTS_LODGE]: { tier: 5, sides: [1, 1, 2, 0, 0] } },
  };
  draw(research.ROW_SCOUTS_LODGE, { realm: legendary, standing: 1 });
  expect(rows()).toEqual(LODGE_LEGENDARY);
  expect(button(/^Research/)).toBeUndefined();
});

it("lets the owner choose the other research side after the first reaches V", () => {
  const realm: RealmResearchFacts = {
    ...RICH,
    learned: { ...RICH.learned, [research.ROW_FARM]: { tier: 5, sides: [0, 0, 0, 0, 0] } },
  };
  const { onResearch } = draw(research.ROW_FARM, { realm });
  expect(button(/^Research Fields$/)).toBeUndefined();
  act(() => button(/^Granary/)!.click());
  expect(button(/^Research Granary$/)).toBeDefined();
  act(() => button(/^Research Granary$/)!.click());
  expect(onResearch).toHaveBeenCalledWith(1);
});

it("says under every research figure, on every building's card, what the figure does, the Barracks' gate too", () => {
  const buildings = readResearchTree(MID_REALM).filter((node) => node.maxTier === 5);
  expect(buildings.map(({ name }) => name)).toEqual(
    expect.arrayContaining(["Farm", "Workshop", "Barracks", "Hut", "War hall", "Scouts' lodge"]),
  );
  for (const node of buildings) {
    draw(node.row);
    const shown = rows().map(([word, line]) => [word, line]);
    expect(shown).toEqual(node.figures.map(({ name, line }) => [name, line]));
    for (const [, line] of shown) expect(line).toMatch(/\w{3,}/);
  }
  draw(research.ROW_BARRACKS);
  expect(card().textContent).toContain("The four training buildings are open");
});
