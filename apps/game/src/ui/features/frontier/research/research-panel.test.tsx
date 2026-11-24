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
        fixFor={(need) => (need.kind === "store" ? { icon: "realm", word: "Upgrade the Castle", onFix } : undefined)}
        onResearch={onResearch}
        onClose={onClose}
        essence={MID_REALM.essence}
        labor={MID_REALM.labor}
        castleLevel={MID_REALM.castleLevel}
      />,
    ),
  );
const button = (text: RegExp) => [...host.querySelectorAll("button")].find((each) => text.test(each.textContent ?? ""));

it("draws every node of the three branches in one panel, each with its state, and picks one in place", () => {
  const onPick = vi.fn();
  draw("row-0", vi.fn(), onPick);
  const renderedStates = Object.fromEntries(
    [...host.querySelectorAll("[data-node]")].map((tile) => [
      tile.getAttribute("data-node"),
      tile.getAttribute("data-state"),
    ]),
  );
  expect(renderedStates).toEqual(Object.fromEntries(nodes.map(({ key, state }) => [key, state])));
  expect(host.querySelectorAll("[role='dialog']")).toHaveLength(0);
  act(() => host.querySelector<HTMLElement>("[data-node='row-5']")!.click());
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
  act(() => host.querySelector<HTMLButtonElement>("button[aria-label='Upgrade Farm']")!.click());
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
        fixFor={() => ({ icon: "realm", word: "Upgrade the Castle", onFix })}
        onResearch={vi.fn()}
        onClose={vi.fn()}
        essence={MID_REALM.essence}
        labor={MID_REALM.labor}
        castleLevel={MID_REALM.castleLevel}
      />,
    ),
  );
  expect(host.textContent).toContain("Labor storage 15,000 / 25,000 · Kingdom");
  expect(host.querySelector("[data-node='row-5'] button[aria-label^='Upgrade ']")).toBeNull();
  expect(host.querySelector("button[aria-label='Upgrade Supply yard']")).toBeNull();
  expect(
    [...host.querySelectorAll<HTMLButtonElement>("[data-research-footer] button")].map((each) => each.textContent),
  ).toEqual(["Upgrade the Castle"]);
  act(() => button(/Upgrade the Castle/)!.click());
  expect(onFix).toHaveBeenCalledOnce();
});

