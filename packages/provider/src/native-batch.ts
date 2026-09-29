import { byteArray, hash, shortString, type GetTransactionReceiptResponse } from "starknet";

import type { BatchTransactionReceipt, NativeExecutionOutcome, NativeTicketIdentity } from "@bibliothecadao/types";

const batchProgressSelector = BigInt(hash.getSelectorFromName("BatchProgress"));
const executionRecordedSelector = BigInt(hash.getSelectorFromName("ExecutionRecorded"));

type Event = { from_address: string; keys: string[]; data: string[] };

/** Every accepted ticket has its own outcome, even when several share a transaction. */
export function nativeExecutionOutcomes(events: readonly Event[], games: string): NativeExecutionOutcome[] {
  const own = events.filter((event) => BigInt(event.from_address) === BigInt(games));
  const outcomes = own
    .filter((event) => BigInt(event.keys.at(-1) ?? "0") === executionRecordedSelector)
    .map(decodeExecution);
  // Each game numbers its own recorded actions, so a batch can hold the same order in two games.
  if (new Set(outcomes.map((outcome) => `${outcome.gameId}:${outcome.order}`)).size !== outcomes.length)
    throw new Error("Duplicate native execution order");
  for (const event of own.filter((event) => BigInt(event.keys[0] ?? "0") === batchProgressSelector)) {
    attachBatchProgress(outcomes, event);
  }
  return outcomes;
}

function decodeExecution(event: Event): NativeExecutionOutcome {
  if (event.data.length < 10) throw new Error("Malformed native execution outcome");
  const [game, actor, nonce, consumed, order, status, statusClass] = event.data.slice(0, 7).map(BigInt);
  const reason = decodeReason(event.data.slice(7));
  if (
    nonce < 0n ||
    nonce >= 2n ** 64n ||
    order <= 0n ||
    order >= 2n ** 64n ||
    (consumed !== 0n && consumed !== 1n) ||
    (status !== 1n && status !== 2n) ||
    (status === 1n ? statusClass !== 0n || reason !== "" : statusClass === 0n || reason === "")
  )
    throw new Error("Invalid native execution outcome");
  return {
    gameId: game.toString(),
    actor: actor.toString(),
    nonce: nonce.toString(),
    order: order.toString(),
    nonceConsumed: consumed === 1n,
    status: status === 1n ? "SUCCEEDED" : "REVERTED",
    statusClass: statusClass === 0n ? "" : shortString.decodeShortString(`0x${statusClass.toString(16)}`),
    reason,
  };
}

/** Replaces the old one-felt reason decoder; validate the entire Cairo ByteArray before decoding it. */
function decodeReason(fields: string[]): string {
  const count = Number(BigInt(fields[0]));
  if (!Number.isSafeInteger(count) || count < 0 || fields.length !== count + 3)
    throw new Error("Malformed native rejection reason");
  const data = fields.slice(1, count + 1);
  const pending = BigInt(fields[count + 1]);
  const length = BigInt(fields[count + 2]);
  if (
    data.some((word) => BigInt(word) < 0n || BigInt(word) >= 1n << 248n) ||
    length < 0n ||
    length >= 31n ||
    pending < 0n ||
    pending >= 1n << (8n * length)
  )
    throw new Error("Invalid native rejection reason");
  return byteArray.stringFromByteArray({ data, pending_word: pending.toString(), pending_word_len: Number(length) });
}

function attachBatchProgress(outcomes: NativeExecutionOutcome[], event: Event): void {
  if (event.keys.length !== 2 || event.data.length !== 3) throw new Error("Malformed native batch result");
  const [game, actor, nonce, remaining] = [event.keys[1], ...event.data].map(BigInt);
  if (game < 1n || game >= 2n ** 32n || nonce < 0n || nonce >= 2n ** 64n || remaining < 0n || remaining >= 2n ** 64n)
    throw new Error("Invalid native batch result");
  const matching = outcomes.filter(
    (outcome) =>
      BigInt(outcome.gameId) === game &&
      BigInt(outcome.actor) === actor &&
      BigInt(outcome.nonce) === nonce &&
      outcome.nonceConsumed &&
      outcome.status === "SUCCEEDED",
  );
  if (matching.length !== 1) throw new Error("Native batch result does not match its successful ticket");
  if (matching[0].batchRemaining !== undefined) throw new Error("Ambiguous native batch result");
  matching[0].batchRemaining = remaining.toString();
}

export function requireNativeExecutionOutcome(
  outcomes: readonly NativeExecutionOutcome[] | undefined,
  ticket: NativeTicketIdentity,
): NativeExecutionOutcome {
  const matching = outcomes?.filter(
    (outcome) => BigInt(outcome.gameId) === BigInt(ticket.gameId) && BigInt(outcome.order) === BigInt(ticket.order),
  );
  if (!matching || matching.length !== 1) throw new Error("Missing or ambiguous native ticket outcome");
  const outcome = matching[0];
  if (BigInt(outcome.actor) !== BigInt(ticket.actor) || BigInt(outcome.nonce) !== BigInt(ticket.nonce))
    throw new Error("Native ticket outcome identity mismatch");
  return outcome;
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
