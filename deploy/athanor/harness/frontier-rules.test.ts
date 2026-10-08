import { describe, expect, it } from "bun:test";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { buildNativePreset } from "../../../config/deployer/clean/config/native-preset";
import { loadNativePresetConfiguration } from "../../../config/deployer/clean/registrar/native-preset";
import {
  expectedWheat,
  frontierRuleChecks,
  presetRates,
  wheatCharged,
  type FrontierRuleEvidence,
} from "./frontier-rules";

const precision = BigInt(RESOURCE_PRECISION);
const frontier = buildNativePreset(loadNativePresetConfiguration("madara.frontier", 5), 5);

describe("Frontier rules at real speed", () => {
  it("prices raising troops at 2 wheat each and food per troop for each explore and step, from preset 5", () => {
    const troops = { troopResource: ResourcesIds.Knight, troops: 450n };
    expect(expectedWheat(frontier, { kind: "CreateExplorer", ...troops })).toBe(900n * precision);
    // 0.02 wheat per troop for an explore and for each hex travelled (rule 3.2).
    expect(expectedWheat(frontier, { kind: "Explore", ...troops })).toBe(9n * precision);
    expect(expectedWheat(frontier, { kind: "Move", ...troops })).toBe(9n * precision);
  });

  it("reads what an action took from the realm's balance and the farms' output up to the block that settled it", () => {
    const farm = { building_count: 1, production_rate: 84_000_000n, output_amount_left: 0n, last_settled_tick: 50 };
    const before = { balance: 1_000n * precision, production: farm, tickSeconds: 20 };
    const after = {
      balance: 1_000n * precision + 60n * 84_000_000n - 900n * precision,
      production: { ...farm, last_settled_tick: 53 },
      tickSeconds: 20,
    };
    expect(wheatCharged(before, after)).toBe(900n * precision);
    // An action that did not settle the realm's wheat says nothing about what it cost.
    expect(wheatCharged(before, { ...before })).toBeNull();
    // Spending within the same tick still has a charge, with no intervening production.
    expect(wheatCharged(before, { ...before, balance: before.balance - 900n * precision })).toBe(900n * precision);
  });

  it("compares each producing building's rate on chain with preset 5's", () => {
    const rows = [
      { resource_type: ResourcesIds.Wheat, building_count: 2, production_rate: 2n * 84_000_000n },
      { resource_type: ResourcesIds.Labor, building_count: 1, production_rate: 28_000_000n },
    ];
    expect(presetRates(frontier, rows)).toEqual([
      { resource: ResourcesIds.Wheat, buildingCount: 2, chainRate: "168000000", presetRate: "84000000" },
      { resource: ResourcesIds.Labor, buildingCount: 1, chainRate: "28000000", presetRate: "28000000" },
    ]);
  });

  it("passes only on observed charges equal to the preset's, preset rates on chain and no gameplay rejection", () => {
    const evidence: FrontierRuleEvidence = {
      rates: [{ resource: ResourcesIds.Wheat, buildingCount: 1, chainRate: "84000000", presetRate: "84000000" }],
      charges: [
        { botId: 0, kind: "CreateExplorer", troops: "450", expected: "900000000000", charged: "900000000000" },
        { botId: 0, kind: "Explore", troops: "450", expected: "9000000000", charged: "9000000000" },
      ],
    };
    const completed = [{ outcome: "completed" as const }];
    expect(frontierRuleChecks(evidence, completed)).toEqual({
      frontierPresetRates: true,
      frontierTroopRaiseCharge: true,
      frontierFoodCharge: true,
      frontierNoGameplayRejection: true,
    });
    const overcharged = { ...evidence, charges: [{ ...evidence.charges[0]!, charged: "900000000001" }] };
    expect(frontierRuleChecks(overcharged, completed)).toMatchObject({
      frontierTroopRaiseCharge: false,
      frontierFoodCharge: false,
    });
    const rejected = [...completed, { outcome: "rejected" as const }];
    expect(frontierRuleChecks(evidence, rejected).frontierNoGameplayRejection).toBe(false);
    const slower = { ...evidence, rates: [{ ...evidence.rates[0]!, chainRate: "83999999" }] };
    expect(frontierRuleChecks(slower, completed).frontierPresetRates).toBe(false);
  });
});
