import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import { absoluteEpoch } from "./expeditions";

export interface ProductionSupport {
  epochSeconds: number;
  level: number;
}

/** A realm's Support boost for a day it earned `level`, in percent of its production: none at the first level. */
export const supportBonusPercent = (level: number): number =>
  Math.max(0, level - 1) * nativeRuleConstants.ATTRIBUTE_SUPPORT_PERCENT;

/** Integrate the base rate plus the earned daily maximum, stopping its extra output at midnight. */
export function productionOutput(
  production: { last_updated_at: number; production_rate: bigint },
  timestamp: number,
  support: ProductionSupport | null,
): bigint {
  const since = production.last_updated_at;
  if (!Number.isSafeInteger(since) || !Number.isSafeInteger(timestamp)) throw new Error("Invalid production clock");
  const elapsed = Math.max(0, timestamp - since);
  const base = BigInt(elapsed) * production.production_rate;
  if (!support) return base;
  if (!Number.isInteger(support.level) || support.level < 0 || support.level > nativeRuleConstants.ATTRIBUTE_CAP)
    throw new Error("Invalid realm Support level");
  const end = (absoluteEpoch(support, since) + 1) * support.epochSeconds;
  const boostedSeconds = Math.max(0, Math.min(timestamp, end) - since);
  const bonus =
    (BigInt(boostedSeconds) * production.production_rate * BigInt(supportBonusPercent(support.level))) / 100n;
  return base + bonus;
}
