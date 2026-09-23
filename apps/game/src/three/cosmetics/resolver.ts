import type { ModelType } from "../types/army";
import { cosmeticDebugController, type DebugOverrideParams } from "./debug-controller";
import { ensureCosmeticAsset } from "./asset-cache";
import {
  ArmyCosmeticParams,
  CosmeticAttachmentTemplate,
  CosmeticResolutionResult,
  CosmeticRegistryEntry,
  ResolvedCosmeticSkin,
  StructureCosmeticParams,
} from "./types";
import { formatArmyCosmeticTarget, formatStructureCosmeticTarget, getCosmeticRegistry } from "./registry";

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

/** A default skin with its own attachments; player cosmetics return with plan 08. */
const defaultCosmetic = (
  entry: CosmeticRegistryEntry | undefined,
  fallbackId: string,
  fallbackModelKey: string,
  fallbackModelType: ModelType | undefined,
): CosmeticResolutionResult => {
  const attachments: CosmeticAttachmentTemplate[] = [];
  upsertAttachments(attachments, entry?.attachments, entry?.attachmentSlot);
  return {
    skin: buildSkin(entry, fallbackId, fallbackModelKey, fallbackModelType, true),
    attachments,
    metadata: entry?.metadata,
  };
};

/** An army wears its default skin unless the debug controller overrides it. */
export function resolveArmyCosmetic(params: ArmyCosmeticParams): CosmeticResolutionResult {
  const target = formatArmyCosmeticTarget(params.troopType, params.tier);
  const debugOverride = cosmeticDebugController.resolveOverride({
    owner: normalizeOwner(params.owner),
    kind: "army",
    baseType: params.troopType,
    variant: params.tier,
    target,
  } satisfies DebugOverrideParams);
  if (debugOverride) return debugOverride;
  return defaultCosmetic(
    findFallbackEntry("army-skin", [target]),
    `${target}:default`,
    target,
    params.defaultModelType,
  );
}

/** A structure wears its default skin unless the debug controller overrides it. */
export function resolveStructureCosmetic(params: StructureCosmeticParams): CosmeticResolutionResult {
  const target = formatStructureCosmeticTarget(params.structureType, params.stage);
  const debugOverride = cosmeticDebugController.resolveOverride({
    owner: normalizeOwner(params.owner),
    kind: "structure",
    baseType: params.structureType,
    variant: params.stage ?? 0,
    target,
  } satisfies DebugOverrideParams);
  if (debugOverride) return debugOverride;
  const entry = findFallbackEntry("structure-skin", [formatStructureCosmeticTarget(params.structureType), target]);
  return defaultCosmetic(entry, `${target}:default`, params.defaultModelKey, undefined);
}
