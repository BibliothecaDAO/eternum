import { describe, expect, it } from "vitest";

import { resolveTerrainQualityTier, TERRAIN_QUALITY_PROFILES, TERRAIN_QUALITY_TIERS } from "./terrain-quality";

describe("terrain quality tiers", () => {
  it("maps camera bands to one bounded fidelity policy", () => {
    expect(resolveTerrainQualityTier("close")).toBe("detail");
    expect(resolveTerrainQualityTier("medium")).toBe("balanced");
    expect(resolveTerrainQualityTier("far")).toBe("overview");
    expect(TERRAIN_QUALITY_TIERS).toHaveLength(3);
    expect(TERRAIN_QUALITY_PROFILES.detail.windStrength).toBe(1);
    expect(TERRAIN_QUALITY_PROFILES.overview.windStrength).toBeLessThan(TERRAIN_QUALITY_PROFILES.balanced.windStrength);
    expect(TERRAIN_QUALITY_PROFILES.overview.waterMotion).toBeLessThan(TERRAIN_QUALITY_PROFILES.balanced.waterMotion);
    expect(TERRAIN_QUALITY_PROFILES.overview.shroudMotionStrength).toBeLessThan(
      TERRAIN_QUALITY_PROFILES.balanced.shroudMotionStrength,
    );
    expect(TERRAIN_QUALITY_PROFILES.overview.shroudMistStrength).toBe(0);
    expect(TERRAIN_QUALITY_PROFILES.overview.groundTextureDetail).toBe(false);
  });
});
