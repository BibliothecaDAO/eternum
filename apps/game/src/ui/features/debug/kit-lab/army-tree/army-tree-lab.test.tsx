import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ArmyTreeLab } from "./army-tree-lab";
import { bonus, earnedPoints, gain, OPTIONS, SCENES, stillPath } from "./options";

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
  act(() => [...host.querySelectorAll("button")].find((node) => node.textContent?.startsWith(name))!.click());

it("compares each option and moment using exactly two stills, without live content", () => {
  for (const option of OPTIONS) {
    click(option.title);
    expect(host.querySelector('[aria-label="Selected proposal"]')?.textContent).toContain(option.summary);
    for (const scene of SCENES) {
      click(scene);
      expect([...host.querySelectorAll("figure img")].map((img) => img.getAttribute("src"))).toEqual([
        stillPath("today", scene),
        stillPath(option.id, scene),
      ]);
      expect(host.querySelectorAll("canvas,iframe,[data-tree-capture]")).toHaveLength(0);
    }
  }
});
it("shows no Common gem and I through IV for the four upgrades", () => {
  const legend = host.querySelector('[aria-label="One rank language"]')!;
  expect([...legend.querySelectorAll(".tree-gem")].map((gem) => gem.textContent)).toEqual(["I", "II", "III", "IV"]);
  expect(legend.textContent).toContain("Common has no gem");
});
it("preserves the exact point curve, trained cap and diminishing third-rank gain", () => {
  expect([49, 50, 149, 150, 299, 300].map((xp) => earnedPoints(xp, 0))).toEqual([0, 1, 1, 2, 2, 3]);
  expect(earnedPoints(10000, 16)).toBe(0);
  expect(earnedPoints(10000, 2)).toBe(14);
  expect([gain(0, 0), gain(0, 2), bonus(0, 2), bonus(0, 3)]).toEqual([10, 6, 18, 24]);
  expect([gain(1, 0), gain(1, 2), bonus(1, 4)]).toEqual([20, 12, 56]);
  expect(bonus(0, 4, true)).toBe(100);
});
it("shows distinct and folded troop identities across tokens, plates and transfer targets", () => {
  for (const option of ["today", "a", "b", "c"] as const) {
    window.history.replaceState({}, "", `/lab/kit/army-tree?capture=Troops&option=${option}`);
    act(() => root.render(<ArmyTreeLab />));
    expect([...host.querySelectorAll("h2")].map((node) => node.textContent)).toEqual([
      "Map tokens",
      "Army plate",
      "Army attribute · Frontier",
      "Transfer troops",
    ]);
    const rows = [...host.querySelectorAll(".tree-transfer-row")];
    expect(rows.map((node) => node.lastElementChild?.textContent)).toEqual([
      "Different troop class",
      "Can reinforce",
      "Different troop class",
    ]);
    if (option === "c") {
      expect(rows.map((node) => node.querySelector(".tree-troop-name")?.textContent?.trim())).toEqual([
        "Common Knights",
        "Uncommon Knights I",
        "Rare Knights II",
      ]);
      expect(rows[0]!.querySelector(".tree-gem")).toBeNull();
    } else {
      expect(
        rows.map((node) => node.querySelector(option === "today" ? ".ui-chip" : ".tree-troop-chip")?.textContent),
      ).toEqual(["T1", "T2", "T3"]);
    }
  }
});
it("has every still on disk in the dev-only artwork directory", () => {
  for (const option of ["today", "a", "b", "c"] as const)
    for (const scene of SCENES)
      expect(existsSync(resolve(process.cwd(), "asset-sources", stillPath(option, scene).slice(1)))).toBe(true);
});
