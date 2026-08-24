import { describe, expect, it } from "vitest";

import { TERRAIN_QUALITY_PROFILES, TERRAIN_QUALITY_TIERS } from "./terrain-quality";

describe("terrain quality tiers", () => {
  it("defines the bounded fidelity profiles used by terrain presentations", () => {
    expect(TERRAIN_QUALITY_TIERS).toHaveLength(3);
    expect(TERRAIN_QUALITY_PROFILES.detail.windStrength).toBe(1);
    expect(TERRAIN_QUALITY_PROFILES.overview.windStrength).toBeLessThan(TERRAIN_QUALITY_PROFILES.balanced.windStrength);
    expect(TERRAIN_QUALITY_PROFILES.overview.waterMotion).toBeLessThan(TERRAIN_QUALITY_PROFILES.balanced.waterMotion);
    expect(TERRAIN_QUALITY_PROFILES.overview.fogMotionStrength).toBeLessThan(
      TERRAIN_QUALITY_PROFILES.balanced.fogMotionStrength,
    );
    expect(TERRAIN_QUALITY_PROFILES.overview.fogMistStrength).toBe(0);
    expect(TERRAIN_QUALITY_PROFILES.overview.groundTextureDetail).toBe(false);
  });
});
