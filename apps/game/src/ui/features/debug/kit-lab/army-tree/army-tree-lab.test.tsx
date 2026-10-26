import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ArmyTreeLab } from "./army-tree-lab";
import {
  BRANCHES,
  ROUTES,
  budget,
  economyEffect,
  price,
  ranks,
  steps,
  stillPath,
  trainingEffect,
  type Building,
} from "./options";
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState({}, "", "/lab/kit/army-tree");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<ArmyTreeLab />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const click = (name: string) =>
  act(() => [...host.querySelectorAll("button")].find((node) => node.textContent === name)!.click());
it("opens every research branch in both routes using responsive stills only", () => {
  for (const route of ROUTES) {
    click(route.title);
    for (const branch of BRANCHES) {
      click(branch);
      expect(host.querySelectorAll("figure img")).toHaveLength(1);
      expect(host.querySelector("figure img")?.getAttribute("src")).toBe(stillPath(route.id, branch));
      expect(host.querySelector("source")?.getAttribute("srcset")).toBe(stillPath(route.id, branch, "phone"));
      expect(host.querySelectorAll("canvas,iframe,[data-tree-capture]")).toHaveLength(0);
    }
  }
});
it("shows all trained states including Common and a construction grant before research", () => {
  for (const route of ROUTES) {
    window.history.replaceState({}, "", `/lab/kit/army-tree?capture=Training&route=${route.id}`);
    act(() => root.render(<ArmyTreeLab />));
    expect(host.querySelectorAll(".tree-ladder")).toHaveLength(4);
    for (const ladder of host.querySelectorAll(".tree-ladder")) {
      expect(ladder.querySelectorAll(".tree-rung")).toHaveLength(route.id === "display" ? 5 : 6);
      expect([...ladder.querySelectorAll(".tree-gem")].map((gem) => gem.textContent)).toEqual([
        "I",
        "II",
        "III",
        "IV",
        "V",
      ]);
      expect(ladder.querySelector(".tree-rung")!.textContent).toContain("Common");
      expect(ladder.querySelector(".tree-rung")!.querySelectorAll(".tree-gem")).toHaveLength(
        route.id === "display" ? 1 : 0,
      );
      expect(ladder.querySelectorAll(".tree-rung")[1]!.textContent).toContain("Build · 3k labor");
    }
  }
});
it("preserves each full budget while splitting the final payment and effects", () => {
  const expected = {
    farm: [47000, 32000],
    workshop: [94000, 64000],
    barracks: [188000, 96000],
    hut: [23500, 16000],
    training: [552000, 96000],
  };
  for (const route of ROUTES)
    for (const building of Object.keys(expected) as Building[])
      expect(Object.values(budget(building, route.id))).toEqual(expected[building]);
  expect([4, 5].map((rank) => price("training", rank, "insert"))).toEqual([
    { essence: 144000, labor: 24000, action: "Research" },
    { essence: 216000, labor: 36000, action: "Research" },
  ]);
  expect(steps("insert").map((step) => economyEffect("rations", step))).toEqual([
    "2 wheat / troop",
    "1.75 wheat / troop",
    "1.5 wheat / troop",
    "1.25 wheat / troop",
    "1.125 wheat / troop",
    "1 wheat / troop",
  ]);
  expect(trainingEffect(0, 4, "insert")).toBe("+80% damage");
  expect(trainingEffect(1, 4, "insert")).toBe("+120 max stamina");
  expect(trainingEffect(3, 4, "insert")).toBe("24% survivors return");
  for (let i = 0; i < 4; i++) expect(trainingEffect(i, 5, "insert")).toBe(trainingEffect(i, 4, "display"));
});
it("keeps castle purchases as actual unlocks without invented rarity rungs", () => {
  window.history.replaceState({}, "", "/lab/kit/army-tree?capture=Castle&route=insert");
  act(() => root.render(<ArmyTreeLab />));
  expect(host.querySelectorAll(".tree-rung,.tree-gem")).toHaveLength(0);
  for (const phrase of ["2,000 E", "6,000 E", "100,000 E", "250,000 E", "500,000 E", "850,000 E", "36k labor"])
    expect(host.textContent).toContain(phrase);
  expect(ranks("insert")).toEqual(["Common", "Uncommon", "Rare", "Epic", "Exalted", "Legendary"]);
});
it("has every desktop and phone still in the dev-only artwork directory", () => {
  for (const route of ROUTES)
    for (const branch of BRANCHES)
      for (const device of ["desktop", "phone"] as const)
        expect(existsSync(resolve(process.cwd(), "asset-sources", stillPath(route.id, branch, device).slice(1)))).toBe(
          true,
        );
});
