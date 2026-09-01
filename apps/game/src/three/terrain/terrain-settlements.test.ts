import { RealmLevels, StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { resolveTerrainSettlementInfluence } from "./terrain-settlements";

describe("terrain settlement influence", () => {
  it("expands and intensifies Realm disturbance with authoritative level", () => {
    const settlement = resolveTerrainSettlementInfluence(anchor(StructureType.Realm, RealmLevels.Settlement));
    const empire = resolveTerrainSettlementInfluence(anchor(StructureType.Realm, RealmLevels.Empire));

    expect(empire.radiusScale).toBeGreaterThan(settlement.radiusScale);
    expect(empire.disturbanceStrength).toBeGreaterThan(settlement.disturbanceStrength);
  });

  it("gives mines and hyperstructures stronger footprints than villages", () => {
    const village = resolveTerrainSettlementInfluence(anchor(StructureType.Village, RealmLevels.Settlement));
    const mine = resolveTerrainSettlementInfluence(anchor(StructureType.FragmentMine, RealmLevels.Settlement));
    const hyperstructure = resolveTerrainSettlementInfluence(
      anchor(StructureType.Hyperstructure, RealmLevels.Settlement),
    );

    expect(mine.disturbanceStrength).toBeGreaterThan(village.disturbanceStrength);
    expect(hyperstructure.radiusScale).toBeGreaterThan(mine.radiusScale);
  });

  it("rejects a level outside RealmLevels instead of silently choosing a footprint", () => {
    expect(() => resolveTerrainSettlementInfluence(anchor(StructureType.Realm, -1))).toThrow(
      "Terrain settlement level must be a RealmLevels value",
    );
    expect(() => resolveTerrainSettlementInfluence(anchor(StructureType.Realm, Number.NaN))).toThrow(
      "Terrain settlement level must be a RealmLevels value",
    );
  });
});

function anchor(structureType: StructureType, level: number) {
  return { col: 0, level, row: 0, structureId: "fixture", structureType };
}
