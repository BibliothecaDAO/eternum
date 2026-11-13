import type { AccrualRates } from "@bibliothecadao/types";

/** Output carries fractions across settlements, including each bane's start and early end. */
export function productionOutput(
  production: { last_settled_at: number; production_rate: bigint; remainder: number; rates?: AccrualRates },
  timestamp: number,
): bigint {
  const since = production.last_settled_at;
  if (!Number.isSafeInteger(since) || !Number.isSafeInteger(timestamp)) throw new Error("Invalid production clock");
  let seconds = BigInt(Math.max(0, timestamp - since)) * 100n;
  for (const window of production.rates?.(since, timestamp) ?? [])
    seconds -= BigInt(window.end - window.start) * BigInt(100 - window.percent);
  return (seconds * production.production_rate + BigInt(production.remainder)) / 100n;
}

/** The first second the producer reaches its finite budget under the same interval rates. */
export function productionEndsAt(production: Parameters<typeof productionOutput>[0], budget: bigint): number {
  if (budget <= 0n || production.production_rate <= 0n) return production.last_settled_at;
  let low = production.last_settled_at;
  let span = Number((budget + production.production_rate - 1n) / production.production_rate);
  let high = low + span;
  if (!Number.isSafeInteger(high)) return Number.POSITIVE_INFINITY;
  while (productionOutput(production, high) < budget) {
    span *= 2;
    high = production.last_settled_at + span;
    if (!Number.isSafeInteger(high)) return Number.POSITIVE_INFINITY;
  }
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (productionOutput(production, middle) >= budget) high = middle;
    else low = middle;
  }
  return high;
}
