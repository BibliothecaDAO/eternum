/**
 * Fetch the prize-pool ("winner jackpot") balance for a world: the fee-token
 * balance held by its prize distribution contract.
 *
 * Centralized here so the jackpot costs one RPC call per world per poll cycle
 * server-wide, instead of every connected client polling `balance_of` itself
 * (which was rate-limiting the public RPC endpoint).
 */

// starknet_keccak("balance_of") — precomputed so we don't need a starknet dependency.
const BALANCE_OF_SELECTOR = "0x35a73cd311a05d46deda634c5ee045db92f811b4e74bca4437fcb5302b7af33";

import { resolveMainnetRpcUrl } from "../config/endpoints";

/**
 * Call `balance_of(prizeDistributionAddress)` on the fee-token contract via
 * raw JSON-RPC. Returns the uint256 balance as a decimal string, or null on
 * any failure so callers can keep the last known value.
 */
export async function fetchJackpotBalance(
  feeTokenAddress: string,
  prizeDistributionAddress: string,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const response = await fetch(resolveMainnetRpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "starknet_call",
        params: {
          request: {
            contract_address: feeTokenAddress,
            entry_point_selector: BALANCE_OF_SELECTOR,
            calldata: [prizeDistributionAddress],
          },
          block_id: "latest",
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { result?: unknown };
    const result = payload?.result;
    if (!Array.isArray(result) || result.length < 1) return null;

    const low = BigInt(result[0] as string);
    const high = result.length > 1 ? BigInt(result[1] as string) : 0n;
    return (low + (high << 128n)).toString();
  } catch {
    return null;
  }
}
