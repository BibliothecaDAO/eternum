// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MID_REALM } from "./progression-fixture";
import { ResearchPanel } from "./research-panel";
import { readResearchTree, type TreeNode } from "./research-tree";

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
const draw = (picked: string, onResearch = vi.fn(), onPick = vi.fn(), onFix = vi.fn()) =>
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
  expect(host.textContent).toContain("Labor store 18,000 / 24,000 · a Kingdom holds it");
  expect(button(/^Research /)!.disabled).toBe(true);
  act(() => button(/Level up the castle/)!.click());
  expect(onFix).toHaveBeenCalledOnce();
});
