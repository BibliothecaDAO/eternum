/** A producer pays its rate per elapsed second; the legacy wire field holds Unix seconds. */
export function productionOutput(
  production: { last_settled_tick: number; production_rate: bigint },
  timestamp: number,
): bigint {
  const since = production.last_settled_tick;
  if (!Number.isSafeInteger(since) || !Number.isSafeInteger(timestamp)) throw new Error("Invalid production clock");
  return BigInt(Math.max(0, timestamp - since)) * production.production_rate;
}
