import { describe, expect, it } from "vitest";
import { resolveGameTransactionResourceBounds } from "./transaction-resource-bounds";

describe("resolveGameTransactionResourceBounds", () => {
  it("uses fixed zero-price execution bounds on the fee-free Madara lab", () => {
    expect(resolveGameTransactionResourceBounds("madara")).toEqual({
      l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
      l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
      l2_gas: { max_amount: 1_200_000_000n, max_price_per_unit: 0n },
    });
  });

  it("leaves appchain transactions on fee estimation", () => {
    expect(resolveGameTransactionResourceBounds("appchain")).toBeUndefined();
  });
});
