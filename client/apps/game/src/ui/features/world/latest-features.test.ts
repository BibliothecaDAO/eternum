// @vitest-environment node

import { describe, expect, it } from "vitest";

import { latestFeatures } from "./latest-features";

describe("latestFeatures landing feed", () => {
  it("stays capped to the 10 newest entries", () => {
    expect(latestFeatures.length).toBeLessThanOrEqual(10);

    const timestamps = latestFeatures.map((feature) => new Date(feature.date).getTime());
    expect(timestamps).toEqual([...timestamps].sort((left, right) => right - left));
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

  it("announces explore arrival previews in the latest feed", () => {
    expect(latestFeatures).toContainEqual(
      expect.objectContaining({
        date: "2026-05-25",
        title: "Explore Arrival Previews",
        type: "improvement",
        gameSlug: "world",
      }),
    );
  });

  it("announces unit creation ghosts in the latest feed", () => {
    expect(latestFeatures).toContainEqual(
      expect.objectContaining({
        date: "2026-05-26",
        title: "Unit Creation Ghosts",
        type: "improvement",
        gameSlug: "world",
      }),
    );
  });
});
