import { expect, it } from "vitest";
import { heldSkillPoints, lowestFittingPoint, nextSkillPoint, skillPointRefill } from "./skill-points";
import type { NativeRows } from "../client";
const rules: NativeRows["ArmyProgressionRules"] = {
  game_id: 1,
  reveal_xp: 2,
  fixed_xp: 200,
  common_xp: 100,
  uncommon_xp: 250,
  rare_xp: 500,
  epic_xp: 900,
  legendary_xp: 1500,
};
const army: NativeRows["ArmyProgress"] = {
  game_id: 1,
  explorer_id: 1n,
  xp: 1600,
  common_points: 2,
  uncommon_points: 0,
  rare_points: 1,
  epic_points: 0,
  legendary_points: 1,
  battle: 2,
  logistics: 0,
  scouting: 0,
  homecoming: 0,
  scouting_kinds: 0,
};
it.each([
  [0, 1, 100, 0],
  [99, 1, 100, 0],
  [100, 2, 250, 100],
  [250, 3, 500, 250],
  [500, 4, 900, 500],
  [900, 5, 1500, 900],
  [1500, 1, 1600, 1500],
  [1600, 2, 1750, 1600],
  [4500, 1, 4600, 4500],
])("shows the next point at lifetime XP %s", (xp, rank, at, from) => {
  expect(nextSkillPoint(xp, rules)).toEqual({ rank, at, from, share: (xp - from) / (at - from) });
});
it("uses the lowest fitting held point rather than the lifetime XP total", () => {
  expect(heldSkillPoints(army)).toEqual([2, 0, 1, 0, 1]);
  expect([1, 2, 3, 4, 5, 6].map((rank) => lowestFittingPoint(army, rank))).toEqual([1, 3, 3, 5, 5, undefined]);
  expect(lowestFittingPoint({ ...army, rare_points: 0, legendary_points: 0 }, 2)).toBeUndefined();
});
it("uses the spent point's rank for the refill and doubles it for Stamina", () => {
  expect(([1, 2, 3, 4, 5] as const).map((rank) => skillPointRefill(rank))).toEqual([20, 30, 40, 50, 60]);
  expect(([1, 2, 3, 4, 5] as const).map((rank) => skillPointRefill(rank, true))).toEqual([40, 60, 80, 100, 120]);
});