it("states why each locked or short row is held back in plain words without repeating its button", () => {
  const early = readResearchTree(EARLY_REALM);
  const fixFor = (need: TreeNode["needs"][number]) => {
    if (need.kind === "level") return { icon: "realm" as const, word: "Upgrade the Castle", onFix: vi.fn() };
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
        essence={EARLY_REALM.essence}
        labor={EARLY_REALM.labor}
        castleLevel={EARLY_REALM.castleLevel}
      />,
    ),
  );
  const campRow = host.querySelector(`[data-node='row-${research.ROW_CONSCRIPTION}']`)!;
  expect(campRow.querySelector("[data-lock-reason]")?.textContent).toBe("Needs the Realm at City");
  const campChoice = host.querySelector("[data-lab='node-choice']")!;
  const campReason = campChoice.querySelector("[data-lock-reason]")!.textContent;
  const campButton = campChoice.querySelector<HTMLButtonElement>("[data-research-footer] button")!.textContent;
  expect(campReason).toBe("Needs the Realm at City");
  expect(campButton).toBe("Upgrade the Castle");
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
        essence={EARLY_REALM.essence}
        labor={EARLY_REALM.labor}
        castleLevel={1}
      />,
    ),
  );
  const standingReason = host.querySelector("[data-lab='node-choice'] [data-lock-reason]")!.textContent;
  const buildButton = host.querySelector<HTMLButtonElement>(
    "[data-lab='node-choice'] [data-research-footer] button",
  )!.textContent;
  expect(standingReason).toBe("Needs a Conscription Camp");
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
        essence={EARLY_REALM.essence}
        labor={EARLY_REALM.labor}
        castleLevel={EARLY_REALM.castleLevel}
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
          essence={MID_REALM.essence}
          labor={MID_REALM.labor}
          castleLevel={MID_REALM.castleLevel}
        />,
      ),
    );
    expect(choice()!.textContent).toContain("Farm wheat · 200%");
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
    expect(host.querySelectorAll("button[aria-label='Upgrade Farm']")).toHaveLength(1);
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
  const lines = [...host.querySelectorAll("[data-lab='node-choice'] [data-choice-summary]")].map(
    (line) => line.textContent,
  );
  expect(lines).toEqual(["Farm wheat · 120% → 140%"]);
  expect(host.querySelector("[data-node='row-0'] [data-research-effect]")?.textContent).toBe("120% → 140%");
  expect(host.querySelector("[data-node='row-4'] [data-research-effect]")?.textContent).toBe(
    "2 wheat per troop → 1.8 wheat per troop (less)",
  );
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
        essence={MID_REALM.essence}
        labor={MID_REALM.labor}
        castleLevel={MID_REALM.castleLevel}
      />
    );
  };
  act(() => root.render(<Picking />));
  const scrolled: string[] = [];
  const originalScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (this: Element) {
    const key = this.querySelector("[data-node]")?.getAttribute("data-node");
    if (key) scrolled.push(key);
  };
  try {
    for (const row of ["row-1", "row-5", "row-0"]) {
      act(() => host.querySelector<HTMLButtonElement>(`[data-node='${row}']`)!.click());
      const item = nodes.find(({ key }) => key === row)!;
      const choice = host.querySelector("[data-lab='node-choice']")!;
      expect(choice.textContent).toContain(item.name);
      expect(host.querySelector(".overflow-y-auto")!.contains(choice)).toBe(false);
      if (item.state === "ready") {
        expect(choice.querySelector("button[aria-label^='Upgrade ']")).not.toBeNull();
      } else {
        expect(choice.querySelector("[data-research-footer]")).not.toBeNull();
      }
    }
    expect(scrolled).toEqual(["row-1", "row-5", "row-0"]);
  } finally {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  }
});

it.each([
  [0, "180 max stamina → 216 max stamina"],
  [1, "216 max stamina → 252 max stamina"],
  [2, "252 max stamina → 288 max stamina"],
  [3, "288 max stamina → 324 max stamina"],
  [4, "324 max stamina → 360 max stamina"],
  [5, "360 max stamina"],
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
        essence={MID_REALM.essence}
        labor={MID_REALM.labor}
        castleLevel={MID_REALM.castleLevel}
      />,
    ),
  );
  const card = host.querySelector("[data-lab='node-choice']")!;
  const effect = card.querySelector("[data-choice-summary]")!;
  expect(saidWithGems(effect)).toBe(`New armies start with Logistics · ${label}`);
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

