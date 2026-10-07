import { describe, expect, it } from "vitest";
import { battleBonusBps, logisticsStamina } from "./attribute-tiers";

describe("attribute tiers", () => {
  it("reads the ruled Battle and Logistics tables, common giving nothing", () => {
    expect([1, 2, 3, 4, 5].map(battleBonusBps)).toEqual([0, 1000, 3000, 6000, 10000]);
    expect([1, 2, 3, 4, 5].map(logisticsStamina)).toEqual([0, 20, 50, 90, 150]);
    expect(() => battleBonusBps(0)).toThrow("Invalid attribute tier");
    expect(() => logisticsStamina(6)).toThrow("Invalid attribute tier");
  });
});
