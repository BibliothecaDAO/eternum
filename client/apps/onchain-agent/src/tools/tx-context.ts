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
  const deepMsg = err?.baseError?.data?.execution_error;
  const primary = deepMsg ?? err?.message ?? String(err);
  const errStr = typeof primary === "string" ? primary : JSON.stringify(primary);
  // If the primary message is short/generic (e.g. "Transaction execution error"),
  // also search the full stringified error for nested details.
  if (errStr.length < 200) {
    try {
      const full = JSON.stringify(err);
      if (full.length > errStr.length) return `${errStr} ${full}`;
    } catch { /* circular ref, ignore */ }
  }
  return errStr;
}
