import { describe, expect, it } from "vitest";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { explorerTransferPlan } from "./army-merge";

const rules: NativeRows["ArmyProgressionRules"] = {
  common_xp: 100,
  game_id: 1,
  reveal_xp: 2,
  fixed_xp: 200,
  uncommon_xp: 250,
  rare_xp: 500,
  epic_xp: 900,
  legendary_xp: 1500,
};
const common: NativeRows["ArmyProgress"] = {
  common_points: 0,
  uncommon_points: 0,
  rare_points: 0,
  epic_points: 0,
  legendary_points: 0,
  game_id: 1,
  explorer_id: 1n,
  xp: 0,
  battle: 1,
  logistics: 1,
  scouting: 0,
  homecoming: 1,
  scouting_kinds: 0,
};
const base = {
  sourceCount: 3,
  targetCount: 3,
  targetCap: 10,
  sourceProgress: common,
  targetProgress: common,
  rules,
};

describe("army merge choice", () => {
  it("warns when destroying a source would lose held points, even with equal XP and ranks", () => {
    expect(explorerTransferPlan({ ...base, sourceProgress: { ...common, rare_points: 1 } }).confirmLoss).toBe(true);
    expect(explorerTransferPlan({ ...base, targetProgress: { ...common, rare_points: 1 } }).confirmLoss).toBe(false);
  });
  it.each([
    [0, 0, false],
    [0, 99, false],
    [0, 100, false],
    [99, 0, false],
    [100, 0, true],
    [199, 100, false],
    [200, 100, true],
  ])("confirms a first-tier gap: %s versus %s", (sourceXp, targetXp, confirmLoss) => {
    expect(
      explorerTransferPlan({
        ...base,
        sourceProgress: { ...common, xp: sourceXp },
        targetProgress: { ...common, xp: targetXp },
      }),
    ).toMatchObject({ known: true, confirmLoss, sourceValue: sourceXp, targetValue: targetXp });
  });
  it("counts spent tiers in the confirmation gap and follows the game's first-tier price", () => {
    expect(explorerTransferPlan({ ...base, sourceProgress: { ...common, homecoming: 2 } }).confirmLoss).toBe(true);
    expect(
      explorerTransferPlan({ ...base, sourceProgress: { ...common, xp: 100 }, rules: { ...rules, common_xp: 200 } })
        .confirmLoss,
    ).toBe(false);
  });
  it("refuses a full merge that exceeds the target cap even when the source has more progression", () => {
    expect(explorerTransferPlan({ ...base, targetCap: 3, sourceProgress: { ...common, xp: 500 } })).toMatchObject({
      partialMax: 0,
      fullFits: false,
    });
    expect(explorerTransferPlan({ ...base, targetCap: 5 })).toMatchObject({ partialMax: 2, fullFits: false });
    expect(explorerTransferPlan(base)).toMatchObject({ partialMax: 2, fullFits: true });
  });
  it("waits for both armies' progress", () => {
    expect(explorerTransferPlan({ ...base, targetProgress: undefined })).toMatchObject({
      known: false,
      fullFits: false,
      confirmLoss: false,
    });
  });
});
