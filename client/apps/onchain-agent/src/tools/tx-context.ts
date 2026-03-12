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
 * Extract a human-readable error string from a nested RPC/provider error.
 * Walks common error shapes from starknet.js and the Eternum provider, preferring
 * the `execution_error` field and falling back to `message` or a full JSON stringify.
 *
 * @param err - The raw error thrown by a provider transaction call.
 * @returns A concise error string, truncated at 300 characters on some code paths.
 */
export function extractTxError(err: any): string {
  // WASM JsControllerError — has code(), data(), message() methods
  if (err?.__wbg_ptr) {
    try {
      const data = typeof err.data === "function" ? err.data() : err.data;
      const msg = typeof err.message === "function" ? err.message() : err.message;
      const code = typeof err.code === "function" ? err.code() : err.code;

      // data can be a JSON string like {"transaction_index":0,"execution_error":"..."}
      // or a plain object
      let execError: string | undefined;
      if (typeof data === "string") {
        try {
          const parsed = JSON.parse(data);
          execError = parsed?.execution_error;
        } catch {
          execError = data;
        }
      } else if (typeof data === "object" && data) {
        execError = data.execution_error;
      }

      if (typeof execError === "string" && execError.length > 10) {
        // Look for the human-readable reason in quotes: "insufficient stamina, you need: 30, and have: 10"
        const quotedReasons = [...execError.matchAll(/"([^"]{10,})"/g)].map((m) => m[1]);
        // Filter out hex strings and known noise
        const useful = quotedReasons.filter(
          (r) => !r.startsWith("0x") && !r.includes("class_hash") && !r.includes("contract_address"),
        );
        if (useful.length > 0) return useful[0];

        // Fallback: Failure reason with felt-decoded string
        const feltReason = execError.match(/\('([^']+)'\).*\('ENTRYPOINT_FAILED'\)/);
        if (feltReason) return feltReason[1];

        return execError.length > 300 ? execError.slice(0, 300) + "..." : execError;
      }

      if (msg && msg !== "Transaction execution error") return `${msg} (code ${code})`;
    } catch { /* */ }
  }

  // Walk common nested error shapes from starknet.js / provider
  const paths = [
    err?.baseError?.data?.execution_error,
    err?.cause?.baseError?.data?.execution_error,
    err?.cause?.data?.execution_error,
    err?.cause?.message,
    err?.data?.execution_error,
    err?.message,
  ];
  for (const val of paths) {
    if (typeof val === "string" && val.length > 10) {
      // Try to extract the most useful error reason
      const reasonMatch = val.match(/Failure reason:\s*\([^)]*'([^']+)'\)/);
      if (reasonMatch) return reasonMatch[1];
      const quotedMatch = val.match(/"([^"]{5,})"/);
      if (quotedMatch) return quotedMatch[1];
      return val.length > 300 ? val.slice(0, 300) + "..." : val;
    }
  }

  // Deep-search: stringify the whole error to find details
  const msg = err?.message ?? String(err);
  try {
    const full = JSON.stringify(err, null, 0);
    // Search for execution_error field anywhere
    const execMatch = full.match(/"execution_error":"([^"]+)"/);
    if (execMatch) {
      const decoded = execMatch[1].replace(/\\n/g, " ").replace(/\\"/g, '"');
      const reason = decoded.match(/Failure reason:\s*\([^)]*'([^']+)'\)/);
      if (reason) return reason[1];
      const quoted = decoded.match(/"([^"]{5,})"/);
      return quoted ? quoted[1] : decoded.slice(0, 300);
    }
    // Search for revert_error or error_message
    const revertMatch = full.match(/"(?:revert_error|error_message|revert_reason)":"([^"]+)"/);
    if (revertMatch) return revertMatch[1];
    // Search for any meaningful error string in the JSON
    const anyReason = full.match(/Failure reason[^']*'([^']+)'/);
    if (anyReason) return anyReason[1];
  } catch {
    /* circular ref */
  }

  // WASM session errors — the Cartridge WASM module throws opaque errors
  // with only a __wbg_ptr field and no useful message
  if (err?.__wbg_ptr && !err?.message) {
    return "Session error (WASM) — session may have expired. Restart the agent to re-authenticate.";
  }

  // If we still have a generic message, try to log the full error for debugging
  if (msg === "Transaction execution error" || msg.length < 20) {
    try {
      const detail = JSON.stringify(err, null, 2).slice(0, 500);
      console.error(`[TX] Raw error detail: ${detail}`);
    } catch {}
  }

  return msg;
}
