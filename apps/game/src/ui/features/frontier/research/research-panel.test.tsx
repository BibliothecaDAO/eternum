// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";

import { MID_REALM } from "./progression-fixture";
import { ResearchPanel } from "./research-panel";
import { CastleResearch } from "../upgrade/castle-view";
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

const nodes = readResearchTree({
  ...MID_REALM,
  learned: { ...MID_REALM.learned, [research.ROW_SUPPLY_YARD]: { tier: 4, sides: [0, 0, 0, 0] } },
});
const draw = (picked: string | null, onResearch = vi.fn(), onPick = vi.fn(), onFix = vi.fn(), onClose = vi.fn()) =>
  act(() =>
    root.render(
      <ResearchPanel
        nodes={nodes}
        picked={picked}
        onPick={onPick}
        sending={new Set()}
        fixFor={(need) => (need.kind === "store" ? { icon: "realm", word: "Level up the castle", onFix } : undefined)}
        onResearch={onResearch}
        onClose={onClose}
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
  act(() => host.querySelector<HTMLButtonElement>("[data-node='row-5']")!.click());
  expect(onPick).toHaveBeenCalledWith("row-5");
});

it("closes as every panel does: its X and Escape", () => {
  const onClose = vi.fn();
  draw(null, vi.fn(), vi.fn(), vi.fn(), onClose);
  act(() => host.querySelector<HTMLButtonElement>("button[aria-label='Close']")!.click());
  expect(onClose).toHaveBeenCalledTimes(1);
  act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(onClose).toHaveBeenCalledTimes(2);
});

it("names each of the castle card's compact tiles on the tile itself, which a phone cannot hover (audit 10-27)", () => {
  const castle = nodes.filter((node) => node.branch === "castle");
  act(() => root.render(<CastleResearch nodes={castle} onOpen={vi.fn()} />));
  const tiles = [...host.querySelectorAll<HTMLButtonElement>("[data-node]")];
  expect(tiles.map((tile) => tile.textContent)).toEqual(castle.map((node) => node.name));
  expect(castle.map(({ key }) => key)).toEqual(["well", "shrine", "spire"]);
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
  const limited = readResearchTree({ ...MID_REALM, learned: { ...MID_REALM.learned, 5: { tier: 4, sides: [] } } });
  act(() =>
    root.render(
      <ResearchPanel
        nodes={limited}
        picked="row-5"
        onPick={vi.fn()}
        sending={new Set()}
        fixFor={() => ({ icon: "realm", word: "Level up the castle", onFix })}
        onResearch={vi.fn()}
        onClose={vi.fn()}
      />,
    ),
  );
  expect(host.textContent).toContain("Labor storage 15,000 / 25,000 · Kingdom");
  expect(button(/^Research /)).toBeUndefined();
  expect(
    [...host.querySelectorAll<HTMLButtonElement>("[data-research-footer] button")].map((each) => each.textContent),
  ).toEqual(["Level up the castle"]);
  act(() => button(/Level up the castle/)!.click());
  expect(onFix).toHaveBeenCalledOnce();
});

