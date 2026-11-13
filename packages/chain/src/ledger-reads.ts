/**
 * The ledger's audit is one reconciliation an hour. Between hours the ledger is read only because of a cause: the
 * relay wrote to it, or a player acted. A fact nobody announced waits at most this long, and each read costs the paid
 * L2 RPC a call. Payments and shard reads keep their per-minute tick.
 */
export const LEDGER_READ_PERIOD_SECONDS = 3600;

/** A ledger observation older than two periods means the reading tick stopped. */
export const LEDGER_READ_STALE_SECONDS = 2 * LEDGER_READ_PERIOD_SECONDS;

/** Whether the cron tick scheduled at this time (milliseconds, as Cloudflare gives it) is the hourly reconciliation. */
export const isLedgerReadTick = (scheduledTime: number): boolean =>
  Math.floor(scheduledTime / 1000 / 60) % (LEDGER_READ_PERIOD_SECONDS / 60) ===
  0;
