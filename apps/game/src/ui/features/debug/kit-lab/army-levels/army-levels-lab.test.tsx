import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { ArmyLevelsLab } from "./army-levels-lab";
import { effect, gain, levelProgress } from "./level-options";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<ArmyLevelsLab />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const button = (name: string) => [...host.querySelectorAll("button")].find((node) => node.textContent === name)!;
const click = (name: string) => act(() => button(name).click());
const proposal = () => host.querySelector('[aria-label="Proposal"]')!;
function select(label: string, value: string) {
  const node = host.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;
  act(() => {
    node.value = value;
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

it("compares today's purchases, the previous flat gains and the revised gains together", () => {
  click("Upgrade today");
  click("Upgrade today");
  expect(button("Upgrade today").disabled).toBe(true);
  expect(host.querySelector('[aria-label="Today"]')?.textContent).toContain("Battle · 2 / 4+30% damage");
  for (let count = 0; count < 3; count++) {
    click("Spend flat point");
    click("Spend point");
  }
  expect(host.querySelector('[aria-label="Previous proposal"]')?.textContent).toContain("Battle · 3 / 4+30% damage");
  expect(proposal().textContent).toContain("Battle · 3 / 4+24% damage");
  expect(proposal().querySelector("[data-points]")?.textContent).toBe("0 points available");
  expect(proposal().querySelector("[data-progress]")?.textContent).toBe("0 / 200 XP to level 5");
  expect(button("Spend point").disabled).toBe(true);
});
it("charges one point but gives a trained third Battle rank less than an untrained first rank", () => {
  select("Starts trained", "battle-2");
  expect(proposal().textContent).toContain("Battle · 2 / 4+18% damage");
  expect(proposal().querySelector("[data-next]")?.textContent).toBe("Next gain: +6% damage · 1 point");
  expect(host.querySelector('[aria-label="Previous proposal"] [data-next]')?.textContent).toBe(
    "Next gain: +10% damage · 1 point",
  );
  expect(button("Spend point").disabled).toBe(false);
  expect(button("Upgrade today").disabled).toBe(true);
  click("Spend point");
  expect(proposal().textContent).toContain("Battle · 3 / 4+24% damage");
  expect(proposal().querySelector("[data-points]")?.textContent).toBe("2 points available");
  select("Starts trained", "none");
  expect(proposal().querySelector("[data-next]")?.textContent).toBe("Next gain: +10% damage · 1 point");
});
it("leaves another attribute available when the trained attribute is capped", () => {
  select("Starts trained", "battle-4");
  expect(proposal().textContent).toContain("Battle · 4 / 4+28% damage");
  expect(button("Spend point").disabled).toBe(true);
  expect(proposal().querySelector("[data-points]")?.textContent).toBe("3 points available");
  select("Build toward", "1");
  click("Spend point");
  expect(proposal().textContent).toContain("Logistics · 1 / 4+20 max stamina");
  expect(proposal().querySelector("[data-points]")?.textContent).toBe("2 points available");
});
it("uses total Scouting rank so switching kinds does not reset the diminishing gain", () => {
  select("Build toward", "2");
  select("Find more", "Rifts");
  click("Spend point");
  select("Find more", "Camps");
  click("Spend point");
  expect(proposal().textContent).toContain("Rifts +10% · Camps +8%");
  select("Starts trained", "scouting-2");
  select("Build toward", "2");
  select("Find more", "Rifts");
  click("Spend point");
  expect(proposal().textContent).toContain("Beasts +18% · Rifts +6%");
});
it("a fully trained army cannot earn unusable points", () => {
  select("Starts trained", "all");
  expect(proposal().textContent).toContain("0 points availableAll remaining points earned");
  expect(button("Spend point").disabled).toBe(true);
});
it("crosses exact XP boundaries, carries overflow and stops at the remaining slot cap", () => {
  expect(levelProgress(49, [0, 0, 0, 0])).toEqual({ points: 0, level: 1, capped: false, into: 49, next: 50 });
  expect(levelProgress(50, [0, 0, 0, 0])).toEqual({ points: 1, level: 2, capped: false, into: 0, next: 100 });
  expect(levelProgress(860, [0, 0, 0, 0])).toEqual({ points: 5, level: 6, capped: false, into: 110, next: 300 });
  expect(levelProgress(6800, [0, 0, 0, 0])).toEqual({ points: 16, level: 17, capped: true, into: 0, next: 0 });
  expect(levelProgress(6800, [4, 0, 0, 0]).points).toBe(12);
});
it("keeps each trained and earned rank on the same decreasing value ladder", () => {
  expect([0, 1, 2, 3].map((rank) => gain(0, rank, "diminishing"))).toEqual([
    "+10% damage",
    "+8% damage",
    "+6% damage",
    "+4% damage",
  ]);
  expect([1, 2, 3, 4].map((rank) => effect(1, rank, "diminishing", []))).toEqual([
    "+20 max stamina",
    "+36 max stamina",
    "+48 max stamina",
    "+56 max stamina",
  ]);
  expect([1, 2, 3, 4].map((rank) => effect(3, rank, "diminishing", []))).toEqual([
    "3% return home",
    "5.4% return home",
    "7.2% return home",
    "8.4% return home",
  ]);
  expect(gain(3, 2, "diminishing")).toBe("+1.8% of survivors returned");
  expect(effect(2, 4, "today", ["Beasts", "Rifts", "Beasts", "Rifts"])).toBe("Beasts +40% · Rifts +60%");
});
