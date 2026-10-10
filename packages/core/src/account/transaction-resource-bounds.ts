import type { ResourceBoundsBN } from "starknet";
/** The shard publishes the only gas quantity; every fee price on that chain is zero. */
export function resolveGameTransactionResourceBounds(l2Gas: bigint): ResourceBoundsBN {
  if (l2Gas <= 0n || l2Gas >= 2n ** 64n) throw new Error("invalid_shard_gas_bound");
  return {
    l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l2_gas: { max_amount: l2Gas, max_price_per_unit: 0n },
  };
}
