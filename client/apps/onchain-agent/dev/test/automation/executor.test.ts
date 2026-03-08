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
  it("executes a build intent", async () => {
    const provider = makeProvider();
    const signer = {} as any;

    const result = await executeRealmTick({
      provider: provider as any,
      signer,
      realmEntityId: 100,
      buildIntent: {
        action: "build" as const,
        step: { building: 4, label: "CoalMine" },
        index: 2,
        slot: { col: 11, row: 10, directions: [0] },
      },
      upgradeIntent: null,
      productionCalls: null,
    });

    expect(provider.create_building).toHaveBeenCalledOnce();
    expect(result.built).toBe("CoalMine");
  });

  it("executes an upgrade intent", async () => {
    const provider = makeProvider();
    const signer = {} as any;

    const result = await executeRealmTick({
      provider: provider as any,
      signer,
      realmEntityId: 100,
      buildIntent: null,
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
      buildIntent: null,
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
      buildIntent: null,
      upgradeIntent: null,
      productionCalls: null,
    });

    expect(result.idle).toBe(true);
    expect(provider.create_building).not.toHaveBeenCalled();
    expect(provider.upgrade_realm).not.toHaveBeenCalled();
    expect(provider.execute_realm_production_plan).not.toHaveBeenCalled();
  });
});
