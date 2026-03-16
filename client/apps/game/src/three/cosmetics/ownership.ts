import { getCosmeticRegistry } from "./registry";

const normalizeOwnershipKey = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "0x0";
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;

  try {
    return `0x${BigInt(normalized).toString(16)}`;
  } catch {
    return normalized;
  }
};

export const resolveEligibleCosmeticIds = (ownedAttrs: readonly string[]): string[] => {
  const normalizedAttrs = new Set(ownedAttrs.map(normalizeOwnershipKey));
  const eligibleCosmeticIds: string[] = [];

  for (const entry of getCosmeticRegistry()) {
    const ownershipKeys = entry.ownershipKeys?.map(normalizeOwnershipKey) ?? [];
    if (ownershipKeys.some((ownershipKey) => normalizedAttrs.has(ownershipKey))) {
      eligibleCosmeticIds.push(entry.id);
    }
  }

  return eligibleCosmeticIds;
};
