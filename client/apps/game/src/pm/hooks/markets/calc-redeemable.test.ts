// @vitest-environment node
import type { TokenBalance } from "@dojoengine/torii-wasm";
import { describe, expect, it } from "vitest";

import type { MarketClass } from "@/pm/class";
import { computeRedeemableValue } from "@/pm/hooks/markets/calc-redeemable";

describe("computeRedeemableValue", () => {
  it("computes redeemable from explicit payout numerators when market condition resolution is missing", () => {
    const market = {
      isResolved: () => true,
      conditionResolution: undefined,
      vaultDenominator: { value: 545600000000000000000n },
      vaultNumerators: [{ index: 0, value: 117056000000000000000n }],
      collateralToken: { decimals: 18 },
    } as unknown as MarketClass;

    const balance = {
      balance: "99200000000000000000",
    } as unknown as TokenBalance;

    const result = computeRedeemableValue({
      market,
      positionIndex: 0,
      balance,
      payoutNumerators: [1n, 0n, 0n],
    });

    expect(result.valueRaw).toBe(462371200000000000000n);
    expect(result.valueFormatted).toBe("462.3712");
  });

  it("returns zero when neither market condition resolution nor explicit payout numerators are available", () => {
    const market = {
      isResolved: () => true,
      conditionResolution: undefined,
      vaultDenominator: { value: 545600000000000000000n },
      vaultNumerators: [{ index: 0, value: 117056000000000000000n }],
      collateralToken: { decimals: 18 },
    } as unknown as MarketClass;

    const balance = {
      balance: "99200000000000000000",
    } as unknown as TokenBalance;

    const result = computeRedeemableValue({
      market,
      positionIndex: 0,
      balance,
    });

    expect(result.valueRaw).toBe(0n);
    expect(result.valueFormatted).toBe("0");
  });
});
