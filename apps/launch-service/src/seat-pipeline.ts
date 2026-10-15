/**
 * How far ahead of its last settled seat the launcher queues seats. The stamping RPC admits the launcher's plays up to
 * this many nonces ahead (deploy/athanor/scripts/read-rpc.ts, LAUNCHER_NONCE_WINDOW); everyone else stamps one at a time.
 */
const SEAT_WINDOW = 48n;
const SEND_ATTEMPTS = 5;
const LOST_SEAT_ATTEMPTS = 3;
/** Rounds in a row that may end without a smaller unseated count before the launch gives the signer back to retry. */
const STALLED_ROUNDS = 2;

/** What a sent seat came to: the chain's unseated count after it, a nonce spent seating nobody, or nothing yet. */
export type SeatResult = { remaining: bigint } | "spent" | "missing";

/** The launcher's one nonce sequence on the shard, as the pipeline needs it. */
export interface RosterSeats {
  /** The launcher's pre-confirmed nonce: the first one the chain has not taken. */
  nextNonce(): Promise<bigint>;
  /** Sends the game's seat at this nonce; identical bytes on every resend. Throws `SeatRefused` if nothing was sent. */
  send(nonce: bigint): Promise<void>;
  /** Waits for the seat at this nonce; `missing` if no receipt shows within the wait. */
  result(nonce: bigint): Promise<SeatResult>;
}

export class SeatRefused extends Error {}

/**
 * Seats a roster on consecutive nonces without waiting on each one, so seating is bound by execution. Every seat
 * means "seat the next player", so seats are interchangeable: a reverted or refused seat only spends its nonce, and
 * a seat past the last player is a no-op. A probe seat learns how many remain, the rest go out in one window, and the
 * last report decides whether to top up. A round that spends its nonces without seating anyone (every seat reverted
 * or refused) reports nothing; an isolated one is topped up, but two unproductive rounds in a row stop the launch, so
 * a persistent refusal releases the registrar to its retry backoff instead of spending nonces. Returns the seats
 * sent, not counting resends of the same nonce.
 */
export async function seatRoster(seats: RosterSeats, window = SEAT_WINDOW): Promise<number> {
  let transactions = 0;
  let unseated: bigint | undefined;
  let stalled = 0;
  for (;;) {
    const count = unseated ?? 1n;
    const reported = await sendInWindow(seats, await seats.nextNonce(), count, window);
    transactions += Number(count);
    if (reported === 0n) return transactions;
    const progressed = reported !== undefined && (unseated === undefined || reported < unseated);
    stalled = progressed ? 0 : stalled + 1;
    if (stalled === STALLED_ROUNDS) throw new Error("roster_seating_did_not_progress");
    unseated = reported ?? unseated;
  }
}

/** Sends `count` seats from `first`, never more than `window` unsettled; returns the latest unseated count reported. */
async function sendInWindow(seats: RosterSeats, first: bigint, count: bigint, window: bigint) {
  const unsettled: bigint[] = [];
  let reported: bigint | undefined;
  const settleOldest = async () => {
    const result = await settled(seats, unsettled.shift()!);
    if (typeof result === "object") reported = result.remaining;
  };
  for (let nonce = first; nonce < first + count; nonce++) {
    if (BigInt(unsettled.length) >= window) await settleOldest();
    await sendWithRetry(seats, nonce);
    unsettled.push(nonce);
  }
  while (unsettled.length) await settleOldest();
  return reported;
}

/**
 * A seat that never shows leaves a gap every later nonce waits behind. If the chain still expects that nonce, the
 * identical seat is sent again; if the chain has moved past it, it executed and only its receipt was unreadable.
 */
async function settled(seats: RosterSeats, nonce: bigint): Promise<Exclude<SeatResult, "missing">> {
  for (let attempt = 0; attempt < LOST_SEAT_ATTEMPTS; attempt++) {
    const result = await seats.result(nonce);
    if (result !== "missing") return result;
    if ((await seats.nextNonce()) > nonce) return "spent";
    await sendWithRetry(seats, nonce);
  }
  throw new Error("roster_seat_lost");
}

async function sendWithRetry(seats: RosterSeats, nonce: bigint) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await seats.send(nonce);
    } catch (error) {
      if (!(error instanceof SeatRefused) || attempt === SEND_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
}
