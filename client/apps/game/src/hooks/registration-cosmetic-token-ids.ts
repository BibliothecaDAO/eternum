import { isDevPreviewSyntheticTokenId } from "@/ui/features/cosmetics/lib/dev-preview-cosmetics";

export const resolveRegistrationCosmeticTokenIds = ({
  draft,
  maxSelections,
}: {
  draft:
    | {
        tokenIds: string[];
        selectedBySlot?: Record<string, { tokenId: string; cosmeticIds: string[] }>;
      }
    | undefined;
  maxSelections: number;
}): string[] => {
  if (!draft) {
    return [];
  }

  const validTokenIds = Object.values(draft.selectedBySlot ?? {})
    .filter((selection) => selection.tokenId && selection.cosmeticIds.length > 0)
    .map((selection) => selection.tokenId);

  const tokenIds = validTokenIds.length > 0 ? validTokenIds : draft.tokenIds;

  if (tokenIds.length > maxSelections) {
    throw new Error(`Select at most ${maxSelections} cosmetics before registering for Blitz.`);
  }

  if (tokenIds.some((tokenId) => isDevPreviewSyntheticTokenId(tokenId))) {
    throw new Error("Preview-only cosmetics cannot be registered onchain. Use Local Preview instead.");
  }

  return tokenIds;
};
