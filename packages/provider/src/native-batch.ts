import { hash, shortString, type GetTransactionReceiptResponse } from "starknet";

import type { BatchTransactionReceipt, NativeExecutionOutcome, NativeTicketIdentity } from "@bibliothecadao/types";

const batchProgressSelector = BigInt(hash.getSelectorFromName("BatchProgress"));
const executionRecordedSelector = BigInt(hash.getSelectorFromName("ExecutionRecorded"));

type Event = { from_address: string; keys: string[]; data: string[] };

/** Every accepted ticket has its own outcome, even when several share a transaction. */
export function nativeExecutionOutcomes(events: readonly Event[], season: string): NativeExecutionOutcome[] {
  const own = events.filter((event) => BigInt(event.from_address) === BigInt(season));
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
  if (event.data.length !== 7) throw new Error("Malformed native execution outcome");
  const [game, actor, nonce, consumed, order, status, reason] = event.data.map(BigInt);
  if (
    nonce < 0n ||
    nonce >= 2n ** 64n ||
    order <= 0n ||
    order >= 2n ** 64n ||
    (consumed !== 0n && consumed !== 1n) ||
    (status !== 1n && status !== 2n)
  )
    throw new Error("Invalid native execution outcome");
  return {
    gameId: game.toString(),
    actor: actor.toString(),
    nonce: nonce.toString(),
    order: order.toString(),
    nonceConsumed: consumed === 1n,
    status: status === 1n ? "SUCCEEDED" : "REVERTED",
    reason: reason === 0n ? "" : shortString.decodeShortString(`0x${reason.toString(16)}`),
  };
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
