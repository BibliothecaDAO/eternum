import type { StructureType } from "@bibliothecadao/types";

const reported = new Set<string>();

/**
 * A value kept per structure category. The table names every category, so a new one fails typecheck until it is given
 * a value. The chain can still hold a category this build was not compiled with: that miss is reported once, with
 * what was being looked up, and answered with the caller's plain value instead of a silent default.
 */
export function byStructureCategory<Value>(
  table: Record<StructureType, Value>,
  category: StructureType | number,
  lookup: string,
  unknown: Value,
): Value {
  if (Object.hasOwn(table, category)) return table[category as StructureType];
  const miss = `${lookup}:${String(category)}`;
  if (!reported.has(miss)) {
    reported.add(miss);
    console.error(`[StructureCategory] No ${lookup} for structure category ${String(category)}`);
  }
  return unknown;
}