describe("the picked building's choice, at the panel's foot (the owner's pick C)", () => {
  const choice = () => host.querySelector("[data-lab='node-choice']");

  it("keeps what a finished node gives: the Shrine researched, a Hut at Legendary", () => {
    draw("shrine");
    expect(choice()!.textContent).toContain("Armies find Shrines · Open");
    const legendaryHut = readResearchTree({
      ...MID_REALM,
      learned: { ...MID_REALM.learned, 3: { tier: 5, sides: [] } },
    });
    act(() =>
      root.render(
        <ResearchPanel
          nodes={legendaryHut}
          picked="row-3"
          onPick={vi.fn()}
          sending={new Set()}
          fixFor={() => undefined}
          onResearch={vi.fn()}
          onClose={() => undefined}
        />,
      ),
    );
    expect(choice()!.textContent).toContain("Hut population · +100%");
  });

  it("stands after the whole tree, outside its scroll, with the price held against and Research", () => {
    draw("row-0");
    const tree = host.querySelector("[data-node]")!.closest(".overflow-y-auto")!;
    // Not inside the tree's scroll: no tile the tree scrolls to can push it out of view.
    expect(tree.contains(choice())).toBe(false);
    expect(tree.compareDocumentPosition(choice()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(choice()!.textContent).toContain("Farm");
    expect(choice()!.querySelector(".ui-tier-step")?.getAttribute("aria-label")).toBe("I → II");
    expect([...choice()!.querySelectorAll(".ui-tier")].map((gem) => gem.textContent)).toEqual(["I", "II"]);
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
    act(() => choice()!.querySelector<HTMLButtonElement>("[aria-label='Close']")!.click());
    expect(onPick).toHaveBeenCalledWith(null);
    draw(null, vi.fn(), onPick);
    expect(choice()).toBeNull();
    expect(host.querySelectorAll("[data-node]")).toHaveLength(nodes.length);
    act(() => host.querySelector<HTMLButtonElement>("[data-node='row-3']")!.click());
    expect(onPick).toHaveBeenLastCalledWith("row-3");
  });
});

it("shows the chosen research shares without a production formula", () => {
  act(() =>
    root.render(
      <ResearchPanel
        nodes={nodes}
        picked="row-0"
        onPick={vi.fn()}
        sending={new Set()}
        fixFor={() => undefined}
        onResearch={vi.fn()}
        onClose={() => undefined}
      />,
    ),
  );
  expect(button(/^Fields/)!.textContent).toBe("FieldsFarm wheat+20% → +40%");
  expect(button(/^Fields/)!.hasAttribute("title")).toBe(false);
  expect(button(/^Granary/)!.textContent).not.toContain("Each Farm");
  // The choice reads from its cards: no line explaining the sides or that they are kept.
  const lines = [...host.querySelectorAll("[data-lab='node-choice'] > span")].map((line) => line.textContent);
  expect(lines).toEqual([]);
});

it("keeps the chosen Research action outside the tree scroll on every pick, including the initial Farm", () => {
  const Picking = () => {
    const [picked, setPicked] = useState<string | null>("row-0");
    return (
      <ResearchPanel
        nodes={nodes}
        picked={picked}
        onPick={setPicked}
        sending={new Set()}
        fixFor={() => undefined}
        onResearch={vi.fn()}
        onClose={() => undefined}
      />
    );
  };
  act(() => root.render(<Picking />));
  for (const row of ["row-1", "row-5", "row-0"]) {
    act(() => host.querySelector<HTMLButtonElement>(`[data-node='${row}']`)!.click());
    const choice = host.querySelector("[data-lab='node-choice']")!;
    expect(choice.textContent).toContain(nodes.find(({ key }) => key === row)!.name);
    expect(host.querySelector(".overflow-y-auto")!.contains(choice)).toBe(false);
    expect([...choice.querySelectorAll("button")].at(-1)?.textContent).toMatch(/^Research/);
  }
});

it.each([
  [0, "0 max stamina → +20 max stamina"],
  [1, "+20 max stamina → +45 max stamina"],
  [2, "+45 max stamina → +75 max stamina"],
  [3, "+75 max stamina → +110 max stamina"],
  [4, "+110 max stamina → +150 max stamina"],
  [5, "+150 max stamina"],
] as const)("shows the Supply yard's exact stamina gain at rank %s", (tier, label) => {
  const ranked = readResearchTree({
    ...MID_REALM,
    learned: { ...MID_REALM.learned, 5: { tier, sides: [] } },
  });
  act(() =>
    root.render(
      <ResearchPanel
        nodes={ranked}
        picked="row-5"
        onPick={vi.fn()}
        sending={new Set()}
        fixFor={() => undefined}
        onResearch={vi.fn()}
        onClose={vi.fn()}
      />,
    ),
  );
  const card = host.querySelector("[data-lab='node-choice']")!;
  const effect = [...card.querySelectorAll(":scope > span")].find((line) =>
    line.textContent?.startsWith("New armies start with Logistics"),
  );
  // Each rank is its gem, read by its name, never a numeral in the words.
  expect(saidWithGems(effect!)).toBe(`New armies start with Logistics · ${label}`);
});

/** An element's words with each gem said by its name, as a screen reader reads the line. */
const saidWithGems = (element: Element): string => {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll(".ui-tier").forEach((gem) => gem.replaceWith(gem.getAttribute("aria-label") ?? ""));
  return copy.textContent ?? "";
};

it("renders every generated research row", () => {
  const onPick = vi.fn();
  draw(null, vi.fn(), onPick);
  const renderedRows = [...host.querySelectorAll("[data-node]")].map((tile) => {
    act(() => (tile as HTMLButtonElement).click());
    return nodes.find((node) => node.key === onPick.mock.lastCall![0])!.row;
  });
  const catalogRows = Object.entries(research)
    .filter(([key]) => key.startsWith("ROW_"))
    .map(([, row]) => row);
  expect([...new Set(renderedRows)].sort((a, b) => a - b)).toEqual(catalogRows.sort((a, b) => a - b));
  expect(new Set(renderedRows).size).toBe(catalogRows.length);
});

it("says on every side of every row what it does, in sight on the side, never only on a hover", () => {
  const sided = nodes.filter((node) => node.sides);
  expect(sided.map(({ key }) => key)).toEqual(["row-0", "row-1"]);
  for (const node of sided) {
    draw(node.key);
    const choice = host.querySelector("[data-lab='node-choice']")!;
    const shown = [...choice.querySelectorAll("button[aria-pressed]")].map((side) => side.textContent);
    expect(shown).toHaveLength(node.sides!.length);
    node.sides!.forEach((side, index) => expect(shown[index]).toContain(`${side.name}${side.line}`));
    expect(choice.querySelector("[title]")).toBeNull();
  }
});
