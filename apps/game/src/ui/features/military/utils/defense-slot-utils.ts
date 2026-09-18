import { configManager } from "@bibliothecadao/eternum";
import { GUARD_SLOT_ORDER, StructureType } from "@bibliothecadao/types";

export const MAX_GUARD_SLOT_COUNT = GUARD_SLOT_ORDER.length;

export const getStructureDefenseSlotLimit = (
  category?: StructureType,
  levelRaw?: number | bigint | null,
): number | null => {
  if (category === undefined || category === null) {
    return null;
  }

  const config = configManager.getWorldStructureDefenseSlotsConfig() as Partial<Record<StructureType, number>>;
  const level = levelRaw !== null && levelRaw !== undefined ? Number(levelRaw) : undefined;

  switch (category) {
    case StructureType.Mine:
    case StructureType.Hyperstructure:
    case StructureType.Bank:
    case StructureType.Camp:
    case StructureType.BitcoinMine:
      return config[category] ?? 0;
    case StructureType.Village:
    case StructureType.Realm:
      return typeof level === "number" && Number.isFinite(level) ? level + 1 : 0;
    default:
      return 0;
  }
};

export const getUnlockedGuardSlots = (slotLimit: number | null): number[] => {
  if (slotLimit === null || slotLimit === undefined) {
    return [];
  }

  const clampedLimit = Math.max(0, Math.min(slotLimit, MAX_GUARD_SLOT_COUNT));
  return GUARD_SLOT_ORDER.slice(0, clampedLimit).map((slot) => slot);
};
