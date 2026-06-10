// @vitest-environment node

import { describe, expect, it } from "vitest";

import { latestFeatures } from "./latest-features";

describe("latestFeatures landing feed", () => {
  it("stays capped to the 8 newest entries", () => {
    expect(latestFeatures.length).toBeLessThanOrEqual(8);

    const timestamps = latestFeatures.map((feature) => new Date(feature.date).getTime());
    expect(timestamps).toEqual(timestamps.toSorted((left, right) => right - left));
  });

  it("keeps optional metadata well-typed when present", () => {
    const featureMetadata = latestFeatures as Array<{ gameSlug?: string; readMore?: string }>;

    expect(
      featureMetadata.every((feature) => feature.gameSlug === undefined || typeof feature.gameSlug === "string"),
    ).toBe(true);
    expect(
      featureMetadata.every((feature) => feature.readMore === undefined || typeof feature.readMore === "string"),
    ).toBe(true);
  });

  it("announces the latest map rendering & graphics polish in the feed", () => {
    expect(latestFeatures).toContainEqual(
      expect.objectContaining({
        date: "2026-06-05",
        title: "Map Rendering & Graphics Polish",
        type: "fix",
        gameSlug: "world",
      }),
    );
  });

  it("announces army ghost cleanup in the latest feed", () => {
    expect(latestFeatures).toContainEqual(
      expect.objectContaining({
        date: "2026-06-05",
        title: "Army Ghost Cleanup",
        type: "fix",
        gameSlug: "world",
      }),
    );
  });

  it("announces the compact realm list in the latest feed", () => {
    expect(latestFeatures).toContainEqual(
      expect.objectContaining({
        date: "2026-06-05",
        title: "Compact Realm List",
        type: "fix",
        gameSlug: "world",
      }),
    );
  });
});
