import { expect, it } from "vitest";
import { playerColorManager } from "./player-colors";

it("keeps self green and allies blue for every address", () => {
  expect(playerColorManager.getProfileForUnit(true, false, false, 1n).primary.getHexString()).toBe("4ade80");
  expect(playerColorManager.getProfileForUnit(false, true, false, 2n).primary.getHexString()).toBe("60a5fa");
});

it("gives each enemy address its own stable hue so rivals stay distinguishable on the map", () => {
  const first = playerColorManager.getProfileForUnit(false, false, false, 3n);
  const second = playerColorManager.getProfileForUnit(false, false, false, 4n);
  expect(first.primary.equals(second.primary)).toBe(false);
  expect(playerColorManager.getProfileForUnit(false, false, false, 3n)).toBe(first);
  expect(playerColorManager.getProfileForUnit(false, false, false, "3")).toBe(first);
});

it("moves a captured address onto the relation colour instead of its old enemy hue", () => {
  const enemy = playerColorManager.getProfileForUnit(false, false, false, 5n);
  const captured = playerColorManager.getProfileForUnit(true, false, false, 5n);
  expect(captured.primary.equals(enemy.primary)).toBe(false);
});
