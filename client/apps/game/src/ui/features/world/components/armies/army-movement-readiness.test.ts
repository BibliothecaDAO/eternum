import { describe, expect, it } from "vitest";

import { deriveArmyMovementReadiness } from "./army-movement-readiness";
import { formatTravelBlockedSummary } from "./army-warning-copy";

const READY_INPUTS = {
  currentStamina: 90,
  minTravelStamina: 20,
  minExploreStamina: 30,
  travelFoodCosts: { wheatPayAmount: 500, fishPayAmount: 0 },
  exploreFoodCosts: { wheatPayAmount: 1_000, fishPayAmount: 0 },
  food: { wheat: 2_000, fish: 0 },
};

describe("deriveArmyMovementReadiness", () => {
  it("is fully ready when stamina and food cover both actions", () => {
    const readiness = deriveArmyMovementReadiness(READY_INPUTS);
    expect(readiness.canTravel).toBe(true);
    expect(readiness.canExplore).toBe(true);
  });

  it("blocks travel on missing wheat even at high stamina (the red-bar case)", () => {
    const readiness = deriveArmyMovementReadiness({
      ...READY_INPUTS,
      food: { wheat: 100, fish: 0 },
    });
    expect(readiness.canTravel).toBe(false);
    expect(readiness.hasTravelStaminaWarning).toBe(false);
    expect(readiness.foodWarnings.travel.missingWheat).toBe(400);
  });

  it("keeps travel open when only the pricier explore is food-blocked", () => {
    const readiness = deriveArmyMovementReadiness({
      ...READY_INPUTS,
      food: { wheat: 700, fish: 0 },
    });
    expect(readiness.canTravel).toBe(true);
    expect(readiness.canExplore).toBe(false);
  });

  it("blocks travel below the cheapest neighbor's stamina cost", () => {
    const readiness = deriveArmyMovementReadiness({
      ...READY_INPUTS,
      currentStamina: 10,
    });
    expect(readiness.canTravel).toBe(false);
    expect(readiness.hasTravelStaminaWarning).toBe(true);
  });

  it("treats an unknown food balance (Infinity) as never blocking", () => {
    const readiness = deriveArmyMovementReadiness({
      ...READY_INPUTS,
      food: { wheat: Number.POSITIVE_INFINITY, fish: Number.POSITIVE_INFINITY },
    });
    expect(readiness.canTravel).toBe(true);
    expect(readiness.foodWarnings.combined.hasWarning).toBe(false);
  });
});

describe("formatTravelBlockedSummary", () => {
  const formatAmount = (amount: number) => `${amount}`;

  it("names both missing stamina and missing wheat", () => {
    expect(
      formatTravelBlockedSummary({
        staminaBlocked: true,
        minTravelStamina: 25,
        missingWheat: 1_240,
        missingFish: 0,
        wheatLabel: "wheat",
        formatAmount,
      }),
    ).toBe("Cannot travel — needs 25+ stamina and 1240 wheat");
  });

  it("returns null when nothing is missing", () => {
    expect(
      formatTravelBlockedSummary({
        staminaBlocked: false,
        minTravelStamina: 25,
        missingWheat: 0,
        missingFish: 0,
        wheatLabel: "wheat",
        formatAmount,
      }),
    ).toBeNull();
  });
});
