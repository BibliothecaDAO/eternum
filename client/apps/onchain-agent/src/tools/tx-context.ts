/**
 * Shared transaction context passed to all tools that execute on-chain writes.
 */

import type { EternumProvider } from "@bibliothecadao/provider";
import type { AccountInterface } from "starknet";

export interface TxContext {
  provider: EternumProvider;
  signer: AccountInterface;
}

/** Compare two hex addresses for equality, ignoring leading zero differences. */
export function addressesEqual(a: string, b: string): boolean {
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return a === b;
  }
}

/**
 * Extract a searchable error string from nested RPC/provider errors.
 * Checks baseError.data.execution_error, then message, then stringifies the whole thing.
 */
export function extractTxError(err: any): string {
  // Try to find the most useful error message from nested RPC errors
  const executionError = err?.baseError?.data?.execution_error;
  if (typeof executionError === "string") {
    // Extract the human-readable failure reason from Cairo error strings
    const reasonMatch = executionError.match(/Failure reason:\s*\([^)]*'([^']+)'\)/);
    const quotedMatch = executionError.match(/"([^"]+)"/);
    if (reasonMatch) return reasonMatch[1];
    if (quotedMatch) return quotedMatch[1];
    // Truncate long execution errors
    return executionError.length > 300 ? executionError.slice(0, 300) + "..." : executionError;
  }
  return err?.message ?? String(err);
}
