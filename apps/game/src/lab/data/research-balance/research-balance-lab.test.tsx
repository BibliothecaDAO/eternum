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
it("separate levels let both sides reach 5; four shared picks still close the unfinished side", () => {
  open("tree");
  for (let i = 0; i < 3; i++) click("Add Drill");
  click("Rations");
  for (let i = 0; i < 4; i++) click("Add Rations");
  expect(button("Drill").textContent).toContain("level 5");
  expect(button("Rations").textContent).toContain("level 5");
  expect(button("Add Rations").disabled).toBe(true);
  click("T2");
  for (let i = 0; i < 3; i++) click("Add Drill");
  click("Rations");
  expect(button("Rations").textContent).toContain("Four-pick limit reached");
  expect(button("Add Rations").disabled).toBe(true);
});
it("today’s rule charges the next shared tier even when switching; changing the proposal resets the plan", () => {
  open("tree");
  click("T3");
  expect(button("Rations").textContent).toContain("16,000 Essence + 9,000 labor");
  click("Rations");
  click("Add Rations");
  expect(host.querySelector("[data-plan-cost]")?.textContent).toContain("16,000 Essence · 9,000 labor");
  click("T1");
  expect(host.querySelector("[data-plan-cost]")?.textContent).toContain("0 Essence · 0 labor");
});
it("cut storage removes its choice, while the capacity option previews a real Granary upgrade", () => {
  open("storage");
  expect([...host.querySelectorAll("button")].some((node) => node.textContent?.startsWith("Granary"))).toBe(false);
  click("S2");
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
  click("B3");
  expect(host.textContent).toContain("5,614.5 extra labor");
  expect(host.textContent).toContain("3,000–3,500 labor");
});
it("keeps the realm upgrade payable under the alternative storage curve", () => {
  expect([0, 1, 2, 3].map((level) => capacity(level, 0, "capacity"))).toEqual([6000, 18000, 40000, 80000]);
  [4000, 15000, 40000].forEach((price, level) => expect(capacity(level, 0, "capacity")).toBeGreaterThanOrEqual(price));
  expect([0, 1, 2, 3].map((level) => capacity(level, 4, "cut"))).toEqual([6000, 18000, 50000, 120000]);
});
it("preserves exact replay totals and independent-side prices through the last purchase", () => {
  expect([8, 4, 2].map((divisor) => beastReplay(divisor))).toEqual([
    { total: 1403.625, median: 42.5625 },
    { total: 2807.25, median: 85.125 },
    { total: 5614.5, median: 170.25 },
  ]);
  expect(nextPrice(2, [4, 3], 1, "independent")).toEqual({ essence: 120000, labor: 60000 });
  expect(nextPrice(2, [4, 4], 1, "independent")).toBeUndefined();
  expect(nextPrice(2, [3, 1], 1, "budget")).toBeUndefined();
  expect(DEPTHS.map((depth) => depth.strong.map((guard) => guard / 4))).toEqual([
    [112.5, 137.5],
    [337.5, 412.5],
    [900, 1100],
    [2250, 2750],
  ]);
});
