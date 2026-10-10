import { describe, expect, it } from "vitest";
import { playResourceBounds } from "./transaction-resource-bounds";

describe("playResourceBounds", () => {
  it("spends only l2 gas, up to the shard's own bound, at zero price on the fee-free shard", () => {
    expect(playResourceBounds(900_000_000n)).toEqual({
      l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
      l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
      l2_gas: { max_amount: 900_000_000n, max_price_per_unit: 0n },
    });
  });
});
