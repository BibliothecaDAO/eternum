import { describe, expect, it } from "vitest";
import { ResourcesIds } from "./resource-ids";
import { getRelicInfo, relicEffect, RELICS } from "./relics";

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
