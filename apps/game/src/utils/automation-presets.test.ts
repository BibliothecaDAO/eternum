// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import {
  calculatePresetAllocations,
  getAutomationOverallocation,
  inferRealmPreset,
  REALM_PRESETS,
} from "@bibliothecadao/eternum/automation";

describe("calculatePresetAllocations", () => {
  it("returns an empty map when no resources are provided", () => {
    expect(calculatePresetAllocations([], "smart", "realm").size).toBe(0);
  });

  it("idle preset zeros every resource", () => {
    const result = calculatePresetAllocations([ResourcesIds.Wood, ResourcesIds.Coal], "idle", "realm");
    expect(result.get(ResourcesIds.Wood)).toEqual({ resourceToResource: 0, laborToResource: 0 });
    expect(result.get(ResourcesIds.Coal)).toEqual({ resourceToResource: 0, laborToResource: 0 });
  });

  it("custom preset returns an empty map (caller resolves stored values)", () => {
    const result = calculatePresetAllocations([ResourcesIds.Wood], "custom", "realm");
    expect(result.size).toBe(0);
  });
});

describe("getAutomationOverallocation", () => {
  it("returns all false when no percentages are set", () => {
    expect(getAutomationOverallocation(undefined, "realm")).toEqual({ resourceOver: false, laborOver: false });
    expect(getAutomationOverallocation({}, "realm")).toEqual({ resourceOver: false, laborOver: false });
  });

  it("skips blocked output resources (does not count Wheat/Labor as a consumer)", () => {
    const result = getAutomationOverallocation(
      {
        [ResourcesIds.Wheat]: { resourceToResource: 95, laborToResource: 0 },
        [ResourcesIds.Labor]: { resourceToResource: 95, laborToResource: 0 },
      },
      "realm",
    );
    expect(result).toEqual({ resourceOver: false, laborOver: false });
  });
});

describe("inferRealmPreset", () => {
  it("defaults to smart when no automation config is present", () => {
    expect(inferRealmPreset(undefined)).toBe("smart");
  });

  it("returns the stored presetId when set", () => {
    expect(
      inferRealmPreset({
        realmId: "1",
        entityType: "realm",
        presetId: "idle",
        autoBalance: false,
        customPercentages: {},
        createdAt: 1,
        updatedAt: 1,
      }),
    ).toBe("idle");
  });
});

describe("REALM_PRESETS", () => {
  it("exposes smart, custom, and idle entries with labels", () => {
    const ids = REALM_PRESETS.map((p) => p.id);
    expect(ids).toEqual(["smart", "custom", "idle"]);
    REALM_PRESETS.forEach((p) => expect(p.label.length).toBeGreaterThan(0));
  });
});
