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
export interface LauncherSeats {
  /** The launcher's pre-confirmed nonce: the first one the chain has not taken. */
  nextNonce(): Promise<bigint>;
  /** Sends a seat of this game at this nonce; identical bytes on every resend. Throws `SeatRefused` if nothing was sent. */
  send(nonce: bigint, gameId: number): Promise<void>;
  /** Waits for the seat at this nonce; `missing` if no receipt shows within the wait. */
  result(nonce: bigint): Promise<SeatResult>;
}

export class SeatRefused extends Error {}

/**
 * Seats every player of freshly created games in one window: each game's roster size is known and nobody is seated
 * yet, so no probe is needed. Returns each game's latest reported unseated count, absent when none of its seats
 * reported one; the caller verifies every game and tops up any that is not ready.
 */
export async function seatFreshGames(
  seats: LauncherSeats,
  games: readonly { gameId: number; players: number }[],
  window = SEAT_WINDOW,
) {
  const plan = games.flatMap(({ gameId, players }) => Array.from({ length: players }, () => gameId));
  return sendInWindow(seats, await seats.nextNonce(), plan, window);
}

/**
 * Seats one game's roster when how many remain is unknown: after a restart, or to top up after verification. Every
 * seat means "seat the next player", so seats are interchangeable: a reverted or refused seat only spends its nonce,
 * and a seat past the last player is a no-op. A probe seat learns how many remain, the rest go out in one window, and
 * the last report decides whether to top up. A round that spends its nonces without seating anyone reports nothing;
 * an isolated one is topped up, but two unproductive rounds in a row stop the launch, so a persistent refusal releases
 * the registrar to its retry backoff instead of spending nonces. Returns the seats sent, not counting resends.
 */
export async function seatRoster(seats: LauncherSeats, gameId: number, window = SEAT_WINDOW): Promise<number> {
  let transactions = 0;
  let unseated: bigint | undefined;
  let stalled = 0;
  for (;;) {
    const count = Number(unseated ?? 1n);
    const plan = Array.from({ length: count }, () => gameId);
    const reported = (await sendInWindow(seats, await seats.nextNonce(), plan, window)).get(gameId);
    transactions += count;
    if (reported === 0n) return transactions;
    const progressed = reported !== undefined && (unseated === undefined || reported < unseated);
    stalled = progressed ? 0 : stalled + 1;
    if (stalled === STALLED_ROUNDS) throw new Error("roster_seating_did_not_progress");
    unseated = reported ?? unseated;
  }
}

/** Sends one seat per planned game from `first`, never more than `window` unsettled; returns each game's latest report. */
async function sendInWindow(seats: LauncherSeats, first: bigint, plan: readonly number[], window: bigint) {
  const unsettled: { nonce: bigint; gameId: number }[] = [];
  const reported = new Map<number, bigint>();
  const settleOldest = async () => {
    const seat = unsettled.shift()!;
    const result = await settled(seats, seat.nonce, seat.gameId);
    if (typeof result === "object") reported.set(seat.gameId, result.remaining);
  };
  for (const [index, gameId] of plan.entries()) {
    if (BigInt(unsettled.length) >= window) await settleOldest();
    const nonce = first + BigInt(index);
    await sendWithRetry(seats, nonce, gameId);
    unsettled.push({ nonce, gameId });
  }
  while (unsettled.length) await settleOldest();
  return reported;
}

/**
 * A seat that never shows leaves a gap every later nonce waits behind. If the chain still expects that nonce, the
 * identical seat is sent again; if the chain has moved past it, it executed and only its receipt was unreadable.
 */
async function settled(seats: LauncherSeats, nonce: bigint, gameId: number): Promise<Exclude<SeatResult, "missing">> {
  for (let attempt = 0; attempt < LOST_SEAT_ATTEMPTS; attempt++) {
    const result = await seats.result(nonce);
    if (result !== "missing") return result;
    if ((await seats.nextNonce()) > nonce) return "spent";
    await sendWithRetry(seats, nonce, gameId);
  }
  throw new Error("roster_seat_lost");
}

async function sendWithRetry(seats: LauncherSeats, nonce: bigint, gameId: number) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await seats.send(nonce, gameId);
    } catch (error) {
      if (!(error instanceof SeatRefused) || attempt === SEND_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
}
