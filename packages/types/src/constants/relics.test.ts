import { describe, expect, it } from "vitest";
import { ResourcesIds } from "./resource-ids";
import {
  getRelicInfo,
  RELIC_PACKS,
  relicChestName,
  relicChestPack,
  relicChestRelics,
  relicEffect,
  RELICS,
} from "./relics";

describe("relic table", () => {
  it("words each effect from the rate the contract applies, level II doubling level I", () => {
    expect(relicEffect(ResourcesIds.LaborProductionRelic1)).toBe("Increases labor production rate by 20%");
    expect(relicEffect(ResourcesIds.LaborProductionRelic2)).toBe("Increases labor production rate by 40%");
    expect(getRelicInfo(ResourcesIds.LaborProductionRelic2)?.bonus).toBe(1.4);
    expect(relicEffect(ResourcesIds.DamageReductionRelic2)).toBe("Reduces damage taken by 40%");
    for (const relic of RELICS.filter(({ level, rateBps }) => level === 2 && rateBps > 0)) {
      expect(relic.rateBps, relic.name).toBe(2 * getRelicInfo(relic.id - 1)!.rateBps);
    }
  });
});

describe("relic chest packs", () => {
  it("names a chest by its pack, and a lucky one holds the same pack at level II", () => {
    expect(relicChestName({ pack: "War", lucky: false })).toBe("War pack");
    expect(relicChestName({ pack: "Fortress", lucky: true })).toBe("Fortress pack · lucky");
    expect(relicChestRelics({ pack: "Produce", lucky: false })).toEqual([
      ResourcesIds.ProductionRelic1,
      ResourcesIds.LaborProductionRelic1,
      ResourcesIds.TroopProductionRelic1,
    ]);
    expect(relicChestRelics({ pack: "Produce", lucky: true })).toEqual([
      ResourcesIds.ProductionRelic2,
      ResourcesIds.LaborProductionRelic2,
      ResourcesIds.TroopProductionRelic2,
    ]);
    expect(Object.values(RELIC_PACKS).reduce((sum, { oddsPercent }) => sum + oddsPercent, 0)).toBe(100);
  });

  it("reads a pack as a fact or a story carries it and refuses anything else", () => {
    expect(relicChestPack({ pack: "Explore", lucky: true })).toEqual({ pack: "Explore", lucky: true });
    expect(relicChestPack({ pack: { War: {} }, lucky: false })).toEqual({ pack: "War", lucky: false });
    expect(() => relicChestPack({ pack: "Siege", lucky: false })).toThrow("Invalid relic chest");
    expect(() => relicChestPack({ pack: "War" })).toThrow("Invalid relic chest");
  });
});
