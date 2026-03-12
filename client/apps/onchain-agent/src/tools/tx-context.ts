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
  } catch { /* circular ref */ }

  return msg;
}
