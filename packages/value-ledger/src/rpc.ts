import { RpcProvider, shortString } from "starknet";

/** Missing configuration must never select the library's default public RPC. */
export const rpcAt = (rpcUrl: string): RpcProvider => {
  try {
    const url = new URL(rpcUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error("RPC URL is missing or invalid");
  }
  return new RpcProvider({ nodeUrl: rpcUrl });
};

/** The most calls one JSON-RPC batch may carry: the shard's public read RPC refuses a larger one. */
export const SHARD_RPC_MAX_BATCH_CALLS = 32;

/**
 * One JSON-RPC batch of reads of the same method, answered in request order. Any call's error fails the whole read: a
 * caller never acts on part of a batch.
 */
export const rpcBatch = async <A>(rpcUrl: string, method: string, calls: readonly unknown[]): Promise<A[]> => {
  if (!calls.length) return [];
  if (calls.length > SHARD_RPC_MAX_BATCH_CALLS) throw new Error("rpc_batch_too_large");
  rpcAt(rpcUrl);
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(calls.map((params, id) => ({ jsonrpc: "2.0", id, method, params }))),
  });
  if (!response.ok) throw new Error(`rpc_batch_failed:${response.status}`);
  const answers = (await response.json()) as { id?: unknown; result?: A; error?: unknown }[];
  if (!Array.isArray(answers) || answers.length !== calls.length) throw new Error("rpc_batch_incomplete");
  const byId = new Map(answers.map((answer) => [answer.id, answer]));
  return calls.map((_, id) => {
    const answer = byId.get(id);
    if (!answer || answer.error !== undefined || answer.result === undefined) throw new Error("rpc_batch_call_failed");
    return answer.result;
  });
};

/** RPC nodes return Cairo contract refusals as text or a felt in a serialized ByteArray. */
export function isContractRevert(error: unknown, reason: string): boolean {
  if (!error || typeof error !== "object") return false;
  const rpc = error as { code?: number; baseError?: unknown; cause?: unknown };
  if (rpc.code !== 40) return isContractRevert(rpc.baseError, reason) || isContractRevert(rpc.cause, reason);
  const detail = JSON.stringify(error);
  if (detail.includes(reason)) return true;
  const felts: string[] = detail.match(/0x[0-9a-f]+/gi) ?? [];
  return reason.length <= 31 && felts.includes(shortString.encodeShortString(reason));
}
