import { describe, expect, it } from "vitest";
import { ResourcesIds } from "./resource-ids";
import {
  getRelicInfo,
  RELIC_PACKS,
  relicChestDelivery,
  relicChestPack,
  relicChestRelics,
  relicEffect,
  RELICS,
} from "./relics";

describe("relic table", () => {
  it("words a recorded activation from its applied rate and radius, even when the preset differs", () => {
    expect(relicEffect(ResourcesIds.DamageRelic1, { rateBps: 1250, radius: 0 })).toBe("Increases damage by 12.5%");
    expect(relicEffect(ResourcesIds.DamageReductionRelic2, { rateBps: 3500, radius: 0 })).toBe(
      "Reduces damage taken by 35%",
    );
    expect(relicEffect(ResourcesIds.ExplorationRelic1, { rateBps: 0, radius: 3 })).toBe(
      "Instantly explores a 3-tile radius",
    );
  });

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
  it("fills a chest from its pack, and a lucky one holds the same pack at level II", () => {
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

describe("relic chest delivery", () => {
  const to = { army: "Stolsli T1", home: "Stolsli" };

  it("says where each pack's relics went: army relics to the army, structure relics to its home", () => {
    expect(relicChestDelivery(relicChestRelics({ pack: "War", lucky: false }), to)).toBe(
      "3 relics to the army Stolsli T1",
    );
    expect(relicChestDelivery(relicChestRelics({ pack: "Explore", lucky: true }), to)).toBe(
      "3 relics to the army Stolsli T1",
    );
    expect(relicChestDelivery(relicChestRelics({ pack: "Produce", lucky: false }), to)).toBe("3 relics to Stolsli");
    expect(relicChestDelivery(relicChestRelics({ pack: "Fortress", lucky: true }), to)).toBe(
      "1 relic to the army Stolsli T1, 2 to Stolsli",
    );
    expect(() => relicChestDelivery([ResourcesIds.Wood], to)).toThrow("is not a relic");
  });

  it("sends to the army exactly the relics the contract pays the army (ids below 49)", () => {
    const armyRelics = RELICS.filter((relic) => relicChestDelivery([relic.id], to).includes("the army")).map(
      ({ id }) => id,
    );
    expect(armyRelics).toEqual(RELICS.map(({ id }) => id).filter((id) => id < 49));
  });
});
