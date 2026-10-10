import type { ResourceBoundsBN } from "starknet";

/**
 * A play invoke's bounds on a fee-free shard: l2 gas at the shard's own bound (its manifest's l2GasBound), every price
 * and every other resource zero. The one builder of the play fee frame.
 */
export function playResourceBounds(l2GasBound: bigint): ResourceBoundsBN {
  return {
    l1_gas: zeroResourceBound(),
    l1_data_gas: zeroResourceBound(),
    l2_gas: { max_amount: l2GasBound, max_price_per_unit: 0n },
  };
}

const MADARA_L2_GAS_AMOUNT = 1_200_000_000n;

/**
 * The registrar's bounds, at a fixed l2 gas amount it does not read from the shard. It goes once the registrar passes
 * the shard's manifest bound to playResourceBounds.
 */
export function resolveGameTransactionResourceBounds(): ResourceBoundsBN {
  return playResourceBounds(MADARA_L2_GAS_AMOUNT);
}

function zeroResourceBound(): ResourceBoundsBN["l1_gas"] {
  return { max_amount: 0n, max_price_per_unit: 0n };
}
