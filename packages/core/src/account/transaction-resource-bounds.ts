import type { GameChain } from "@realms-world/chain";
import type { ResourceBoundsBN } from "starknet";

const MADARA_L2_GAS_AMOUNT = 1_200_000_000n;

export function resolveGameTransactionResourceBounds(chain: "madara"): ResourceBoundsBN;
export function resolveGameTransactionResourceBounds(chain: "appchain"): undefined;
export function resolveGameTransactionResourceBounds(chain: GameChain): ResourceBoundsBN | undefined;
export function resolveGameTransactionResourceBounds(chain: GameChain): ResourceBoundsBN | undefined {
  if (chain !== "madara") return undefined;

  return {
    l1_gas: zeroResourceBound(),
    l1_data_gas: zeroResourceBound(),
    l2_gas: { max_amount: MADARA_L2_GAS_AMOUNT, max_price_per_unit: 0n },
  };
}

function zeroResourceBound(): ResourceBoundsBN["l1_gas"] {
  return { max_amount: 0n, max_price_per_unit: 0n };
}
