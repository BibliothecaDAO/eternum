import { describe, expect, it } from "vitest";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { explorerTransferPlan, progressionValue } from "./army-merge";

const rules: NativeRows["ArmyProgressionRules"] = {
  game_id: 1,
  reveal_xp: 2,
  fixed_xp: 200,
  uncommon_xp: 100,
  rare_xp: 200,
  epic_xp: 400,
  legendary_xp: 800,
};
const common: NativeRows["ArmyProgress"] = {
  game_id: 1,
  explorer_id: 1n,
  xp: 0,
  battle: 1,
  logistics: 1,
  scouting: 1,
  homecoming: 1,
  scouting_kinds: 0,
};
const base = {
  sourceCount: 3,
  targetCount: 3,
  sourceCap: 10,
  targetCap: 10,
  sourceProgress: common,
  targetProgress: common,
  rules,
  requiresProgress: true,
};

describe("army merge choice", () => {
  it("counts all four cumulative tier prices and unspent XP, including trained tiers", () => {
    expect(progressionValue({ ...common, xp: 7, battle: 2, logistics: 3, scouting: 4, homecoming: 5 }, rules)).toBe(
      2607,
    );
    expect(
      progressionValue({ ...common, xp: 0xffffffff, battle: 5, logistics: 5, scouting: 5, homecoming: 5 }, rules),
    ).toBe(4294973295);
  });
  it("keeps the target on ties and the source when its spent or trained tiers outweigh the target", () => {
    expect(explorerTransferPlan(base).sourceWins).toBe(false);
    expect(
      explorerTransferPlan({
        ...base,
        sourceProgress: { ...common, homecoming: 2 },
        targetProgress: { ...common, xp: 99 },
      }).sourceWins,
    ).toBe(true);
  });
  it("allows a full merge under the winner's cap even when partial transfers would overflow the target", () => {
    expect(explorerTransferPlan({ ...base, targetCap: 3, sourceProgress: { ...common, xp: 1 } })).toMatchObject({
      maxAmount: 3,
      partialMax: 0,
      fullFits: true,
      survivorCap: 10,
    });
  });
  it("refuses an over-cap full merge while still allowing partial transfers into the target", () => {
    expect(explorerTransferPlan({ ...base, sourceCap: 5, sourceProgress: { ...common, xp: 1 } })).toMatchObject({
      maxAmount: 2,
      partialMax: 2,
      fullFits: false,
      survivorCap: 5,
    });
  });
  it("waits for Frontier progress and keeps target semantics in games without progress", () => {
    expect(explorerTransferPlan({ ...base, targetProgress: undefined })).toMatchObject({ known: false, maxAmount: 0 });
    expect(
      explorerTransferPlan({
        ...base,
        targetProgress: undefined,
        sourceProgress: undefined,
        rules: undefined,
        requiresProgress: false,
      }),
    ).toMatchObject({ known: true, sourceWins: false, maxAmount: 3 });
  });
});
