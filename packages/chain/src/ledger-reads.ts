/**
 * The ledger is read on a 5-minute cadence: a season post, a chest draw, a paid-claim audit or a deposit audit waits at
 * most that long, and each read costs the paid L2 RPC a call. Payments and shard reads keep their per-minute tick.
 */
export const LEDGER_READ_PERIOD_SECONDS = 300;

/** A ledger observation older than two periods means the reading tick stopped. */
export const LEDGER_READ_STALE_SECONDS = 2 * LEDGER_READ_PERIOD_SECONDS;

/** Whether the cron tick scheduled at this time (milliseconds, as Cloudflare gives it) is a ledger-reading tick. */
export const isLedgerReadTick = (scheduledTime: number): boolean =>
  Math.floor(scheduledTime / 1000 / 60) % (LEDGER_READ_PERIOD_SECONDS / 60) ===
  0;
