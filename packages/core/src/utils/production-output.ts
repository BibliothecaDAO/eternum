import { nativeBaneConstants } from "../../../../contracts/l3/world-native/schema/client.gen";

type Window = { kind: number; start: number; end: number };

/** Raw output before storage and budget limits, retaining hundredths across settlements. */
export function productionOutput(
  production: { last_settled_at: number; production_rate: bigint; remainder: number },
  timestamp: number,
  windows: readonly Window[],
  productionPercent: number,
): { amount: bigint; remainder: number } {
  const since = production.last_settled_at;
  if (!Number.isSafeInteger(since) || !Number.isSafeInteger(timestamp)) throw new Error("Invalid production clock");
  if (!Number.isInteger(production.remainder) || production.remainder < 0 || production.remainder >= 100)
    throw new Error("Invalid production remainder");
  if (!Number.isInteger(productionPercent) || productionPercent <= 0 || productionPercent > 100)
    throw new Error("Invalid production percent");
  let scaledSeconds = BigInt(Math.max(0, timestamp - since)) * 100n;
  let previousEnd = Number.NEGATIVE_INFINITY;
  for (const window of windows) {
    if (
      !Number.isSafeInteger(window.start) ||
      !Number.isSafeInteger(window.end) ||
      window.end < window.start ||
      window.start < previousEnd
    )
      throw new Error("Invalid production windows");
    previousEnd = window.end;
    if (window.kind !== nativeBaneConstants.ASH_FALL) continue;
    const seconds = Math.max(0, Math.min(timestamp, window.end) - Math.max(since, window.start));
    scaledSeconds -= BigInt(seconds) * BigInt(100 - productionPercent);
  }
  const numerator = scaledSeconds * production.production_rate + BigInt(production.remainder);
  return { amount: numerator / 100n, remainder: Number(numerator % 100n) };
}
