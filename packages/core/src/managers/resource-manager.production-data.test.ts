import { ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { ResourceManager } from "./resource-manager";

const RATE = 1_000_000n; // one unit per tick at resource precision

const productionInfo = (outputAmountLeft: bigint) => ({
  balance: 0n,
  production: { building_count: 2, production_rate: RATE, output_amount_left: outputAmountLeft, last_updated_at: 100 },
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
});
