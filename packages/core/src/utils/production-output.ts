/** What a producer adds between its last settlement and `timestamp`: elapsed seconds times its rate. */
export function productionOutput(
  production: { last_updated_at: number; production_rate: bigint },
  timestamp: number,
): bigint {
  const since = production.last_updated_at;
  if (!Number.isSafeInteger(since) || !Number.isSafeInteger(timestamp)) throw new Error("Invalid production clock");
  return BigInt(Math.max(0, timestamp - since)) * production.production_rate;
}
