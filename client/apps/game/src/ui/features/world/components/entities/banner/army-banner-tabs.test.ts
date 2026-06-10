// @vitest-environment node
import { describe, expect, it } from "vitest";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

import {
  formatArmyCombatTabCue,
  formatArmyTroopCountLabel,
  shouldShowArmyResourceInventoryTab,
} from "./army-banner-tabs";
import { resolveEntityBannerRelicCue } from "./entity-banner-tab-cue";

const rawTroops = (troopCount: number) => BigInt(troopCount) * BigInt(RESOURCE_PRECISION);

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

describe("formatArmyCombatTabCue", () => {
  it("keeps small troop counts exact", () => {
    expect(formatArmyCombatTabCue(rawTroops(999))).toBe("999");
  });

  it("formats one thousand without a trailing decimal", () => {
    expect(formatArmyCombatTabCue(rawTroops(1_000))).toBe("1k");
  });

  it("formats thousands with a lowercase k suffix", () => {
    expect(formatArmyCombatTabCue(rawTroops(1_500))).toBe("1.5k");
  });

  it("rounds thousands to one decimal", () => {
    expect(formatArmyCombatTabCue(rawTroops(1_550))).toBe("1.6k");
  });

  it("formats million-scale counts with a lowercase m suffix", () => {
    expect(formatArmyCombatTabCue(rawTroops(1_500_000))).toBe("1.5m");
  });
});

describe("formatArmyTroopCountLabel", () => {
  it("formats the exact human troop count from raw precision units", () => {
    expect(formatArmyTroopCountLabel(rawTroops(1_500))).toBe("1,500 troops");
  });

  it("uses the singular troop unit for one troop", () => {
    expect(formatArmyTroopCountLabel(rawTroops(1))).toBe("1 troop");
  });
});

describe("resolveEntityBannerRelicCue", () => {
  it("disables the relic tab and hides the count cue when no relics are held", () => {
    expect(resolveEntityBannerRelicCue(0, 0)).toEqual({
      state: "empty",
      disabled: true,
    });
  });

  it("keeps stored relics clickable without marking them as usable", () => {
    expect(resolveEntityBannerRelicCue(0, 5)).toEqual({
      state: "stored",
      disabled: false,
      splitCue: {
        primary: 0,
        secondary: 5,
        state: "stored",
      },
    });
  });

  it("keeps usable relics enabled with the same count payload shape", () => {
    expect(resolveEntityBannerRelicCue(1, 3)).toEqual({
      state: "usable",
      disabled: false,
      splitCue: {
        primary: 1,
        secondary: 3,
        state: "usable",
      },
    });
  });
});
