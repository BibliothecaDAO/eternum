// @vitest-environment node
import { describe, expect, it } from "vitest";

import { shouldShowArmyResourceInventoryTab } from "./army-banner-tabs";

describe("shouldShowArmyResourceInventoryTab", () => {
  it("keeps the inventory tab available in Eternum even when the army is empty", () => {
    expect(shouldShowArmyResourceInventoryTab("eternum", 0)).toBe(true);
  });

  it("hides the inventory tab in Blitz when no non-relic resources are carried", () => {
    expect(shouldShowArmyResourceInventoryTab("blitz", 0)).toBe(false);
  });

  it("shows the inventory tab in Blitz when non-relic resources are present", () => {
    expect(shouldShowArmyResourceInventoryTab("blitz", 2)).toBe(true);
  });

  it("does not show an empty inventory tab while the mode is unresolved", () => {
    expect(shouldShowArmyResourceInventoryTab("unknown", 0)).toBe(false);
  });
});
