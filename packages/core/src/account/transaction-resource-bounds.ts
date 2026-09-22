import type { ResourceBoundsBN } from "starknet";

const MADARA_L2_GAS_AMOUNT = 1_200_000_000n;

/** Every shard is a fee-free Madara chain, so game transactions carry fixed zero-price bounds. */
export function resolveGameTransactionResourceBounds(): ResourceBoundsBN {
  return {
    l1_gas: zeroResourceBound(),
    l1_data_gas: zeroResourceBound(),
    l2_gas: { max_amount: MADARA_L2_GAS_AMOUNT, max_price_per_unit: 0n },
  };
}

function zeroResourceBound(): ResourceBoundsBN["l1_gas"] {
  return { max_amount: 0n, max_price_per_unit: 0n };
}
