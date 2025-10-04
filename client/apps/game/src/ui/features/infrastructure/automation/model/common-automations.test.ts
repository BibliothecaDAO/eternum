import { describe, expect, it } from "vitest";

import { ResourcesIds } from "@bibliothecadao/types";

import { OrderMode, ProductionType } from "@/hooks/store/use-automation-store";

import { buildCommonAutomationPresets } from "./common-automations";

const baseContext = {
  realmEntityId: "1234",
  realmName: "Test Realm",
};

describe("buildCommonAutomationPresets", () => {
  it("creates a maintain wood automation when the realm can produce wood", () => {
    const presets = buildCommonAutomationPresets({
      ...baseContext,
      resourceOptions: [
        {
          id: ResourcesIds.Wood,
          name: "Wood",
        },
      ],
    });

    expect(presets).toHaveLength(1);
    const preset = presets[0];

    expect(preset.available).toBe(true);
    expect(preset.order).toBeDefined();
    expect(preset.order).toMatchObject({
      realmEntityId: baseContext.realmEntityId,
      realmName: baseContext.realmName,
      resourceToUse: ResourcesIds.Wood,
      mode: OrderMode.MaintainBalance,
      maxAmount: 1000,
      productionType: ProductionType.ResourceToResource,
      bufferPercentage: 10,
    });
  });

  it("marks the preset unavailable if wood cannot be produced", () => {
    const presets = buildCommonAutomationPresets({
      ...baseContext,
      resourceOptions: [],
    });

    expect(presets).toHaveLength(1);
    const preset = presets[0];

    expect(preset.available).toBe(false);
    expect(preset.order).toBeUndefined();
    expect(preset.unavailableReason).toBeTruthy();
  });
});
