import { StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { resolveTerrainSettlementInfluence } from "./terrain-settlements";

describe("terrain settlement influence", () => {
  it("expands and intensifies Realm disturbance with authoritative level", () => {
    const settlement = resolveTerrainSettlementInfluence(anchor(StructureType.Realm, 1));
    const empire = resolveTerrainSettlementInfluence(anchor(StructureType.Realm, 4));

    expect(empire.radiusScale).toBeGreaterThan(settlement.radiusScale);
    expect(empire.disturbanceStrength).toBeGreaterThan(settlement.disturbanceStrength);
  });

  it("gives mines and hyperstructures stronger footprints than villages", () => {
    const village = resolveTerrainSettlementInfluence(anchor(StructureType.Village, 1));
    const mine = resolveTerrainSettlementInfluence(anchor(StructureType.FragmentMine, 1));
    const hyperstructure = resolveTerrainSettlementInfluence(anchor(StructureType.Hyperstructure, 1));

    expect(mine.disturbanceStrength).toBeGreaterThan(village.disturbanceStrength);
    expect(hyperstructure.radiusScale).toBeGreaterThan(mine.radiusScale);
  });

  it("rejects missing settlement levels instead of silently choosing a footprint", () => {
    expect(() => resolveTerrainSettlementInfluence(anchor(StructureType.Realm, 0))).toThrow(
      "Terrain settlement level must be a positive integer",
    );
  });
});

function anchor(structureType: StructureType, level: number) {
  return { col: 0, level, row: 0, structureId: "fixture", structureType };
}
