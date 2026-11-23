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

import { EARLY_REALM, MID_REALM } from "./progression-fixture";
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
  learned: { ...MID_REALM.learned, [research.ROW_SUPPLY_YARD]: { tier: 4 } },
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

it("researches the Farm's next tier", () => {
  const onResearch = vi.fn();
  draw("row-0", onResearch);
  act(() => button(/^Research Farm/)!.click());
  expect(onResearch).toHaveBeenCalledWith(expect.objectContaining<Partial<TreeNode>>({ key: "row-0", row: 0 }));
});

it("holds a locked node's verb, says why, and offers the step that opens it", () => {
  const onFix = vi.fn();
  const limited = readResearchTree({ ...MID_REALM, learned: { ...MID_REALM.learned, 5: { tier: 4 } } });
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

it("states why each locked or short row is held back in plain words without repeating its button", () => {
  const early = readResearchTree(EARLY_REALM);
  const fixFor = (need: TreeNode["needs"][number]) => {
    if (need.kind === "level") return { icon: "realm" as const, word: "Level up the castle", onFix: vi.fn() };
    if (need.kind === "stands") return { icon: need.icon, word: `Build a ${need.building}`, onFix: vi.fn() };
    if (need.kind === "tier") return { icon: need.icon, word: need.node, onFix: vi.fn() };
    return undefined;
  };
  act(() =>
    root.render(
      <ResearchPanel
        nodes={early}
        picked={`row-${research.ROW_CONSCRIPTION}`}
        onPick={vi.fn()}
        sending={new Set()}
        fixFor={fixFor}
        onResearch={vi.fn()}
        onClose={vi.fn()}
      />,
    ),
  );
  const campRow = host.querySelector(`[data-node='row-${research.ROW_CONSCRIPTION}']`)!;
  expect(campRow.querySelector("[data-lock-reason]")?.textContent).toBe("Needs the Realm at City");
  const campChoice = host.querySelector("[data-lab='node-choice']")!;
  const campReason = campChoice.querySelector("[data-lock-reason]")!.textContent;
  const campButton = campChoice.querySelector<HTMLButtonElement>("[data-research-footer] button")!.textContent;
  expect(campReason).toBe("Needs the Realm at City");
  expect(campButton).toBe("Level up the castle");
  expect(campReason).not.toBe(campButton);

  const city = readResearchTree({ ...EARLY_REALM, castleLevel: 1 });
  act(() =>
    root.render(
      <ResearchPanel
        nodes={city}
        picked={`row-${research.ROW_CONSCRIPTION}`}
        onPick={vi.fn()}
        sending={new Set()}
        fixFor={fixFor}
        onResearch={vi.fn()}
        onClose={vi.fn()}
      />,
    ),
  );
  const standingReason = host.querySelector("[data-lab='node-choice'] [data-lock-reason]")!.textContent;
  const buildButton = host.querySelector<HTMLButtonElement>(
    "[data-lab='node-choice'] [data-research-footer] button",
  )!.textContent;
  expect(standingReason).toBe("Needs a Conscription Camp standing");
  expect(buildButton).toBe("Build a Conscription Camp");
  expect(standingReason).not.toBe(buildButton);

  act(() =>
    root.render(
      <ResearchPanel
        nodes={early}
        picked="well"
        onPick={vi.fn()}
        sending={new Set()}
        fixFor={fixFor}
        onResearch={vi.fn()}
        onClose={vi.fn()}
      />,
    ),
  );
  expect(host.querySelector("[data-lab='node-choice'] [data-lock-reason]")!.textContent).toBe("Needs 2,500 Essence");
});

describe("the picked building's choice, at the panel's foot (the owner's pick C)", () => {
  const choice = () => host.querySelector("[data-lab='node-choice']");

  it("keeps what a finished node gives: the Shrine researched, a Farm at Legendary", () => {
    draw("shrine");
    expect(choice()!.textContent).toContain("Armies find Shrines · Open");
    const legendaryFarm = readResearchTree({
      ...MID_REALM,
      learned: { ...MID_REALM.learned, 0: { tier: 5 } },
    });
    act(() =>
      root.render(
        <ResearchPanel
          nodes={legendaryFarm}
          picked="row-0"
          onPick={vi.fn()}
          sending={new Set()}
          fixFor={() => undefined}
          onResearch={vi.fn()}
          onClose={() => undefined}
        />,
      ),
    );
    expect(choice()!.textContent).toContain("Farm wheat · +100%");
  });

  it("stands after the whole tree, outside its scroll, with the price held against and Research", () => {
    draw("row-0");
    const tree = host.querySelector("[data-node]")!.closest(".overflow-y-auto")!;
    // Not inside the tree's scroll: no tile the tree scrolls to can push it out of view.
    expect(tree.contains(choice())).toBe(false);
    expect(tree.compareDocumentPosition(choice()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(choice()!.textContent).toContain("Farm");
    expect(choice()!.querySelector(".ui-tier-step")?.getAttribute("aria-label")).toBe("I → II");
    expect([...choice()!.querySelectorAll(".ui-tier")].map((gem) => gem.textContent)).toEqual(["I", "II", "II"]);
    expect(button(/^Research Farm/)).toBeDefined();
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
    act(() => host.querySelector<HTMLButtonElement>("[data-node='row-1']")!.click());
    expect(onPick).toHaveBeenLastCalledWith("row-1");
  });
});

it("shows the Farm's output step without a production formula", () => {
  draw("row-0");
  const lines = [...host.querySelectorAll("[data-lab='node-choice'] > span")].map((line) => line.textContent);
  expect(lines).toEqual(["Farm wheat · +20% → +40%"]);
  expect(host.querySelector("[data-lab='node-choice'] [title]")).toBeNull();
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
  [0, "0 max stamina → +36 max stamina"],
  [1, "+36 max stamina → +72 max stamina"],
  [2, "+72 max stamina → +108 max stamina"],
  [3, "+108 max stamina → +144 max stamina"],
  [4, "+144 max stamina → +180 max stamina"],
  [5, "+180 max stamina"],
] as const)("shows the Supply yard's exact stamina gain at rank %s", (tier, label) => {
  const ranked = readResearchTree({
    ...MID_REALM,
    learned: { ...MID_REALM.learned, 5: { tier } },
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
