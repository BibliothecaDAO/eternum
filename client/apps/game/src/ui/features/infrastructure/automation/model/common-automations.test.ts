import { describe, expect, it } from "vitest";

import { ResourcesIds } from "@bibliothecadao/types";

import { OrderMode, ProductionType } from "@/hooks/store/use-automation-store";

import { buildCommonAutomationPresets } from "./common-automations";

const baseContext = {
  realmEntityId: "1234",
  realmName: "Test Realm",
};

const findPreset = (presets: ReturnType<typeof buildCommonAutomationPresets>, id: string) =>
  presets.find((preset) => preset.id === id);

describe("buildCommonAutomationPresets", () => {
  it("creates single-resource presets and the starter bundle when all resources are available", () => {
    const presets = buildCommonAutomationPresets({
      ...baseContext,
      resourceOptions: [
        { id: ResourcesIds.Wood, name: "Wood" },
        { id: ResourcesIds.Copper, name: "Copper" },
        { id: ResourcesIds.Coal, name: "Coal" },
      ],
    });

    expect(presets).toHaveLength(4);

    const woodPreset = findPreset(presets, "maintain-wood-1000");
    expect(woodPreset).toBeDefined();
    expect(woodPreset?.available).toBe(true);
    expect(woodPreset?.orders).toHaveLength(1);
    expect(woodPreset?.orders[0]).toMatchObject({
      realmEntityId: baseContext.realmEntityId,
      realmName: baseContext.realmName,
      resourceToUse: ResourcesIds.Wood,
      mode: OrderMode.MaintainBalance,
      maxAmount: 1000,
      productionType: ProductionType.ResourceToResource,
      bufferPercentage: 10,
    });

    const bundlePreset = findPreset(presets, "starter-resource-bootstrap");
    expect(bundlePreset).toBeDefined();
    expect(bundlePreset?.available).toBe(true);
    expect(bundlePreset?.orders).toHaveLength(3);
    expect(bundlePreset?.orders.map((order) => order.resourceToUse)).toEqual([
      ResourcesIds.Wood,
      ResourcesIds.Copper,
      ResourcesIds.Coal,
    ]);
  });

  it("marks presets unavailable when required resources are missing", () => {
    const presets = buildCommonAutomationPresets({
      ...baseContext,
      resourceOptions: [{ id: ResourcesIds.Wood, name: "Wood" }],
    });

    expect(presets).toHaveLength(4);

    const copperPreset = findPreset(presets, "maintain-copper-1000");
    expect(copperPreset).toBeDefined();
    expect(copperPreset?.available).toBe(false);
    expect(copperPreset?.orders).toHaveLength(0);
    expect(copperPreset?.unavailableReason).toContain("Copper");

    const coalPreset = findPreset(presets, "maintain-coal-1000");
    expect(coalPreset).toBeDefined();
    expect(coalPreset?.available).toBe(false);
    expect(coalPreset?.orders).toHaveLength(0);
    expect(coalPreset?.unavailableReason).toContain("Coal");

    const bundlePreset = findPreset(presets, "starter-resource-bootstrap");
    expect(bundlePreset).toBeDefined();
    expect(bundlePreset?.available).toBe(false);
    expect(bundlePreset?.orders).toHaveLength(0);
    expect(bundlePreset?.unavailableReason).toMatch(/Copper|Coal/);
  });
});
