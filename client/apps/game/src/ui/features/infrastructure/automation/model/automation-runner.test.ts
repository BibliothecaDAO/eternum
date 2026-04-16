// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import {
  AutomationCancelledError,
  AutomationSignerSkippedError,
  AutomationTimeoutError,
  executeProductionPlansSequentially,
  isSignerTransientError,
  type ExecutableProductionPlan,
} from "./automation-runner";
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
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("times out a stuck realm tx and continues to the next realm", async () => {
    const callOrder: number[] = [];
    const executeRealmProductionPlan = vi.fn(async ({ realm_entity_id }: ExecuteRealmProductionPlanProps) => {
      const realmId = Number(realm_entity_id);
      callOrder.push(realmId);
      if (realmId === 1) {
        return new Promise(() => {});
      }
    });

    const resultsPromise = executeProductionPlansSequentially({
      executablePlans: [makeExecutablePlan(1), makeExecutablePlan(2)],
      signer: { address: "0xabc" } as ExecuteRealmProductionPlanProps["signer"],
      executeRealmProductionPlan,
      timeoutMs: 50,
    });

    await vi.advanceTimersByTimeAsync(51);
    const results = await resultsPromise;

    expect(callOrder).toEqual([1, 2]);
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("rejected");
    if (results[0].status === "rejected") {
      expect(results[0].reason.error).toBeInstanceOf(AutomationTimeoutError);
    }
    expect(results[1].status).toBe("fulfilled");
  });

  it("skips a realm when isCancelled returns realm scope and continues the rest", async () => {
    vi.useRealTimers();
    const executed: number[] = [];
    const executeRealmProductionPlan = vi.fn(async ({ realm_entity_id }: ExecuteRealmProductionPlanProps) => {
      executed.push(Number(realm_entity_id));
    });

    const results = await executeProductionPlansSequentially({
      executablePlans: [makeExecutablePlan(1), makeExecutablePlan(2), makeExecutablePlan(3)],
      signer: { address: "0xabc" } as ExecuteRealmProductionPlanProps["signer"],
      executeRealmProductionPlan,
      isCancelled: ({ plan }) =>
        plan.realmId === 2
          ? { cancelled: true, reason: "Realm no longer owned", scope: "realm" }
          : { cancelled: false },
    });

    expect(executed).toEqual([1, 3]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
    const skipped = results[1];
    if (skipped.status === "rejected") {
      expect(skipped.reason.error).toBeInstanceOf(AutomationCancelledError);
      expect((skipped.reason.error as AutomationCancelledError).scope).toBe("realm");
    }
  });

  it("aborts remaining realms when isCancelled returns pass scope", async () => {
    vi.useRealTimers();
    const executed: number[] = [];
    const executeRealmProductionPlan = vi.fn(async ({ realm_entity_id }: ExecuteRealmProductionPlanProps) => {
      executed.push(Number(realm_entity_id));
    });

    let passed = 0;
    const results = await executeProductionPlansSequentially({
      executablePlans: [makeExecutablePlan(1), makeExecutablePlan(2), makeExecutablePlan(3)],
      signer: { address: "0xabc" } as ExecuteRealmProductionPlanProps["signer"],
      executeRealmProductionPlan,
      isCancelled: () => {
        passed += 1;
        return passed === 2 ? { cancelled: true, reason: "Game has ended", scope: "pass" } : { cancelled: false };
      },
    });

    expect(executed).toEqual([1]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "rejected"]);
    results.slice(1).forEach((entry) => {
      if (entry.status === "rejected") {
        expect(entry.reason.error).toBeInstanceOf(AutomationCancelledError);
      }
    });
  });

  it("short-circuits tail realms with AutomationSignerSkippedError when a signer-transient error fires", async () => {
    vi.useRealTimers();
    const executed: number[] = [];
    const executeRealmProductionPlan = vi.fn(async ({ realm_entity_id }: ExecuteRealmProductionPlanProps) => {
      const realmId = Number(realm_entity_id);
      executed.push(realmId);
      if (realmId === 1) throw new Error("StarknetError: Invalid transaction nonce");
    });

    const results = await executeProductionPlansSequentially({
      executablePlans: [makeExecutablePlan(1), makeExecutablePlan(2), makeExecutablePlan(3)],
      signer: { address: "0xabc" } as ExecuteRealmProductionPlanProps["signer"],
      executeRealmProductionPlan,
    });

    expect(executed).toEqual([1]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected", "rejected"]);
    expect((results[0] as { reason: { error: unknown } }).reason.error).toBeInstanceOf(Error);
    expect((results[1] as { reason: { error: unknown } }).reason.error).toBeInstanceOf(AutomationSignerSkippedError);
    expect((results[2] as { reason: { error: unknown } }).reason.error).toBeInstanceOf(AutomationSignerSkippedError);
  });

  it("recognises common signer-transient error payloads", () => {
    expect(isSignerTransientError(new Error("nonce too low"))).toBe(true);
    expect(isSignerTransientError(new Error("StarknetError: Invalid transaction nonce"))).toBe(true);
    expect(isSignerTransientError({ message: "account validation failed" })).toBe(true);
    expect(isSignerTransientError({ cause: { message: "insufficient fee" } })).toBe(true);
    expect(isSignerTransientError(new Error("some unrelated error"))).toBe(false);
    expect(isSignerTransientError(new AutomationTimeoutError(1000))).toBe(false);
    expect(isSignerTransientError(new AutomationCancelledError("x"))).toBe(false);
  });

  it("executes production plans sequentially and continues after a failed realm", async () => {
    vi.useRealTimers();
    const callOrder: number[] = [];
    const executeRealmProductionPlan = vi.fn(async ({ realm_entity_id }: ExecuteRealmProductionPlanProps) => {
      const realmId = Number(realm_entity_id);
      callOrder.push(realmId);
      if (realmId === 2) {
        throw new Error("recipe validation failed");
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
