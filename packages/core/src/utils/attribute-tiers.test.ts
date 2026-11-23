import { expect, it } from "vitest";
import { logisticsStamina } from "./attribute-tiers";

it("reads the Logistics stamina ladder and rejects out-of-range tiers", () => {
  expect([0, 1, 2, 3, 4, 5].map((tier) => logisticsStamina(180, tier))).toEqual([0, 36, 72, 108, 144, 180]);
  expect(() => logisticsStamina(180, -1)).toThrow("Invalid Logistics tier");
  expect(() => logisticsStamina(180, 6)).toThrow("Invalid Logistics tier");
});
