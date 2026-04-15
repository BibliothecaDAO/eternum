// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import { executeProductionPlansSequentially, type ExecutableProductionPlan } from "./automation-runner";
import type { RealmProductionPlan } from "./automation-processor";
import type { RealmAutomationConfig } from "@/hooks/store/use-automation-store";
import type { ExecuteRealmProductionPlanProps } from "@bibliothecadao/types";

const makePlan = (realmId: number): RealmProductionPlan => ({
  realmId,
  realmKey: String(realmId),
  realmName: `Realm ${realmId}`,
  callset: {
    resourceToResource: [{ resourceId: ResourcesIds.Knight, cycles: 1 }],
    laborToResource: [],
  },
  consumptionByResource: {},
  outputsByResource: { [ResourcesIds.Knight]: 1 },
  resourceExecutions: [],
  laborExecutions: [],
  skipped: [],
  evaluatedResourceIds: [ResourcesIds.Knight],
});

const makeRealmConfig = (realmId: number): RealmAutomationConfig => ({
  realmId: String(realmId),
  realmName: `Realm ${realmId}`,
  entityType: "realm",
  presetId: "smart",
  autoBalance: true,
  customPercentages: {},
  createdAt: 1,
  updatedAt: 1,
});

const makeExecutablePlan = (realmId: number): ExecutableProductionPlan => ({
  plan: makePlan(realmId),
  realmConfig: makeRealmConfig(realmId),
  realmLabel: `Realm ${realmId}`,
  planLogPayload: {},
});

describe("executeProductionPlansSequentially", () => {
  it("executes production plans sequentially and continues after a failed realm", async () => {
    const callOrder: number[] = [];
    const executeRealmProductionPlan = vi.fn(async ({ realm_entity_id }: ExecuteRealmProductionPlanProps) => {
      const realmId = Number(realm_entity_id);
      callOrder.push(realmId);
      if (realmId === 2) {
        throw new Error("nonce too low");
      }
    });

    const results = await executeProductionPlansSequentially({
      executablePlans: [makeExecutablePlan(1), makeExecutablePlan(2), makeExecutablePlan(3)],
      signer: { address: "0xabc" } as ExecuteRealmProductionPlanProps["signer"],
      executeRealmProductionPlan,
    });

    expect(callOrder).toEqual([1, 2, 3]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
    expect(executeRealmProductionPlan).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ realm_entity_id: 1, skipQueue: true }),
    );
    expect(executeRealmProductionPlan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ realm_entity_id: 2, skipQueue: true }),
    );
    expect(executeRealmProductionPlan).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ realm_entity_id: 3, skipQueue: true }),
    );
  });
});
