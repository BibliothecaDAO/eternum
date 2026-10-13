import { byStructureCategory } from "@/lib/structure-category-table";
import { configManager } from "@bibliothecadao/eternum";
import { GUARD_SLOT_ORDER, StructureType } from "@bibliothecadao/types";

export const MAX_GUARD_SLOT_COUNT = GUARD_SLOT_ORDER.length;

/**
 * Where a structure's guard slots come from, by category: one more than its level, or the count the world fixes for
 * the category. A new category fails typecheck here until it is given its rule.
 */
const GUARD_SLOT_RULES: Record<StructureType, "by-level" | "fixed"> = {
  [StructureType.Realm]: "by-level",
  [StructureType.Village]: "by-level",
  [StructureType.Mine]: "fixed",
  [StructureType.Hyperstructure]: "fixed",
  [StructureType.Bank]: "fixed",
  [StructureType.Camp]: "fixed",
  [StructureType.BitcoinMine]: "fixed",
  [StructureType.Rift]: "fixed",
  [StructureType.Ruin]: "fixed",
  [StructureType.Stragglers]: "fixed",
};

export const getStructureDefenseSlotLimit = (
  category?: StructureType,
  levelRaw?: number | bigint | null,
): number | null => {
  if (category === undefined || category === null) {
    return null;
  }

  // A category this build does not know has no rule: its slots are unknown, never a zero a fight would be read by.
  const rule = byStructureCategory<"by-level" | "fixed" | null>(GUARD_SLOT_RULES, category, "guard slot rule", null);
  if (rule === null) return null;
  if (rule === "fixed") return configManager.getWorldStructureDefenseSlotsConfig()[category as FixedSlotCategory];
  const level = levelRaw !== null && levelRaw !== undefined ? Number(levelRaw) : undefined;
  return typeof level === "number" && Number.isFinite(level) ? level + 1 : null;
};

type FixedSlotCategory = keyof ReturnType<typeof configManager.getWorldStructureDefenseSlotsConfig>;

export const getUnlockedGuardSlots = (slotLimit: number | null): number[] => {
  if (slotLimit === null || slotLimit === undefined) {
    return [];
  }

  const clampedLimit = Math.max(0, Math.min(slotLimit, MAX_GUARD_SLOT_COUNT));
  return GUARD_SLOT_ORDER.slice(0, clampedLimit).map((slot) => slot);
};
