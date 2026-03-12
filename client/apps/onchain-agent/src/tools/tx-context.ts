/**
 * Shared transaction context for all tools that execute on-chain writes.
 */

import type { EternumProvider } from "@bibliothecadao/provider";
import type { AccountInterface } from "starknet";

export interface TxContext {
  provider: EternumProvider;
  signer: AccountInterface;
}

/**
 * Compare two hex addresses for equality, ignoring leading-zero differences.
 *
 * @param a - First hex address (e.g. "0x0123...").
 * @param b - Second hex address to compare against.
 * @returns `true` if both addresses represent the same numeric value, `false` otherwise.
 */
export function addressesEqual(a: string, b: string): boolean {
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return a === b;
  }
}

/**
 * Extract a human-readable error string from nested RPC/provider errors.
 * Walks common error shapes from starknet.js and the Eternum provider, preferring
 * the `execution_error` field and falling back to `message` or a full JSON stringify.
 *
 * @param err - The raw error thrown by a provider transaction call.
 * @returns A concise, human-readable error string. Some code paths truncate at 300 characters.
 */
export function extractTxError(err: any): string {
  // Walk common nested error shapes from starknet.js / provider
  const paths = [
    err?.baseError?.data?.execution_error,
    err?.cause?.baseError?.data?.execution_error,
    err?.cause?.message,
    err?.data?.execution_error,
  ];
  for (const val of paths) {
    if (typeof val === "string" && val.length > 30) {
      const reasonMatch = val.match(/Failure reason:\s*\([^)]*'([^']+)'\)/);
      const quotedMatch = val.match(/"([^"]+)"/);
      if (reasonMatch) return reasonMatch[1];
      if (quotedMatch) return quotedMatch[1];
      return val.length > 300 ? val.slice(0, 300) + "..." : val;
    }
  }

  // Last resort: stringify the whole error to find details
  const msg = err?.message ?? String(err);
  try {
    const full = JSON.stringify(err, null, 0);
    const quotedMatch = full.match(/"execution_error":"([^"]+)"/);
    if (quotedMatch) {
      const decoded = quotedMatch[1].replace(/\\n/g, " ").replace(/\\"/g, '"');
      const reason = decoded.match(/"([^"]{5,})"/);
      return reason ? reason[1] : decoded.slice(0, 300);
    }
  } catch {
    /* circular ref */
  }

  return msg;
}
