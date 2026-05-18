// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  formatArmyFoodRequirement,
  getArmyFoodRequirementLabel,
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
        notEnoughFood: true,
      }),
    ).toBe("Travel and explore blocked");
  });

  it("reports explore blocking when only explore requirements are missing", () => {
    expect(
      getArmyReadinessTitle({
        hasTravelStaminaWarning: false,
        hasExploreStaminaWarning: false,
        notEnoughFood: true,
      }),
    ).toBe("Explore blocked");
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
