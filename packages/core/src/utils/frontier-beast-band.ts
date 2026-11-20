import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

export type BeastBand = "lowly" | "stronger";
type BeastBounds = Pick<
  NativeRows["DepthRules"],
  "beast_weak_lower" | "beast_weak_upper" | "beast_strong_lower" | "beast_strong_upper"
>;

/** Initial guard strength identifies the encounter even after casualties. */
export function beastBand(initialCount: bigint, bounds: BeastBounds): BeastBand {
  const precision = BigInt(RESOURCE_PRECISION);
  const weakLower = BigInt(bounds.beast_weak_lower) * precision;
  const weakUpper = BigInt(bounds.beast_weak_upper) * precision;
  const strongLower = BigInt(bounds.beast_strong_lower) * precision;
  const strongUpper = BigInt(bounds.beast_strong_upper) * precision;
  if (weakLower <= 0n || weakUpper < weakLower || strongLower <= weakUpper || strongUpper < strongLower)
    throw new Error("Beast depth rules require positive, separate strength ranges");
  if (initialCount >= weakLower && initialCount <= weakUpper) return "lowly";
  if (initialCount >= strongLower && initialCount <= strongUpper) return "stronger";
  throw new Error(`Initial beast strength ${initialCount} is outside its depth ranges`);
}
