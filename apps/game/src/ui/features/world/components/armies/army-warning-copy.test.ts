// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  formatArmyFoodRequirement,
  getArmyFoodRequirementLabel,
  getArmyMovementFoodRequirementWarnings,
  getArmyReadinessTitle,
  getArmyStaminaRequirementWarnings,
} from "./army-warning-copy";

describe("getArmyFoodRequirementLabel", () => {
  it("uses food wording in Eternum", () => {
    expect(getArmyFoodRequirementLabel("eternum")).toBe("food");
  });

  it("uses wheat wording in Blitz", () => {
    expect(getArmyFoodRequirementLabel("blitz")).toBe("wheat");
  });
});

describe("formatArmyFoodRequirement", () => {
  const formatAmount = (amount: number) => amount.toLocaleString("en-US");

  it("formats the mode-aware wheat/food requirement", () => {
    expect(formatArmyFoodRequirement({ missingWheat: 1250, missingFish: 0, wheatLabel: "food", formatAmount })).toBe(
      "1,250 food",
    );
    expect(formatArmyFoodRequirement({ missingWheat: 1250, missingFish: 0, wheatLabel: "wheat", formatAmount })).toBe(
      "1,250 wheat",
    );
  });

  it("keeps fish visible when it is also missing", () => {
    expect(formatArmyFoodRequirement({ missingWheat: 100, missingFish: 25, wheatLabel: "food", formatAmount })).toBe(
      "100 food and 25 fish",
    );
  });
});

describe("getArmyReadinessTitle", () => {
  it("prioritizes travel blocking stamina warnings", () => {
    expect(
      getArmyReadinessTitle({
        hasTravelStaminaWarning: true,
        hasExploreStaminaWarning: true,
        hasTravelFoodWarning: false,
        hasExploreFoodWarning: true,
      }),
    ).toBe("Travel and explore blocked");
  });

  it("reports explore blocking when only explore requirements are missing", () => {
    expect(
      getArmyReadinessTitle({
        hasTravelStaminaWarning: false,
        hasExploreStaminaWarning: false,
        hasTravelFoodWarning: false,
        hasExploreFoodWarning: true,
      }),
    ).toBe("Explore blocked");
  });

  it("reports travel blocking when only travel requirements are missing", () => {
    expect(
      getArmyReadinessTitle({
        hasTravelStaminaWarning: false,
        hasExploreStaminaWarning: false,
        hasTravelFoodWarning: true,
        hasExploreFoodWarning: false,
      }),
    ).toBe("Travel blocked");
  });
});

describe("getArmyMovementFoodRequirementWarnings", () => {
  it("blocks travel when the army cannot afford one travel food step", () => {
    const warnings = getArmyMovementFoodRequirementWarnings({
      travelFoodCosts: { wheatPayAmount: 30, fishPayAmount: 0 },
      exploreFoodCosts: { wheatPayAmount: 100, fishPayAmount: 0 },
      food: { wheat: 20, fish: 0 },
    });

    expect(warnings.travel).toEqual({ missingWheat: 10, missingFish: 0, hasWarning: true });
    expect(warnings.explore).toEqual({ missingWheat: 80, missingFish: 0, hasWarning: true });
    expect(warnings.combined).toEqual({ missingWheat: 80, missingFish: 0, hasWarning: true });
  });

  it("keeps travel ready when only the explore food requirement is short", () => {
    const warnings = getArmyMovementFoodRequirementWarnings({
      travelFoodCosts: { wheatPayAmount: 30, fishPayAmount: 0 },
      exploreFoodCosts: { wheatPayAmount: 100, fishPayAmount: 0 },
      food: { wheat: 40, fish: 0 },
    });

    expect(warnings.travel.hasWarning).toBe(false);
    expect(warnings.explore).toEqual({ missingWheat: 60, missingFish: 0, hasWarning: true });
    expect(warnings.combined).toEqual({ missingWheat: 60, missingFish: 0, hasWarning: true });
  });
});

describe("getArmyStaminaRequirementWarnings", () => {
  it("keeps explore blocked when stamina is below the explore threshold and travel is already blocked", () => {
    expect(
      getArmyStaminaRequirementWarnings({
        currentStamina: 20,
        minTravelStamina: 30,
        minExploreStamina: 30,
      }),
    ).toEqual({
      hasTravelStaminaWarning: true,
      hasExploreStaminaWarning: true,
    });
  });
});
