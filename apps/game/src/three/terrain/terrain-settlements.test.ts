import { RealmLevels, StructureType } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";

import { resolvePlaceableTerrainSettlementInfluence, resolveTerrainSettlementInfluence } from "./terrain-settlements";

describe("terrain settlement influence", () => {
  it("expands and intensifies Realm disturbance with authoritative level", () => {
    const settlement = resolveTerrainSettlementInfluence(anchor(StructureType.Realm, RealmLevels.Settlement));
    const empire = resolveTerrainSettlementInfluence(anchor(StructureType.Realm, RealmLevels.Empire));

    expect(empire.radiusScale).toBeGreaterThan(settlement.radiusScale);
    expect(empire.disturbanceStrength).toBeGreaterThan(settlement.disturbanceStrength);
  });

  it("gives mines and hyperstructures stronger footprints than villages", () => {
    const village = resolveTerrainSettlementInfluence(anchor(StructureType.Village, RealmLevels.Settlement));
    const mine = resolveTerrainSettlementInfluence(anchor(StructureType.Mine, RealmLevels.Settlement));
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

  it("gives every structure category a footprint, Frontier's sites included", () => {
    const categories = Object.values(StructureType).filter(
      (value): value is StructureType => typeof value === "number",
    );
    expect(categories).toContain(StructureType.Stragglers);
    for (const category of categories) {
      const influence = resolveTerrainSettlementInfluence(anchor(category, RealmLevels.Settlement));
      expect(influence.radiusScale).toBeGreaterThan(0);
      expect(influence.disturbanceStrength).toBeGreaterThan(0);
    }
  });

  it("leaves out a settlement it cannot place, reporting it once, instead of failing the page", () => {
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    const unknownCategory = anchor(99 as StructureType, RealmLevels.Settlement);

    expect(resolvePlaceableTerrainSettlementInfluence(unknownCategory)).toBeNull();
    expect(resolvePlaceableTerrainSettlementInfluence(unknownCategory)).toBeNull();
    expect(report).toHaveBeenCalledOnce();
    expect(resolvePlaceableTerrainSettlementInfluence(anchor(StructureType.Realm, RealmLevels.City))).not.toBeNull();
    report.mockRestore();
  });
});

function anchor(structureType: StructureType, level: number) {
  return { col: 0, level, row: 0, structureId: "fixture", structureType };
}
