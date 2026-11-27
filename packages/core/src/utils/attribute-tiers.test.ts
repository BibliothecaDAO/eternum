import { expect, it } from "vitest";
import { logisticsStamina } from "./attribute-tiers";

it("reads the Logistics stamina ladder and rejects out-of-range tiers", () => {
  expect([0, 1, 2, 3, 4, 5].map((tier) => logisticsStamina(tier))).toEqual([0, 30, 60, 90, 120, 150]);
  expect(() => logisticsStamina(-1)).toThrow("Invalid Logistics tier");
  expect(() => logisticsStamina(6)).toThrow("Invalid Logistics tier");
});
