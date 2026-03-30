// @vitest-environment node

import { describe, expect, it } from "vitest";

import { getAllAssets } from "./registry";

describe("audio registry", () => {
  it("registers the newly added monophonic mixtape tracks with stable music ids", () => {
    const assetIds = new Set(getAllAssets().map((asset) => asset.id));

    expect(assetIds.has("music.monophonic_mixtape_09")).toBe(true);
    expect(assetIds.has("music.monophonic_mixtape_10")).toBe(true);
    expect(assetIds.has("music.monophonic_mixtape_11")).toBe(true);
    expect(assetIds.has("music.monophonic_mixtape_12")).toBe(true);
    expect(assetIds.has("music.monophonic_mixtape_13")).toBe(true);
  });
});
