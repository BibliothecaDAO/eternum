/** A producer pays its rate for every ended armies tick, with nothing paid between boundaries. */
export function productionOutput(
  production: { last_settled_tick: number; production_rate: bigint },
  timestamp: number,
  tickSeconds: number,
): bigint {
  const since = production.last_settled_tick;
  if (!Number.isSafeInteger(since) || !Number.isSafeInteger(timestamp)) throw new Error("Invalid production clock");
  if (!Number.isSafeInteger(tickSeconds) || tickSeconds <= 0) throw new Error("Invalid production tick");
  const ticks = Math.max(0, Math.floor(timestamp / tickSeconds) - since);
  return BigInt(ticks) * production.production_rate * BigInt(tickSeconds);
}
