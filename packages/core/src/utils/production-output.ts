/** A producer pays its rate per elapsed second since last_settled_at. */
export function productionOutput(
  production: { last_settled_at: number; production_rate: bigint },
  timestamp: number,
): bigint {
  const since = production.last_settled_at;
  if (!Number.isSafeInteger(since) || !Number.isSafeInteger(timestamp)) throw new Error("Invalid production clock");
  return BigInt(Math.max(0, timestamp - since)) * production.production_rate;
}
