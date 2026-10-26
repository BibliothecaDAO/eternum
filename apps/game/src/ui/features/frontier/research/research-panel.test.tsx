// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MID_REALM } from "./progression-fixture";
import { ResearchPanel } from "./research-panel";
import { needLine, readResearchTree, type TreeNode } from "./research-tree";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const nodes = readResearchTree(MID_REALM);
const draw = (picked: string | null, onResearch = vi.fn(), onPick = vi.fn(), onFix = vi.fn()) =>
  act(() =>
    root.render(
      <ResearchPanel
        nodes={nodes}
        essence={MID_REALM.essence}
        labor={MID_REALM.labor}
        picked={picked}
        onPick={onPick}
        sending={new Set()}
        fixFor={(need) => (need.kind === "store" ? { icon: "realm", word: "Level up the castle", onFix } : undefined)}
        onResearch={onResearch}
      />,
    ),
  );
const button = (text: RegExp) => [...host.querySelectorAll("button")].find((each) => text.test(each.textContent ?? ""));

it("draws every node of the three branches in one panel, each with its state, and picks one in place", () => {
  const onPick = vi.fn();
  draw("row-0", vi.fn(), onPick);
  expect([...host.querySelectorAll("[data-node]")].map((tile) => tile.getAttribute("data-state"))).toEqual(
    nodes.map(({ state }) => state),
  );
  expect(host.querySelectorAll("[role='dialog']")).toHaveLength(0);
  act(() => host.querySelector<HTMLButtonElement>("[data-node='row-4']")!.click());
  expect(onPick).toHaveBeenCalledWith("row-4");
});

it("researches the Farm's next tier with the side picked", () => {
  const onResearch = vi.fn();
  draw("row-0", onResearch);
  act(() => button(/^Granary/)!.click());
  act(() => button(/^Research Granary$/)!.click());
  expect(onResearch).toHaveBeenCalledWith(expect.objectContaining<Partial<TreeNode>>({ key: "row-0", row: 0 }), 1);
});

it("holds a locked node's verb, says why, and offers the step that opens it", () => {
  const onFix = vi.fn();
  draw("row-2", vi.fn(), vi.fn(), onFix);
  expect(host.textContent).toContain("Labor storage 18,000 / 24,000 · a Kingdom holds it");
  expect(button(/^Research /)!.disabled).toBe(true);
  act(() => button(/Level up the castle/)!.click());
  expect(onFix).toHaveBeenCalledOnce();
});

it("names the Scouts' lodge's camp kind Trolls, never Camp", () => {
  draw("row-6");
  const choice = host.querySelector("[data-lab='node-choice']")!;
  expect([...choice.querySelectorAll("button[aria-pressed]")].map((side) => side.getAttribute("title"))).toEqual([
    "Trolls found by new armies",
    "Rifts found by new armies",
    "Beasts found by new armies",
  ]);
  expect(host.textContent).not.toMatch(/Camp/);
});

describe("the picked building's choice, at the panel's foot (the owner's pick C)", () => {
  const choice = () => host.querySelector("[data-lab='node-choice']");

  it("keeps what a finished node gives: the Shrine researched, a Hut at Legendary", () => {
    draw("shrine");
    expect(choice()!.textContent).toContain("Armies find Shrines · +200 XP each");
    const legendaryHut = readResearchTree({
      ...MID_REALM,
      learned: { ...MID_REALM.learned, 3: { tier: 4, sides: [] } },
    });
    act(() =>
      root.render(
        <ResearchPanel
          nodes={legendaryHut}
          essence={MID_REALM.essence}
          labor={MID_REALM.labor}
          picked="row-3"
          onPick={vi.fn()}
          sending={new Set()}
          fixFor={() => undefined}
          onResearch={vi.fn()}
        />,
      ),
    );
    expect(choice()!.textContent).toContain("Population from every Hut · +100%");
  });

  it("stands after the whole tree, outside its scroll, with the price held against and Research", () => {
    draw("row-0");
    const tree = host.querySelector("[data-node]")!.closest(".overflow-y-auto")!;
    // Not inside the tree's scroll: no tile the tree scrolls to can push it out of view.
    expect(tree.contains(choice())).toBe(false);
    expect(tree.compareDocumentPosition(choice()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(choice()!.textContent).toContain("Farm");
    expect(button(/^Research Fields$/)).toBeDefined();
    const price = nodes
      .find(({ key }) => key === "row-0")!
      .needs.filter(({ kind }) => kind === "essence" || kind === "labor");
    expect([...choice()!.querySelectorAll("[aria-label*='/']")].map((chip) => chip.getAttribute("aria-label"))).toEqual(
      price.map((need) => needLine(need)),
    );
  });

  it("is put away with its X, leaving the tree, and opens again on the tile tapped", () => {
    const onPick = vi.fn();
    draw("row-0", vi.fn(), onPick);
    act(() => host.querySelector<HTMLButtonElement>("[aria-label='Close']")!.click());
    expect(onPick).toHaveBeenCalledWith(null);
    draw(null, vi.fn(), onPick);
    expect(choice()).toBeNull();
    expect(host.querySelectorAll("[data-node]")).toHaveLength(nodes.length);
    act(() => host.querySelector<HTMLButtonElement>("[data-node='row-3']")!.click());
    expect(onPick).toHaveBeenLastCalledWith("row-3");
  });
});