it("keeps cards free of inline Upgrade buttons and routes upgrading through the single selected bottom bar", () => {
  const onResearch = vi.fn();
  const onPick = vi.fn();
  draw(null, onResearch, onPick);
  expect(host.querySelectorAll("[data-node] button")).toHaveLength(0);
  expect(host.querySelectorAll("[role='tab']")).toHaveLength(0);
  expect(host.querySelectorAll("button[aria-label^='Upgrade ']")).toHaveLength(0);
  act(() => host.querySelector<HTMLButtonElement>("[data-node='row-6']")!.click());
  expect(onPick).toHaveBeenCalledWith("row-6");

  const withBarracks = readResearchTree({
    ...MID_REALM,
    standing: { ...MID_REALM.standing, [research.ROW_KNIGHT_OATHS]: 1 },
  });
  act(() =>
    root.render(
      <ResearchPanel
        nodes={withBarracks}
        picked="row-6"
        onPick={onPick}
        sending={new Set()}
        fixFor={() => undefined}
        onResearch={onResearch}
        onClose={vi.fn()}
        essence={MID_REALM.essence}
        labor={MID_REALM.labor}
        castleLevel={MID_REALM.castleLevel}
      />,
    ),
  );
  expect(host.querySelector("[data-research-balances]")?.textContent).toContain("18.3K");
  expect(host.querySelector("[data-era='1'][data-current-era]")).not.toBeNull();
  const upgrades = [...host.querySelectorAll<HTMLButtonElement>("button[aria-label='Upgrade Barracks Oath slots']")];
  expect(upgrades).toHaveLength(1);
  expect(upgrades[0]!.closest("[data-research-footer]")).not.toBeNull();
  expect(upgrades[0]!.dataset.kind).toBe("primary");
  act(() => upgrades[0]!.click());
  expect(onResearch).toHaveBeenCalledWith(expect.objectContaining<Partial<TreeNode>>({ key: "row-6", state: "ready" }));

  const laborShort = readResearchTree({
    ...MID_REALM,
    essence: 50_000,
    labor: 100,
    standing: { ...MID_REALM.standing, [research.ROW_KNIGHT_OATHS]: 1 },
  });
  act(() =>
    root.render(
      <ResearchPanel
        nodes={laborShort}
        picked={null}
        onPick={vi.fn()}
        sending={new Set()}
        fixFor={() => undefined}
        onResearch={vi.fn()}
        onClose={vi.fn()}
        essence={50_000}
        labor={100}
        castleLevel={MID_REALM.castleLevel}
      />,
    ),
  );
  const shortPill = host.querySelector("[data-node='row-6'] [data-phone-pill]")!;
  expect(shortPill.querySelector("[data-icon='labor']")).not.toBeNull();
  expect(shortPill.querySelector("[data-icon='essence']")).toBeNull();
  expect(shortPill.textContent).toBe("1K");
});

