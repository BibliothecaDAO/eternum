import { describe, expect, it } from "vitest";

import { getLatestFeaturePresentation } from "./latest-feature-presentation";
import type { FeatureType } from "./latest-features";

const featureTypes: FeatureType[] = ["feature", "improvement", "balance", "fix"];

describe("latest feature presentation", () => {
  it.each(featureTypes)("%s uses explicit border colors for shared accent surfaces", (featureType) => {
    const presentation = getLatestFeaturePresentation(featureType);

    expect(presentation.badgeClassName).toMatch(/\bborder-[^\s]+/);
    expect(presentation.iconSurfaceClassName).toMatch(/\bborder-[^\s]+/);
  });
});
