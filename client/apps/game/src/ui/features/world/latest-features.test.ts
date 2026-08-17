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

  it("announces live in-game rankings in the feed", () => {
    expect(latestFeatures).toContainEqual(
      expect.objectContaining({
        date: "2026-08-14",
        title: "Live In-Game Rankings",
        type: "fix",
        gameSlug: "world",
      }),
    );
  });

  it("announces battery-friendly rendering in the latest feed", () => {
    expect(latestFeatures).toContainEqual(
      expect.objectContaining({
        date: "2026-08-16",
        title: "Battery-Friendly Rendering",
        type: "improvement",
        gameSlug: "world",
      }),
    );
  });

  it("announces faster world rendering in the latest feed", () => {
    expect(latestFeatures).toContainEqual(
      expect.objectContaining({
        date: "2026-08-16",
        title: "Faster World Rendering",
        type: "improvement",
        gameSlug: "world",
      }),
    );
  });
});
