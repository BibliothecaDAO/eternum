import type { CosmeticAttachmentTemplate } from "../cosmetics";

interface StructureCosmeticRefreshRecord {
  owner: { address: bigint };
  structureType: unknown;
  stage: number;
  hexCoords: { col: number; row: number };
  cosmeticId?: string;
  cosmeticAssetPaths?: string[];
  usesFallbackCosmeticSkin?: boolean;
  attachments?: CosmeticAttachmentTemplate[];
}

interface StructureCosmeticSelection {
  skin: {
    cosmeticId: string;
    assetPaths: string[];
    isFallback: boolean;
  };
  attachments: CosmeticAttachmentTemplate[];
}

export const normalizeStructureCosmeticOwner = (owner: string | bigint): string =>
  typeof owner === "bigint"
    ? `0x${owner.toString(16)}`
    : owner.toLowerCase().startsWith("0x")
      ? owner.toLowerCase()
      : owner;

export function refreshStructureCosmeticsByOwner<TStructure extends StructureCosmeticRefreshRecord>(input: {
  owner: string | bigint;
  structuresByType: Map<unknown, Map<unknown, TStructure>>;
  resolveCosmetic: (structure: TStructure) => StructureCosmeticSelection;
  isVisible: (hexCoords: TStructure["hexCoords"]) => boolean;
}): boolean {
  const normalizedOwner = normalizeStructureCosmeticOwner(input.owner);
  let shouldRefreshVisibleStructures = false;

  input.structuresByType.forEach((structuresByHex) => {
    structuresByHex.forEach((structure) => {
      const structureOwner = `0x${structure.owner.address.toString(16)}`;
      if (structureOwner !== normalizedOwner) {
        return;
      }

      const cosmetic = input.resolveCosmetic(structure);
      structure.cosmeticId = cosmetic.skin.cosmeticId;
      structure.cosmeticAssetPaths = cosmetic.skin.assetPaths;
      structure.usesFallbackCosmeticSkin = cosmetic.skin.isFallback;
      structure.attachments = cosmetic.attachments;

      if (input.isVisible(structure.hexCoords)) {
        shouldRefreshVisibleStructures = true;
      }
    });
  });

  return shouldRefreshVisibleStructures;
}
