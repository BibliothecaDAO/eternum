import type { CosmeticItem } from "@/ui/features/cosmetics/config/cosmetics.data";
import {
  getLocalImageFromAttributesRaw,
  getModelPathFromAttributesRaw,
  getTraitValuesFromAttributesRaw,
} from "../chest-opening/utils/cosmetics";

export const DEV_PREVIEW_TOKEN_PREFIX = "preview:";

export const isDevPreviewSyntheticTokenId = (tokenId: string | null | undefined): boolean =>
  Boolean(tokenId && tokenId.startsWith(DEV_PREVIEW_TOKEN_PREFIX));

export const buildDevPreviewCatalogItems = (items: readonly CosmeticItem[]): CosmeticItem[] =>
  items
    .filter((item): item is CosmeticItem & { attributesRaw: string } => Boolean(item.attributesRaw))
    .map((item) => {
      const attributes = getTraitValuesFromAttributesRaw(item.attributesRaw);
      const slot = attributes.find((attribute) => attribute.trait_type === "Type")?.value ?? item.slot ?? null;

      return {
        ...item,
        modelPath: getModelPathFromAttributesRaw(item.attributesRaw),
        image: item.image ?? getLocalImageFromAttributesRaw(item.attributesRaw),
        attributes,
        slot,
        tokenId: `${DEV_PREVIEW_TOKEN_PREFIX}${item.attributesRaw}`,
        tokenSymbol: "DEV",
        count: 1,
      };
    });
