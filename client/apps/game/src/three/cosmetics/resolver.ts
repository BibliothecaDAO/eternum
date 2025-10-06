import { playerCosmeticsStore } from "./player-cosmetics-store";
import {
  CosmeticResolutionParams,
  CosmeticResolutionResult,
  CosmeticAttachmentTemplate,
} from "./types";

const defaultAttachment: CosmeticAttachmentTemplate[] = [];

/**
 * Placeholder resolver that returns base model keys until cosmetics are populated.
 */
export function resolveCosmetic(params: CosmeticResolutionParams): CosmeticResolutionResult {
  const snapshot = playerCosmeticsStore.getSnapshot(params.owner);
  const defaultKey = `${params.kind}:${params.baseType}${params.variant ? `:${params.variant}` : ""}`;

  if (!snapshot) {
    return { modelKey: defaultKey, attachments: defaultAttachment };
  }

  if (params.kind === "army") {
    const key = `${params.baseType}${params.variant ? `:${params.variant}` : ""}`;
    const cosmeticId = snapshot.selection.armies?.[key];
    return { modelKey: cosmeticId ?? defaultKey, attachments: defaultAttachment };
  }

  if (params.kind === "structure") {
    const key = `${params.baseType}${params.variant ? `:${params.variant}` : ""}`;
    const cosmeticId = snapshot.selection.structures?.[key];
    return { modelKey: cosmeticId ?? defaultKey, attachments: defaultAttachment };
  }

  return { modelKey: defaultKey, attachments: defaultAttachment };
}
