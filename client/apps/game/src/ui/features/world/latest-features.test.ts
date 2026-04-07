import { describe, expect, it } from "vitest";

import { latestFeatures } from "./latest-features";

describe("latestFeatures landing feed", () => {
  it("stays capped to the 10 newest entries", () => {
    expect(latestFeatures.length).toBeLessThanOrEqual(10);

    const timestamps = latestFeatures.map((feature) => new Date(feature.date).getTime());
    expect(timestamps).toEqual([...timestamps].sort((left, right) => right - left));
  });

  it("supports game-linked entries and optional read-more links", () => {
    const featureMetadata = latestFeatures as Array<{ gameSlug?: string; readMore?: string }>;

    expect(featureMetadata.some((feature) => Boolean(feature.gameSlug))).toBe(true);
    expect(featureMetadata.some((feature) => Boolean(feature.readMore))).toBe(true);
  });
});
