// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MID_REALM } from "@/ui/features/frontier/research/progression-fixture";
import { readResearchTree } from "@/ui/features/frontier/research/research-tree";

import { LauncherBar } from "./launcher-options";
import { type ResearchOption, ResearchOptionPanel } from "./research-options";

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
const keyOf = (name: string) => nodes.find((node) => node.name === name)!.key;
const draw = (option: ResearchOption) =>
  act(() =>
    root.render(
      <ResearchOptionPanel option={option} nodes={nodes} essence={MID_REALM.essence} labor={MID_REALM.labor} />,
    ),
  );
const tap = (element: Element | null) => act(() => (element as HTMLElement).click());
const tile = (name: string) => host.querySelector(`button[data-node="${keyOf(name)}"]`);
const choiceCards = () => [...host.querySelectorAll('[data-lab="choice-card"]')];
const buttonWords = (within: Element) => [...within.querySelectorAll("button")].map((button) => button.textContent);

describe("A · choice first", () => {
  it("shows the choice and its Research before the tree, and a tap on another building swaps it in place", () => {
    draw("choice-first");
    const [card] = choiceCards();
    expect(card.textContent).toContain("Farm");
    expect(buttonWords(card)).toContain("Research Fields");
    // The choice stands before every tile: nothing to scroll past to reach it.
    expect(card.compareDocumentPosition(tile("Farm")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    tap(tile("Workshop"));
    expect(choiceCards()).toHaveLength(1);
    expect(choiceCards()[0].textContent).toContain("Workshop");
    expect(buttonWords(choiceCards()[0])).toContain("Research Tools");
  });
});

describe("B · cards", () => {
  it("makes each open building's sides its research buttons, and folds done and locked rows into a line each", () => {
    draw("cards");
    const farm = host.querySelector(`[data-node="${keyOf("Farm")}"]`)!;
    expect([...farm.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"))).toEqual([
      "Research Fields",
      "Research Granary",
    ]);
    const done = nodes.filter(({ state }) => state === "done");
    const locked = nodes.filter(({ state }) => state === "locked");
    expect(done.length).toBeGreaterThan(0);
    expect(locked.length).toBeGreaterThan(0);
    // A done or locked building has no row of its own: its name stands in its branch's folded line.
    for (const node of [...done, ...locked]) expect(host.querySelector(`[data-node="${node.key}"]`)).toBeNull();
    expect(host.textContent).toContain(`Researched · ${done.map(({ name }) => name).join(", ")}`);
  });
});

describe("C · choice over the tree", () => {
  it("opens on the first building to research, closes with its X, and opens again on a tap", () => {
    draw("overlay");
    expect(choiceCards()[0].textContent).toContain("Farm");
    tap(host.querySelector('[aria-label="Close"]'));
    expect(choiceCards()).toHaveLength(0);
    tap(tile("Hut"));
    expect(choiceCards()[0].textContent).toContain("Hut");
  });
});

describe("D · one labelled bar", () => {
  it("keeps Research and the Season, and drops the Feed the rail's own back already gives", () => {
    act(() => root.render(<LauncherBar researchReady />));
    expect(buttonWords(host)).toEqual(["Research", "Season"]);
  });
});
