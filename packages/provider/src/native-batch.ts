import { hash, type GetTransactionReceiptResponse } from "starknet";

import type { BatchTransactionReceipt } from "@bibliothecadao/types";

const batchProgressSelector = BigInt(hash.getSelectorFromName("BatchProgress"));
const executionRecordedSelector = BigInt(hash.getSelectorFromName("ExecutionRecorded"));

type Event = { from_address: string; keys: string[]; data: string[] };

/** Batch events report work left after a successful command, never another copy of game state. */
export function nativeBatchRemaining(events: readonly Event[], season: string): string | undefined {
  const own = events.filter((event) => BigInt(event.from_address) === BigInt(season));
  const progress = own.filter((event) => BigInt(event.keys[0] ?? "0") === batchProgressSelector);
  if (progress.length === 0) return undefined;
  if (progress.length !== 1) throw new Error("Ambiguous native batch result");
  const event = progress[0];
  if (event.keys.length !== 2 || event.data.length !== 3) throw new Error("Malformed native batch result");
  const [game, actor, nonce, remaining] = [event.keys[1], ...event.data].map(BigInt);
  if (game < 1n || game >= 2n ** 32n || nonce < 0n || nonce >= 2n ** 64n || remaining < 0n || remaining >= 2n ** 64n)
    throw new Error("Invalid native batch result");
  const recorded = own.filter((value) => BigInt(value.keys.at(-1) ?? "0") === executionRecordedSelector);
  if (recorded.length !== 1 || recorded[0].data.length !== 7) throw new Error("Missing native batch outcome");
  const [recordedGame, recordedActor, recordedNonce, consumed, , status] = recorded[0].data.map(BigInt);
  if (game !== recordedGame || actor !== recordedActor || nonce !== recordedNonce || consumed !== 1n || status !== 1n)
    throw new Error("Native batch result does not match its successful ticket");
  return remaining.toString();
}

export function requireBatchReceipt(receipt: GetTransactionReceiptResponse): BatchTransactionReceipt {
  const remaining = (receipt as GetTransactionReceiptResponse & { batch_remaining?: string }).batch_remaining;
  if (remaining === undefined || !/^\d+$/.test(remaining))
    throw new Error("Native batch completion is not available; resume from the recorded cursor");
  return Object.assign(receipt, { remaining: BigInt(remaining) });
}

export async function completeNativeBatches<T extends { remaining: bigint }>(submit: () => Promise<T>): Promise<T> {
  let previous: bigint | undefined;
  while (true) {
    const result = await submit();
    if (result.remaining === 0n) return result;
    if (result.remaining < 0n || (previous !== undefined && result.remaining >= previous))
      throw new Error("Native batch made no progress; complete its prerequisites before resuming");
    previous = result.remaining;
  }
}
