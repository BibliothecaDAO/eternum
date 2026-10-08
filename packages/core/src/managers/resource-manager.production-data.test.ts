import { ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { ResourceManager } from "./resource-manager";

const RATE = 1_000_000n; // one unit per one-second tick at resource precision

const productionInfo = (outputAmountLeft: bigint) => ({
  balance: 0n,
  tickSeconds: 1,
  production: {
    building_count: 2,
    production_rate: RATE,
    output_amount_left: outputAmountLeft,
    last_settled_tick: 100,
  },
});

describe("ResourceManager.calculateResourceProductionData", () => {
  it("reports no time remaining for continuous production, however little output is banked", () => {
    const data = ResourceManager.calculateResourceProductionData(ResourcesIds.Wheat, productionInfo(RATE), 100);
    expect(data.isProducing).toBe(true);
    expect(data.timeRemainingSeconds).toBe(Number.POSITIVE_INFINITY);
  });

  it("keeps the banked-output countdown for input-fed production", () => {
    const data = ResourceManager.calculateResourceProductionData(ResourcesIds.Wood, productionInfo(RATE * 60n), 100);
    expect(data.isProducing).toBe(true);
    expect(data.timeRemainingSeconds).toBe(60);
  });

  it("reads the u128::MAX output budget as unlimited, never as an amount or a duration", () => {
    const unlimited = (1n << 128n) - 1n;
    // A marker settlements wore down before the contract stopped wearing it reads as unlimited too, as it does there.
    for (const budget of [unlimited, unlimited - 1_000_000n, unlimited - (1n << 64n)]) {
      const data = ResourceManager.calculateResourceProductionData(ResourcesIds.Knight, productionInfo(budget), 5_000);
      expect(data.isProducing).toBe(true);
      expect(data.outputRemaining).toBe(Number.POSITIVE_INFINITY);
      expect(data.timeRemainingSeconds).toBe(Number.POSITIVE_INFINITY);
    }
    const limited = ResourceManager.calculateResourceProductionData(
      ResourcesIds.Knight,
      productionInfo(unlimited - (1n << 64n) - 1n),
      5_000,
    );
    expect(limited.outputRemaining).toBeLessThan(Number.POSITIVE_INFINITY);
  });

  it("counts the time left in whole ticks, to the boundary that pays the last of it", () => {
    const info = { ...productionInfo(RATE * 120n * 3n), tickSeconds: 120 };
    info.production = { ...info.production, last_settled_tick: 1 };
    // At 250 one tick has ended since tick 1; two more pay the rest, at the boundary of 480.
    const data = ResourceManager.calculateResourceProductionData(ResourcesIds.Wood, info, 250);
    expect(data.timeRemainingSeconds).toBe(480 - 250);
  });
});
