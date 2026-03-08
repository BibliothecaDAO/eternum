import { describe, it, expect, vi } from "vitest";
import { executeRealmTick } from "../../../src/automation/executor.js";

function makeProvider() {
  return {
    create_building: vi.fn().mockResolvedValue({}),
    upgrade_realm: vi.fn().mockResolvedValue({}),
    execute_realm_production_plan: vi.fn().mockResolvedValue({}),
  };
}

describe("executeRealmTick", () => {
  it("executes a single build action", async () => {
    const provider = makeProvider();
    const signer = {} as any;

    const result = await executeRealmTick({
      provider: provider as any,
      signer,
      realmEntityId: 100,
      buildActions: [{
        step: { building: 4, label: "CoalMine" },
        slot: { col: 11, row: 10, directions: [0] },
        useSimple: false,
      }],
      upgradeIntent: null,
      productionCalls: null,
    });

    expect(provider.create_building).toHaveBeenCalledOnce();
    expect(result.built).toEqual(["CoalMine"]);
  });

  it("executes multiple build actions in parallel", async () => {
    const provider = makeProvider();
    const signer = {} as any;

    const result = await executeRealmTick({
      provider: provider as any,
      signer,
      realmEntityId: 100,
      buildActions: [
        { step: { building: 4, label: "CoalMine" }, slot: { col: 11, row: 10, directions: [0] }, useSimple: false },
        { step: { building: 5, label: "WoodMill" }, slot: { col: 9, row: 10, directions: [3] }, useSimple: false },
        { step: { building: 6, label: "CopperSmelter" }, slot: { col: 10, row: 11, directions: [1] }, useSimple: true },
      ],
      upgradeIntent: null,
      productionCalls: null,
    });

    expect(provider.create_building).toHaveBeenCalledTimes(3);
    expect(result.built).toEqual(["CoalMine", "WoodMill", "CopperSmelter"]);
    expect(result.idle).toBe(false);
  });

  it("executes an upgrade intent", async () => {
    const provider = makeProvider();
    const signer = {} as any;

    const result = await executeRealmTick({
      provider: provider as any,
      signer,
      realmEntityId: 100,
      buildActions: [],
      upgradeIntent: { fromLevel: 1, fromName: "Settlement", toName: "City" },
      productionCalls: null,
    });

    expect(provider.upgrade_realm).toHaveBeenCalledOnce();
    expect(result.upgraded).toBe("Settlement → City");
  });

  it("executes production calls", async () => {
    const provider = makeProvider();
    const signer = {} as any;

    const result = await executeRealmTick({
      provider: provider as any,
      signer,
      realmEntityId: 100,
      buildActions: [],
      upgradeIntent: null,
      productionCalls: {
        resourceToResource: [{ resource_id: 3, cycles: 10 }],
        laborToResource: [{ resource_id: 4, cycles: 5 }],
      },
    });

    expect(provider.execute_realm_production_plan).toHaveBeenCalledOnce();
    expect(result.produced).toBe(true);
  });

  it("returns idle when nothing to do", async () => {
    const provider = makeProvider();
    const signer = {} as any;

    const result = await executeRealmTick({
      provider: provider as any,
      signer,
      realmEntityId: 100,
      buildActions: [],
      upgradeIntent: null,
      productionCalls: null,
    });

    expect(result.idle).toBe(true);
    expect(provider.create_building).not.toHaveBeenCalled();
    expect(provider.upgrade_realm).not.toHaveBeenCalled();
    expect(provider.execute_realm_production_plan).not.toHaveBeenCalled();
  });
});
