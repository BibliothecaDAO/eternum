import { describe, expect, it } from "vitest";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { explorerTransferPlan } from "./army-merge";

const common: NativeRows["ArmyProgress"] = {
  game_id: 1,
  explorer_id: 1n,
  logistics: 1,
  oath_slots: 1,
  oaths: 0,
  oath_pick: 0,
};
const base = {
  sourceCount: 3,
  targetCount: 3,
  targetCap: 10,
  sourceProgress: common,
  targetProgress: common,
};

describe("army merge choice", () => {
  it.each([
    [0, 0, false],
    [0, 5, false],
    [1, 0, true],
    [5, 1, true],
    [5, 5, false],
  ])("confirms the loss of Logistics %s into %s", (source, target, confirmLoss) => {
    expect(
      explorerTransferPlan({
        ...base,
        sourceProgress: { ...common, logistics: source },
        targetProgress: { ...common, logistics: target },
      }),
    ).toEqual({ known: true, confirmLoss, fullFits: true, partialMax: 2 });
  });
  it("refuses a full merge that exceeds the target cap even when the source has more progression", () => {
    expect(explorerTransferPlan({ ...base, targetCap: 3, sourceProgress: { ...common, logistics: 5 } })).toMatchObject({
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

it("warns before a larger Oath capacity is lost with the source army", () => {
  expect(
    explorerTransferPlan({
      sourceCount: 100,
      targetCount: 100,
      targetCap: 500,
      sourceProgress: { ...common, oath_slots: 4 },
      targetProgress: { ...common, oath_slots: 1 },
    }).confirmLoss,
  ).toBe(true);
});

it("warns when a merge discards held Oaths", () => {
  expect(explorerTransferPlan({ ...base, sourceProgress: { ...common, oaths: 1 } }).confirmLoss).toBe(true);
  expect(
    explorerTransferPlan({ ...base, sourceProgress: { ...common, oaths: 1 }, targetProgress: { ...common, oaths: 1 } })
      .confirmLoss,
  ).toBe(true);
});
