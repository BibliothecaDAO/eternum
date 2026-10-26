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
  // The tier is a mark, never its word.
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
});
