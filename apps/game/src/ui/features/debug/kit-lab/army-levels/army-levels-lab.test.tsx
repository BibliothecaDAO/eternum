import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { ArmyLevelsLab } from "./army-levels-lab";
import { effect, levelProgress } from "./level-options";

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

it("lets three points buy the same attribute while today's 300 XP buys two tiers", () => {
  click("Upgrade today");
  click("Upgrade today");
  expect(button("Upgrade today").disabled).toBe(true);
  expect(host.querySelector('[aria-label="Today"]')?.textContent).toContain("Battle · 2 / 4+30% damage");
  for (let count = 0; count < 3; count++) click("Spend point");
  expect(proposal().textContent).toContain("Battle · 3 / 4+30% damage");
  expect(proposal().querySelector("[data-points]")?.textContent).toBe("0 points available");
  expect(proposal().querySelector("[data-progress]")?.textContent).toBe("0 / 200 XP to level 5");
  expect(button("Spend point").disabled).toBe(true);
});
it("keeps a trained capped attribute out of the choices without consuming earned points", () => {
  select("Starts trained", "battle-4");
  expect(proposal().textContent).toContain("Battle · 4 / 4+40% damage");
  expect(button("Spend point").disabled).toBe(true);
  expect(proposal().querySelector("[data-points]")?.textContent).toBe("3 points available");
  select("Build toward", "1");
  click("Spend point");
  expect(proposal().textContent).toContain("Logistics · 1 / 4+20 max stamina");
  expect(proposal().querySelector("[data-points]")?.textContent).toBe("2 points available");
});
it("allocates Scouting to the chosen site and shows its relative bonus", () => {
  select("Build toward", "2");
  select("Find more", "Rifts");
  click("Spend point");
  select("Find more", "Camps");
  click("Spend point");
  expect(proposal().textContent).toContain("Rifts +10% · Camps +10%");
});
it("switching options resets allocations and keeps today's stronger tier effects in option 2", () => {
  click("Spend point");
  click("2 · Growing bonuses");
  expect(proposal().querySelector("[data-points]")?.textContent).toBe("2 points available");
  click("Spend point");
  click("Spend point");
  expect(proposal().textContent).toContain("Battle · 2 / 4+30% damage");
  expect(proposal().querySelector("[data-progress]")?.textContent).toBe("0 / 300 XP to level 4");
});
it("a fully trained army cannot earn unusable points", () => {
  select("Starts trained", "all");
  expect(proposal().textContent).toContain("0 points availableAll remaining points earned");
  expect(button("Spend point").disabled).toBe(true);
});
it("crosses exact XP boundaries, carries overflow and stops at the remaining slot cap", () => {
  expect(levelProgress(49, [0, 0, 0, 0], "flat")).toEqual({ points: 0, level: 1, capped: false, into: 49, next: 50 });
  expect(levelProgress(50, [0, 0, 0, 0], "flat")).toEqual({ points: 1, level: 2, capped: false, into: 0, next: 100 });
  expect(levelProgress(860, [0, 0, 0, 0], "flat")).toEqual({
    points: 5,
    level: 6,
    capped: false,
    into: 110,
    next: 300,
  });
  expect(levelProgress(6800, [0, 0, 0, 0], "flat")).toEqual({ points: 16, level: 17, capped: true, into: 0, next: 0 });
  expect(levelProgress(6800, [4, 0, 0, 0], "flat").points).toBe(12);
  expect(effect(2, 4, "growing", ["Beasts", "Rifts", "Beasts", "Rifts"])).toBe("Beasts +40% · Rifts +60%");
});
