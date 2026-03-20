import type { ModelType } from "../types/army";
import { cosmeticDebugController, type DebugOverrideParams } from "./debug-controller";
import { ensureCosmeticAsset } from "./asset-cache";
import { playerCosmeticsStore } from "./player-cosmetics-store";
import {
  ArmyCosmeticParams,
  CosmeticAttachmentTemplate,
  CosmeticResolutionResult,
  CosmeticRegistryEntry,
  ResolvedCosmeticSkin,
  StructureCosmeticParams,
} from "./types";
import {
  findCosmeticById,
  formatArmyCosmeticFamily,
  formatArmyCosmeticTarget,
  formatStructureCosmeticTarget,
  getCosmeticRegistry,
} from "./registry";

const DEFAULT_ATTACHMENTS: CosmeticAttachmentTemplate[] = [];

const OWNER_ZERO = "0x0";

const normalizeOwner = (owner: string | bigint | undefined): string => {
  if (typeof owner === "bigint") {
    return owner === 0n ? OWNER_ZERO : `0x${owner.toString(16)}`;
  }
  if (!owner) return OWNER_ZERO;
  if (owner.startsWith("0x") || owner.startsWith("0X")) {
    return owner.toLowerCase();
  }
  try {
    const asBigInt = BigInt(owner);
    return asBigInt === 0n ? OWNER_ZERO : `0x${asBigInt.toString(16)}`;
  } catch (error) {
    console.warn(`[Cosmetics] Unable to normalise owner address ${owner}; defaulting to ${OWNER_ZERO}`, error);
    return OWNER_ZERO;
  }
};

const findEntryForTarget = (target: string): CosmeticRegistryEntry | undefined => {
  return getCosmeticRegistry().find((entry) => entry.appliesTo.includes(target));
};

const findFallbackEntry = (
  category: "army-skin" | "structure-skin",
  targets: readonly string[],
): CosmeticRegistryEntry | undefined => {
  return getCosmeticRegistry().find((entry) => {
    if (entry.category !== category) {
      return false;
    }

    return entry.appliesTo.some((target) => targets.includes(target)) && (entry.ownershipKeys?.length ?? 0) === 0;
  });
};

const isCompatibleSkinEntry = (
  entry: CosmeticRegistryEntry | undefined,
  category: "army-skin" | "structure-skin",
  target: string,
): entry is CosmeticRegistryEntry => {
  if (!entry) return false;
  return entry.category === category && entry.appliesTo.includes(target);
};

const cloneTemplate = (template: CosmeticAttachmentTemplate, fallbackSlot?: string): CosmeticAttachmentTemplate => {
  const slot = template.slot ?? fallbackSlot;
  return {
    ...template,
    slot,
  };
};

const upsertAttachments = (
  accumulator: CosmeticAttachmentTemplate[],
  templates: readonly CosmeticAttachmentTemplate[] | undefined,
  fallbackSlot?: string,
) => {
  if (!templates) return;

  templates.forEach((template) => {
    const clone = cloneTemplate(template, fallbackSlot);
    if (clone.slot) {
      const existingIndex = accumulator.findIndex((item) => item.slot === clone.slot);
      if (existingIndex >= 0) {
        accumulator.splice(existingIndex, 1);
      }
    }
    accumulator.push(clone);
  });
};

const buildSkin = (
  entry: CosmeticRegistryEntry | undefined,
  fallbackId: string,
  fallbackModelKey: string,
  fallbackModelType: ModelType | undefined,
  isFallback: boolean,
): ResolvedCosmeticSkin => {
  if (entry) {
    ensureCosmeticAsset(entry);
  }

  return {
    cosmeticId: entry?.id ?? fallbackId,
    assetPaths: entry?.assetPaths ?? [],
    isFallback,
    modelType: (entry?.metadata?.baseModelType as ModelType | undefined) ?? fallbackModelType,
    modelKey: entry?.id ?? fallbackModelKey,
    registryEntry: entry,
  };
};

const collectAttachmentEntries = (
  ids: readonly string[] | undefined,
  allowedTargets: readonly string[],
  eligibleCosmeticIds: readonly string[] | undefined,
): CosmeticRegistryEntry[] => {
  if (!ids || ids.length === 0) return [];
  const uniques = new Set<string>();

  return ids
    .map((id) => {
      if (uniques.has(id)) return undefined;
      const entry = findCosmeticById(id);
      if (!entry || entry.category !== "attachment") {
        return undefined;
      }
      if (eligibleCosmeticIds && eligibleCosmeticIds.length > 0 && !eligibleCosmeticIds.includes(id)) {
        return undefined;
      }
      if (!entry.appliesTo.some((value) => allowedTargets.includes(value))) {
        return undefined;
      }

      uniques.add(id);
      ensureCosmeticAsset(entry);
      return entry;
    })
    .filter((entry): entry is CosmeticRegistryEntry => Boolean(entry));
};

