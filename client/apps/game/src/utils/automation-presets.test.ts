// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";
import {
  calculatePresetAllocations,
  getAutomationOverallocation,
  inferRealmPreset,
  REALM_PRESETS,
} from "./automation-presets";

const snapshotInputs = () => ({
  complex: { ...configManager.complexSystemResourceInputs },
  simple: { ...configManager.simpleSystemResourceInputs },
});

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

  it("smart with incomplete T1 uses labor slider at 5%", () => {
    const result = calculatePresetAllocations([ResourcesIds.Wood, ResourcesIds.Copper], "smart", "realm");
    expect(result.get(ResourcesIds.Wood)).toEqual({ resourceToResource: 0, laborToResource: 5 });
    expect(result.get(ResourcesIds.Copper)).toEqual({ resourceToResource: 0, laborToResource: 5 });
  });

  it("smart with complete T1 and no higher tiers uses 30% resource slider", () => {
    const result = calculatePresetAllocations(
      [ResourcesIds.Wood, ResourcesIds.Copper, ResourcesIds.Coal],
      "smart",
      "realm",
    );
    expect(result.get(ResourcesIds.Wood)).toEqual({ resourceToResource: 30, laborToResource: 0 });
    expect(result.get(ResourcesIds.Copper)).toEqual({ resourceToResource: 30, laborToResource: 0 });
    expect(result.get(ResourcesIds.Coal)).toEqual({ resourceToResource: 30, laborToResource: 0 });
  });

  it("smart with complete T1 and an army downshifts T1 to 20/20/30", () => {
    const result = calculatePresetAllocations(
      [ResourcesIds.Wood, ResourcesIds.Copper, ResourcesIds.Coal, ResourcesIds.Knight],
      "smart",
      "realm",
    );
    expect(result.get(ResourcesIds.Wood)).toEqual({ resourceToResource: 20, laborToResource: 0 });
    expect(result.get(ResourcesIds.Coal)).toEqual({ resourceToResource: 20, laborToResource: 0 });
    expect(result.get(ResourcesIds.Copper)).toEqual({ resourceToResource: 30, laborToResource: 0 });
    // Army T1 alone (no higher tiers) gets 30/20/10 sequentially; here only Knight is present → 30%.
    expect(result.get(ResourcesIds.Knight)).toEqual({ resourceToResource: 30, laborToResource: 0 });
  });

  it("smart weights army T3 highest and drops T1 to 10/5/3 when T3 present", () => {
    const result = calculatePresetAllocations(
      [ResourcesIds.Wood, ResourcesIds.Copper, ResourcesIds.Coal, ResourcesIds.Knight, ResourcesIds.KnightT3],
      "smart",
      "realm",
    );
    expect(result.get(ResourcesIds.KnightT3)?.resourceToResource).toBe(50);
    expect(result.get(ResourcesIds.Knight)?.resourceToResource).toBe(10);
  });

  it("smart filters blocked output resources (Wheat, Labor)", () => {
    const result = calculatePresetAllocations(
      [ResourcesIds.Wood, ResourcesIds.Wheat, ResourcesIds.Labor],
      "smart",
      "realm",
    );
    expect(result.has(ResourcesIds.Wheat)).toBe(false);
    expect(result.has(ResourcesIds.Labor)).toBe(false);
    expect(result.has(ResourcesIds.Wood)).toBe(true);
  });

  it("smart gives Donkey market a 5% resource allocation and no labor", () => {
    const result = calculatePresetAllocations([ResourcesIds.Wood, ResourcesIds.Donkey], "smart", "realm");
    expect(result.get(ResourcesIds.Donkey)).toEqual({ resourceToResource: 5, laborToResource: 0 });
  });

  it("smart includes resources without a tier weighting as zero entries", () => {
    const result = calculatePresetAllocations(
      [ResourcesIds.Wood, ResourcesIds.Donkey, ResourcesIds.Fish],
      "smart",
      "realm",
    );
    expect(result.get(ResourcesIds.Donkey)).toEqual({ resourceToResource: 5, laborToResource: 0 });
    // Fish is not in any tier; must still be present and zeroed.
    expect(result.get(ResourcesIds.Fish)).toEqual({ resourceToResource: 0, laborToResource: 0 });
  });

  it("smart dedupes repeated resource ids", () => {
    const result = calculatePresetAllocations(
      [ResourcesIds.Wood, ResourcesIds.Wood, ResourcesIds.Copper, ResourcesIds.Copper, ResourcesIds.Coal],
      "smart",
      "realm",
    );
    expect(result.size).toBe(3);
  });
});

describe("getAutomationOverallocation", () => {
  let snapshot: ReturnType<typeof snapshotInputs>;

  beforeEach(() => {
    snapshot = snapshotInputs();
    // Set up a tiny synthetic recipe table: Knight (complex) needs Wood+Coal.
    configManager.complexSystemResourceInputs[ResourcesIds.Knight] = [
      { resource: ResourcesIds.Wood, amount: 1 },
      { resource: ResourcesIds.Coal, amount: 1 },
    ];
    configManager.complexSystemResourceInputs[ResourcesIds.Crossbowman] = [{ resource: ResourcesIds.Wood, amount: 1 }];
    configManager.simpleSystemResourceInputs[ResourcesIds.Knight] = [{ resource: ResourcesIds.Copper, amount: 1 }];
  });

  afterEach(() => {
    configManager.complexSystemResourceInputs = snapshot.complex;
    configManager.simpleSystemResourceInputs = snapshot.simple;
  });

  it("returns all false when no percentages are set", () => {
    expect(getAutomationOverallocation(undefined, "realm")).toEqual({ resourceOver: false, laborOver: false });
    expect(getAutomationOverallocation({}, "realm")).toEqual({ resourceOver: false, laborOver: false });
  });

  it("flags resourceOver when the combined resource-slider draw on an input exceeds MAX", () => {
    // Knight r2r=50, Crossbowman r2r=50 both draw from Wood → 100% total > 90%.
    const result = getAutomationOverallocation(
      {
        [ResourcesIds.Knight]: { resourceToResource: 50, laborToResource: 0 },
        [ResourcesIds.Crossbowman]: { resourceToResource: 50, laborToResource: 0 },
      },
      "realm",
    );
    expect(result.resourceOver).toBe(true);
    expect(result.laborOver).toBe(false);
  });

  it("does not flag when per-input totals stay within MAX", () => {
    const result = getAutomationOverallocation(
      {
        [ResourcesIds.Knight]: { resourceToResource: 30, laborToResource: 0 },
        [ResourcesIds.Crossbowman]: { resourceToResource: 30, laborToResource: 0 },
      },
      "realm",
    );
    expect(result).toEqual({ resourceOver: false, laborOver: false });
  });

  it("flags laborOver separately from resourceOver", () => {
    const result = getAutomationOverallocation(
      {
        [ResourcesIds.Knight]: { resourceToResource: 0, laborToResource: 95 },
      },
      "realm",
    );
    expect(result.laborOver).toBe(true);
    expect(result.resourceOver).toBe(false);
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
