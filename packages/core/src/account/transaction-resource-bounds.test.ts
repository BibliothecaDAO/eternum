import { expect, it } from "vitest";
import { resolveGameTransactionResourceBounds } from "./transaction-resource-bounds";
it("uses the shard's exact published gas bound and zero prices for every resource", () => {
  expect(resolveGameTransactionResourceBounds(9000000n)).toEqual({
    l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l2_gas: { max_amount: 9000000n, max_price_per_unit: 0n },
  });
  expect(() => resolveGameTransactionResourceBounds(0n)).toThrow();
  expect(() => resolveGameTransactionResourceBounds(-1n)).toThrow();
});
