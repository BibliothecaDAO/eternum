import { describe, expect, it } from "vitest";

import { createTerrainVerificationRequest } from "./terrain-verification-fixtures";
import { measureTerrainEcologyTransects } from "./terrain-ecology-transects";

describe("terrain ecology transects", () => {
  it("measures road core, verge, and natural-land gradients", () => {
    const stats = measureTerrainEcologyTransects(createTerrainVerificationRequest("settlement-regrowth"));

    expect(stats.roadCoreDisturbance).toBeGreaterThan(stats.roadNaturalDisturbance + 0.3);
    expect(stats.roadVergeSuccession).toBeGreaterThan(0.35);
  });

  it("measures three distinct Realm influence tiers and their regrowth ring", () => {
    const stats = measureTerrainEcologyTransects(createTerrainVerificationRequest("settlement-regrowth"));

    expect(stats.settlementTierCount).toBe(3);
    expect(stats.settlementCoreDisturbance).toBeGreaterThan(0.7);
    expect(stats.settlementEdgeSuccession).toBeGreaterThan(stats.settlementOuterMaturity);
  });

  it("measures a stronger wetland field at the tropical shoreline than inland", () => {
    const stats = measureTerrainEcologyTransects(createTerrainVerificationRequest("tropical-coast"));

    expect(stats.wetlandEdgeStrength).toBeGreaterThan(0.8);
    expect(stats.wetlandEdgeStrength).toBeGreaterThan(stats.wetlandInteriorStrength + 0.5);
  });
});
