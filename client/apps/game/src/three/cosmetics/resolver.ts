import type { ModelType } from "../types/army";
import { cosmeticDebugController } from "./debug-controller";
import { ensureCosmeticAsset } from "./asset-cache";
import { playerCosmeticsStore } from "./player-cosmetics-store";
import {
  ArmyCosmeticParams,
  CosmeticAttachmentTemplate,
  CosmeticResolutionResult,
  CosmeticRegistryEntry,
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

const buildResult = (
  entry: CosmeticRegistryEntry | undefined,
  fallbackId: string,
  fallbackModelKey: string,
  fallbackModelType: ModelType | undefined,
  attachments: CosmeticAttachmentTemplate[],
): CosmeticResolutionResult => {
  if (entry) {
    ensureCosmeticAsset(entry);
  }

  return {
    cosmeticId: entry?.id ?? fallbackId,
    modelKey: entry?.id ?? fallbackModelKey,
    modelType: (entry?.metadata?.baseModelType as ModelType | undefined) ?? fallbackModelType,
    attachments,
    registryEntry: entry,
    metadata: entry?.metadata,
  };
};

const collectAttachmentEntries = (
  ids: readonly string[] | undefined,
  allowedTargets: readonly string[],
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
  const fallbackEntry = findEntryForTarget(target);

  const snapshot = playerCosmeticsStore.getSnapshot(owner);
  const armySelection = snapshot?.selection.armies?.[target];
  const selectionSkinId =
    typeof armySelection === "string" ? armySelection : armySelection?.skin;
  const selectionAttachments =
    typeof armySelection === "object" && armySelection
      ? armySelection.attachments ?? []
      : [];

  const debugOverride = cosmeticDebugController.resolveOverride?.({
    owner,
    kind: "army",
    baseType: params.troopType,
    variant: params.tier,
    target,
  } as any);

  if (debugOverride) {
    return debugOverride;
  }

  const resolvedEntry = (selectionSkinId ? findCosmeticById(selectionSkinId) : undefined) ?? fallbackEntry;

  const attachments: CosmeticAttachmentTemplate[] = [];

  const allowedTargets = [target, formatArmyCosmeticFamily(params.troopType)];
  upsertAttachments(attachments, resolvedEntry?.attachments, resolvedEntry?.attachmentSlot);

  const globalAttachments =
    snapshot?.selection.globalAttachments ?? (snapshot?.selection as any)?.attachments ?? [];

  const attachmentEntries = [
    ...collectAttachmentEntries(globalAttachments, allowedTargets),
    ...collectAttachmentEntries(selectionAttachments, allowedTargets),
  ];

  attachmentEntries.forEach((entry) => {
    upsertAttachments(attachments, entry.attachments, entry.attachmentSlot);
  });

  return buildResult(resolvedEntry, `${target}:default`, target, params.defaultModelType, attachments);
}

export function resolveStructureCosmetic(params: StructureCosmeticParams): CosmeticResolutionResult {
  const owner = normalizeOwner(params.owner);
  const target = formatStructureCosmeticTarget(params.structureType, params.stage);
  const fallbackEntry = findEntryForTarget(target) ?? findEntryForTarget(formatStructureCosmeticTarget(params.structureType));

  const snapshot = playerCosmeticsStore.getSnapshot(owner);
  const structureSelection = snapshot?.selection.structures?.[target];
  const selectionSkinId =
    typeof structureSelection === "string" ? structureSelection : structureSelection?.skin;
  const selectionAttachments =
    typeof structureSelection === "object" && structureSelection
      ? structureSelection.attachments ?? []
      : [];

  const debugOverride = cosmeticDebugController.resolveOverride?.({
    owner,
    kind: "structure",
    baseType: params.structureType,
    variant: params.stage,
    target,
  } as any);

  if (debugOverride) {
    return debugOverride;
  }

  const resolvedEntry = (selectionSkinId ? findCosmeticById(selectionSkinId) : undefined) ?? fallbackEntry;

  const attachments: CosmeticAttachmentTemplate[] = [];
  const allowedTargets = [target, formatStructureCosmeticTarget(params.structureType)];

  upsertAttachments(attachments, resolvedEntry?.attachments, resolvedEntry?.attachmentSlot);

  const globalAttachments =
    snapshot?.selection.globalAttachments ?? (snapshot?.selection as any)?.attachments ?? [];

  const attachmentEntries = [
    ...collectAttachmentEntries(globalAttachments, allowedTargets),
    ...collectAttachmentEntries(selectionAttachments, allowedTargets),
  ];

  attachmentEntries.forEach((entry) => {
    upsertAttachments(attachments, entry.attachments, entry.attachmentSlot);
  });

  return buildResult(resolvedEntry, `${target}:default`, params.defaultModelKey, undefined, attachments);
}