it("renders the 3-track Era tree with measured SVG prerequisite links on desktop and phone", () => {
  const rectOf = (left: number, top: number, width: number, height: number): DOMRect =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
  const desktopRects: Record<string, DOMRect> = {
    canvas: rectOf(0, 0, 800, 400),
    well: rectOf(160, 260, 180, 80),
    shrine: rectOf(380, 260, 180, 80),
    spire: rectOf(600, 260, 180, 80),
  };
  const phoneRects: Record<string, DOMRect> = {
    canvas: rectOf(0, 0, 360, 500),
    well: rectOf(240, 40, 110, 120),
    shrine: rectOf(240, 180, 110, 120),
    spire: rectOf(240, 320, 110, 120),
  };
  let layout = desktopRects;
  const originalRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.hasAttribute("data-research-tree")) return layout.canvas!;
    const key = this.getAttribute("data-node");
    if (key && layout[key]) return layout[key]!;
    return rectOf(0, 0, 0, 0);
  };
  try {
    const onResearch = vi.fn();
    const onPick = vi.fn();
    draw("spire", onResearch, onPick);
    expect([...host.querySelectorAll("[data-era]")].map((el) => el.textContent)).toEqual([
      "ISettlement",
      "IICityCurrent",
      "IIIKingdom",
    ]);
    expect([...host.querySelectorAll("[data-branch]")].map((el) => el.getAttribute("data-branch"))).toEqual([
      "economy",
      "army",
      "castle",
    ]);
    const svg = host.querySelector("svg[data-research-links]");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("viewBox")).toBe("0 0 800 400");
    expect(
      [...svg!.querySelectorAll("path[data-link]")].map((path) => [
        path.getAttribute("data-link"),
        path.getAttribute("data-link-state"),
        path.getAttribute("d"),
      ]),
    ).toEqual([
      ["well->shrine", "done", "M 340 300 C 360 300, 360 300, 380 300"],
      ["shrine->spire", "ready", "M 560 300 C 580 300, 580 300, 600 300"],
    ]);
    expect(host.querySelector("[data-node='row-0'] [data-pips]")?.getAttribute("data-pips")).toBe("5");
    expect(host.querySelector("[data-node='row-6'] [data-pips]")?.getAttribute("data-pips")).toBe("3");
    expect(host.querySelector("[data-node='well'] [data-pips]")?.getAttribute("data-pips")).toBe("1");
    expect(host.querySelectorAll("[data-node='row-0'] [data-pips] [data-filled]")).toHaveLength(1);
    const spireButtons = host.querySelectorAll<HTMLButtonElement>("button[aria-label='Upgrade Spire lore']");
    expect(spireButtons).toHaveLength(1);
    expect(spireButtons[0]!.closest("[data-lab='node-choice']")).not.toBeNull();
    expect(spireButtons[0]!.dataset.kind).toBe("primary");
    act(() => spireButtons[0]!.click());
    expect(onResearch).toHaveBeenCalledWith(expect.objectContaining<Partial<TreeNode>>({ key: "spire" }));

    layout = phoneRects;
    const early = readResearchTree(EARLY_REALM);
    act(() =>
      root.render(
        <ResearchPanel
          nodes={early}
          picked={null}
          onPick={vi.fn()}
          sending={new Set()}
          fixFor={() => undefined}
          onResearch={vi.fn()}
          onClose={vi.fn()}
          essence={EARLY_REALM.essence}
          labor={EARLY_REALM.labor}
          castleLevel={EARLY_REALM.castleLevel}
        />,
      ),
    );
    const phoneSvg = host.querySelector("svg[data-research-links]")!;
    expect(phoneSvg.getAttribute("viewBox")).toBe("0 0 360 500");
    expect(
      [...phoneSvg.querySelectorAll("path[data-link]")].map((path) => [
        path.getAttribute("data-link"),
        path.getAttribute("data-link-state"),
        path.getAttribute("d"),
      ]),
    ).toEqual([
      ["well->shrine", "locked", "M 295 160 C 295 170, 295 170, 295 180"],
      ["shrine->spire", "locked", "M 295 300 C 295 310, 295 310, 295 320"],
    ]);

    layout = {
      ...phoneRects,
      shrine: rectOf(240, 180, 110, 90),
      spire: rectOf(240, 290, 110, 120),
    };
    act(() =>
      root.render(
        <ResearchPanel
          nodes={early}
          picked="shrine"
          onPick={vi.fn()}
          sending={new Set()}
          fixFor={() => undefined}
          onResearch={vi.fn()}
          onClose={vi.fn()}
          essence={EARLY_REALM.essence}
          labor={EARLY_REALM.labor}
          castleLevel={EARLY_REALM.castleLevel}
        />,
      ),
    );
    expect(host.querySelector("path[data-link='shrine->spire']")?.getAttribute("d")).toBe(
      "M 295 270 C 295 280, 295 280, 295 290",
    );
  } finally {
    Element.prototype.getBoundingClientRect = originalRect;
  }
});

it("renders concise phone short effects, legible locked titles, and a bottom scroll cue that hides at the end", () => {
  draw(null);
  expect(host.querySelector("[data-node='row-6'] [data-research-effect-short]")?.textContent).toBe("2 → 3 Oaths");
  expect(host.querySelector("[data-node='row-2'] [data-research-effect-short]")?.textContent).toBe("100 → 120/hr");
  expect(host.querySelector("[data-node='row-4'] [data-research-effect-short]")?.textContent).toBe("2 → 1.8 wheat");
  expect(host.querySelector("[data-node='well'] [data-research-effect-short]")?.textContent).toBe("+40% ⚡");
  expect(host.querySelector("[data-node='row-6'] .research-node__title--locked")).not.toBeNull();

  const scroll = host.querySelector<HTMLDivElement>(".research-tree-scroll")!;
  let scrollTop = 0;
  Object.defineProperties(scroll, {
    scrollHeight: { value: 700, configurable: true },
    clientHeight: { value: 320, configurable: true },
    scrollTop: { get: () => scrollTop, set: (v: number) => (scrollTop = v), configurable: true },
  });
  act(() => {
    scroll.dispatchEvent(new Event("scroll"));
  });
  expect(host.querySelector("[data-research-scroll-cue]")?.textContent).toContain("More");

  act(() => {
    scrollTop = 380;
    scroll.dispatchEvent(new Event("scroll"));
  });
  expect(host.querySelector("[data-research-scroll-cue]")).toBeNull();
});
