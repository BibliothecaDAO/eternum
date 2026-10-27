import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it } from "vitest";
import { beastReplay, capacity, DEPTHS, nextPrice } from "./balance-options";
import { ResearchBalanceLab } from "./research-balance-lab";

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
function open(part: string) {
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[`/?part=${part}`]}>
        <ResearchBalanceLab />
      </MemoryRouter>,
    ),
  );
}
function button(prefix: string) {
  const found = [...host.querySelectorAll("button")].find((node) => node.textContent?.startsWith(prefix));
  expect(found, prefix).toBeDefined();
  return found!;
}
function click(prefix: string) {
  act(() => button(prefix).click());
}

it("lets the player raise Drill to level 3 then open Rations at level 2 for its own first price", () => {
  open("tree");
  click("Add Drill");
  expect(button("Drill").textContent).toContain("level 3");
  expect(button("Rations").textContent).toContain("4,000 Essence + 3,000 labor");
  click("Rations");
  click("Add Rations");
  expect(button("Rations").textContent).toContain("level 2");
  expect(host.querySelector("[data-plan-cost]")?.textContent).toBe("Added cost: 20,000 Essence · 12,000 labor");
  expect(button("Add Rations").disabled).toBe(false);
});
it("separate levels let both sides reach 5", () => {
  open("tree");
  for (let i = 0; i < 3; i++) click("Add Drill");
  click("Rations");
  for (let i = 0; i < 4; i++) click("Add Rations");
  expect(button("Drill").textContent).toContain("level 5");
  expect(button("Rations").textContent).toContain("level 5");
  expect(button("Add Rations").disabled).toBe(true);
});
it("S2 keeps storage research and previews a real Granary upgrade", () => {
  open("storage");
  expect(button("Granary").textContent).toContain("18,000 wheat capacity → 27,000 wheat capacity");
  click("Granary");
  click("Add Granary");
  expect(button("Granary").textContent).toContain("27,000 wheat capacity → 36,000 wheat capacity");
  click("Reset plan");
  expect(button("Granary").textContent).toContain("level 1");
});
it("shows the measured beast replay and scales the selected guard reward by depth", () => {
  open("beasts");
  expect(host.textContent).toContain("2,807.25 extra labor");
  expect(host.textContent).toContain("75–87.5 labor");
  const select = host.querySelector<HTMLSelectElement>('select[aria-label="Depth"]')!;
  act(() => {
    select.value = "3";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(host.textContent).toContain("1,500–1,750 labor");
});
it("keeps the realm upgrade payable under the alternative storage curve", () => {
  expect([0, 1, 2, 3].map((level) => capacity(level, 0))).toEqual([6000, 18000, 40000, 80000]);
  [4000, 15000, 40000].forEach((price, level) => expect(capacity(level, 0)).toBeGreaterThanOrEqual(price));
  expect([0, 1, 2, 3].map((level) => capacity(level, 4))).toEqual([18000, 54000, 120000, 240000]);
});
it("preserves exact replay totals and independent-side prices through the last purchase", () => {
  expect(beastReplay()).toEqual({ total: 2807.25, median: 85.125 });
  expect(nextPrice(2, [4, 3], 1)).toEqual({ essence: 120000, labor: 60000 });
  expect(nextPrice(2, [4, 4], 1)).toBeUndefined();
  expect(nextPrice(2, [4, 0], 1)).toEqual({ essence: 4000, labor: 3000 });
  expect(DEPTHS.map((depth) => depth.strong.map((guard) => guard / 4))).toEqual([
    [112.5, 137.5],
    [337.5, 412.5],
    [900, 1100],
    [2250, 2750],
  ]);
});

it("shows paid training, the retained ladder and Common I", () => {
  open("tree");
  expect(host.textContent).toContain("grants Uncommon training immediately");
  expect(host.textContent).toContain("48,000 Essence + 9,000 labor");
  expect(host.textContent).toContain("Choose camps, rifts or beasts when building");
  const common = host.querySelector('.ui-tier[aria-label="Common"]')!;
  expect(common.textContent).toBe("I");
});
