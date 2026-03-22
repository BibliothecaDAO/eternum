// @vitest-environment node
import { describe, expect, it } from "vitest";

import { COSMETIC_ITEMS } from "@/ui/features/cosmetics/config/cosmetics.data";
import { buildDevPreviewCatalogItems } from "@/ui/features/cosmetics/lib/dev-preview-cosmetics";

describe("buildDevPreviewCatalogItems", () => {
  it("creates dev-only selectable preview items from the curated cosmetic catalog", () => {
    const previewItems = buildDevPreviewCatalogItems(COSMETIC_ITEMS.slice(0, 3));

    expect(previewItems).toHaveLength(3);
    expect(previewItems[0]).toMatchObject({
      tokenId: expect.stringMatching(/^preview:/),
      count: 1,
      attributesRaw: COSMETIC_ITEMS[0]?.attributesRaw,
    });
    expect(previewItems[0]?.slot).toBeTruthy();
    expect(previewItems[0]?.tokenSymbol).toBe("DEV");
  });
});