export function resolveArmyCosmetic(params: ArmyCosmeticParams): CosmeticResolutionResult {
  const owner = normalizeOwner(params.owner);
  const target = formatArmyCosmeticTarget(params.troopType, params.tier);
  const fallbackEntry = findFallbackEntry("army-skin", [target]);

  const snapshot = playerCosmeticsStore.getSnapshot(owner);
  const eligibleCosmeticIds = snapshot?.ownership.eligibleCosmeticIds ?? [];
  const armySelection = snapshot?.selection.armies?.[target];
  const selectionSkinId = typeof armySelection === "string" ? armySelection : armySelection?.skin;
  const selectionAttachments =
    typeof armySelection === "object" && armySelection ? (armySelection.attachments ?? []) : [];

  const debugOverride = cosmeticDebugController.resolveOverride({
    owner,
    kind: "army",
    baseType: params.troopType,
    variant: params.tier,
    target,
  } satisfies DebugOverrideParams);

  if (debugOverride) {
    return debugOverride;
  }

  const selectedEntry = selectionSkinId ? findCosmeticById(selectionSkinId) : undefined;
  const resolvedEntry =
    isCompatibleSkinEntry(selectedEntry, "army-skin", target) && eligibleCosmeticIds.includes(selectedEntry.id)
      ? selectedEntry
      : fallbackEntry;

  const attachments: CosmeticAttachmentTemplate[] = [];

  const allowedTargets = [target, formatArmyCosmeticFamily(params.troopType)];
  upsertAttachments(attachments, resolvedEntry?.attachments, resolvedEntry?.attachmentSlot);

  const globalAttachments = snapshot?.selection.globalAttachments ?? (snapshot?.selection as any)?.attachments ?? [];

  const attachmentEntries = [
    ...collectAttachmentEntries(globalAttachments, allowedTargets, eligibleCosmeticIds),
    ...collectAttachmentEntries(selectionAttachments, allowedTargets, eligibleCosmeticIds),
  ];

  attachmentEntries.forEach((entry) => {
    upsertAttachments(attachments, entry.attachments, entry.attachmentSlot);
  });

  const skin = buildSkin(
    resolvedEntry,
    `${target}:default`,
    target,
    params.defaultModelType,
    !resolvedEntry || resolvedEntry.id === fallbackEntry?.id,
  );
  return {
    skin,
    attachments,
    metadata: resolvedEntry?.metadata,
    cosmeticId: skin.cosmeticId,
    modelKey: skin.modelKey,
    modelType: skin.modelType,
    registryEntry: skin.registryEntry,
  };
}

export function resolveStructureCosmetic(params: StructureCosmeticParams): CosmeticResolutionResult {
  const owner = normalizeOwner(params.owner);
  const target = formatStructureCosmeticTarget(params.structureType, params.stage);
  const fallbackEntry = findFallbackEntry("structure-skin", [formatStructureCosmeticTarget(params.structureType), target]);

  const snapshot = playerCosmeticsStore.getSnapshot(owner);
  const eligibleCosmeticIds = snapshot?.ownership.eligibleCosmeticIds ?? [];
  const structureSelection = snapshot?.selection.structures?.[target];
  const selectionSkinId = typeof structureSelection === "string" ? structureSelection : structureSelection?.skin;
  const selectionAttachments =
    typeof structureSelection === "object" && structureSelection ? (structureSelection.attachments ?? []) : [];

  const debugOverride = cosmeticDebugController.resolveOverride({
    owner,
    kind: "structure",
    baseType: params.structureType,
    variant: params.stage ?? 0,
    target,
  } satisfies DebugOverrideParams);

  if (debugOverride) {
    return debugOverride;
  }

  const selectedEntry = selectionSkinId ? findCosmeticById(selectionSkinId) : undefined;
  const resolvedEntry =
    isCompatibleSkinEntry(selectedEntry, "structure-skin", target) && eligibleCosmeticIds.includes(selectedEntry.id)
      ? selectedEntry
      : fallbackEntry;

  const attachments: CosmeticAttachmentTemplate[] = [];
  const allowedTargets = [target, formatStructureCosmeticTarget(params.structureType)];

  upsertAttachments(attachments, resolvedEntry?.attachments, resolvedEntry?.attachmentSlot);

  const globalAttachments = snapshot?.selection.globalAttachments ?? (snapshot?.selection as any)?.attachments ?? [];

  const attachmentEntries = [
    ...collectAttachmentEntries(globalAttachments, allowedTargets, eligibleCosmeticIds),
    ...collectAttachmentEntries(selectionAttachments, allowedTargets, eligibleCosmeticIds),
  ];

  attachmentEntries.forEach((entry) => {
    upsertAttachments(attachments, entry.attachments, entry.attachmentSlot);
  });

  const skin = buildSkin(
    resolvedEntry,
    `${target}:default`,
    params.defaultModelKey,
    undefined,
    !resolvedEntry || resolvedEntry.id === fallbackEntry?.id,
  );
  return {
    skin,
    attachments,
    metadata: resolvedEntry?.metadata,
    cosmeticId: skin.cosmeticId,
    modelKey: skin.modelKey,
    modelType: skin.modelType,
    registryEntry: skin.registryEntry,
  };
}
