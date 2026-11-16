import { expect, it } from "vitest";
import { logisticsStamina } from "./attribute-tiers";

it("reads the Logistics stamina ladder and rejects out-of-range tiers", () => {
  expect([0, 1, 2, 3, 4, 5].map(logisticsStamina)).toEqual([0, 20, 45, 75, 110, 150]);
  expect(() => logisticsStamina(-1)).toThrow("Invalid Logistics tier");
  expect(() => logisticsStamina(6)).toThrow("Invalid Logistics tier");
});
