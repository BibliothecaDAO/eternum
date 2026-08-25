import { PlayerCosmeticSelection } from "./types";
import { getCosmeticRegistry, findCosmeticById } from "./registry";

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

export const buildSelectionFromCosmeticIds = (cosmeticIds: readonly string[]): PlayerCosmeticSelection => {
  const selection: PlayerCosmeticSelection = {
    armies: {},
    structures: {},
    globalAttachments: [],
  };

  for (const cosmeticId of cosmeticIds) {
    const entry = findCosmeticById(cosmeticId);
    if (!entry) continue;

    if (entry.category === "army-skin") {
      for (const target of entry.appliesTo) {
        selection.armies![target] = {
          ...(selection.armies![target] ?? {}),
          skin: entry.id,
        };
      }
      continue;
    }

    if (entry.category === "structure-skin") {
      for (const target of entry.appliesTo) {
        selection.structures![target] = {
          ...(selection.structures![target] ?? {}),
          skin: entry.id,
        };
      }
      continue;
    }

    if (!selection.globalAttachments!.includes(entry.id)) {
      selection.globalAttachments!.push(entry.id);
    }
  }

  return selection;
};
