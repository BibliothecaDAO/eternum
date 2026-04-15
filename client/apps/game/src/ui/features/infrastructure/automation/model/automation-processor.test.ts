// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import {
  buildAutomationSkipMessage,
  buildRealmProductionPlan,
  type RealmResourceSnapshot,
} from "./automation-processor";
import type { RealmAutomationConfig, ResourceAutomationPercentages } from "@/hooks/store/use-automation-store";

const { configManagerMock } = vi.hoisted(() => ({
  configManagerMock: {
    complexSystemResourceInputs: {} as Record<number, Array<{ resource: number; amount: number }>>,
    complexSystemResourceOutput: {} as Record<number, { resource: number; amount: number }>,
    simpleSystemResourceInputs: {} as Record<number, Array<{ resource: number; amount: number }>>,
    simpleSystemResourceOutput: {} as Record<number, { resource: number; amount: number }>,
    getLaborConfig: vi.fn(),
    getSeasonConfig: vi.fn(() => ({ startSettlingAt: 1, startMainAt: 2, endAt: 3 })),
  },
}));

vi.mock("@bibliothecadao/eternum", () => ({
  configManager: configManagerMock,
  divideByPrecision: (value: number) => value,
  ResourceManager: class ResourceManager {},
}));

const TROOP_INPUTS = [ResourcesIds.Wheat, ResourcesIds.Copper, ResourcesIds.Essence];

const makeRealmConfig = (
  overrides: Partial<RealmAutomationConfig> = {},
  customPercentages: Record<number, ResourceAutomationPercentages> = {},
): RealmAutomationConfig => ({
  realmId: "777",
  realmName: "Test Realm",
  entityType: "realm",
  presetId: "smart",
  autoBalance: true,
  customPercentages,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const makeSnapshot = (
  activeResources: ResourcesIds[],
  balances: Partial<Record<ResourcesIds, number>>,
): RealmResourceSnapshot => {
  const snapshot: RealmResourceSnapshot = new Map();

  const trackedResources = new Set<ResourcesIds>([...activeResources, ...TROOP_INPUTS]);
  Object.keys(balances).forEach((resourceId) => trackedResources.add(Number(resourceId) as ResourcesIds));

  trackedResources.forEach((resourceId) => {
    snapshot.set(resourceId, {
      resourceId,
      balanceHuman: balances[resourceId] ?? 0,
      hasActiveProduction: activeResources.includes(resourceId),
      productionPerSecond: activeResources.includes(resourceId) ? 1 : 0,
    });
  });

  return snapshot;
};

const configureComplexRecipe = (
  resourceId: ResourcesIds,
  inputs: Array<{ resource: ResourcesIds; amount: number }>,
  outputAmount = 1,
) => {
  configManagerMock.complexSystemResourceInputs[resourceId] = inputs;
  configManagerMock.complexSystemResourceOutput[resourceId] = {
    resource: resourceId,
    amount: outputAmount,
  };
};

const configureTroopRecipes = () => {
  configureComplexRecipe(ResourcesIds.Knight, [
    { resource: ResourcesIds.Wheat, amount: 1 },
    { resource: ResourcesIds.Copper, amount: 1 },
  ]);
  configureComplexRecipe(ResourcesIds.Crossbowman, [
    { resource: ResourcesIds.Wheat, amount: 1 },
    { resource: ResourcesIds.Copper, amount: 1 },
  ]);
  configureComplexRecipe(ResourcesIds.Paladin, [
    { resource: ResourcesIds.Wheat, amount: 1 },
    { resource: ResourcesIds.Copper, amount: 1 },
  ]);
  configureComplexRecipe(ResourcesIds.KnightT2, [
    { resource: ResourcesIds.Wheat, amount: 1 },
    { resource: ResourcesIds.Knight, amount: 1 },
    { resource: ResourcesIds.Essence, amount: 1 },
  ]);
  configureComplexRecipe(ResourcesIds.CrossbowmanT2, [
    { resource: ResourcesIds.Wheat, amount: 1 },
    { resource: ResourcesIds.Crossbowman, amount: 1 },
    { resource: ResourcesIds.Essence, amount: 1 },
  ]);
  configureComplexRecipe(ResourcesIds.PaladinT2, [
    { resource: ResourcesIds.Wheat, amount: 1 },
    { resource: ResourcesIds.Paladin, amount: 1 },
    { resource: ResourcesIds.Essence, amount: 1 },
  ]);
};

let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  configManagerMock.complexSystemResourceInputs = {};
  configManagerMock.complexSystemResourceOutput = {};
  configManagerMock.simpleSystemResourceInputs = {};
  configManagerMock.simpleSystemResourceOutput = {};
  configManagerMock.getLaborConfig.mockImplementation((resourceId: ResourcesIds) => ({
    inputResources: configManagerMock.simpleSystemResourceInputs[resourceId] ?? [],
    resourceOutputPerInputResources: configManagerMock.simpleSystemResourceOutput[resourceId]?.amount ?? 0,
  }));
  configureTroopRecipes();
});

afterEach(() => {
  consoleLogSpy.mockRestore();
});

describe("buildRealmProductionPlan", () => {
  it("evaluates custom inactive resources for diagnostics without executing them", () => {
    configureComplexRecipe(ResourcesIds.Wood, [{ resource: ResourcesIds.Wheat, amount: 1 }]);

    const plan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(
        { presetId: "custom" },
        {
          [ResourcesIds.KnightT2]: { resourceToResource: 50, laborToResource: 0 },
        },
      ),
      snapshot: makeSnapshot([ResourcesIds.Wood], {
        [ResourcesIds.Wheat]: 100,
        [ResourcesIds.Knight]: 100,
        [ResourcesIds.Essence]: 100,
      }),
    });

    expect(plan.evaluatedResourceIds).toContain(ResourcesIds.KnightT2);
    expect(plan.callset.resourceToResource.map((call) => call.resourceId)).not.toContain(ResourcesIds.KnightT2);
    expect(plan.skipped).toContainEqual({
      resourceId: ResourcesIds.KnightT2,
      reason: "No active production building",
    });
  });

  it("plans all T1 troops before T2 troops so lower-tier dependencies get first claim", () => {
    const plan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(),
      snapshot: makeSnapshot(
        [ResourcesIds.Knight, ResourcesIds.KnightT2, ResourcesIds.Crossbowman, ResourcesIds.CrossbowmanT2],
        {
          [ResourcesIds.Wheat]: 500,
          [ResourcesIds.Copper]: 500,
          [ResourcesIds.Essence]: 500,
          [ResourcesIds.Knight]: 500,
          [ResourcesIds.Crossbowman]: 500,
        },
      ),
    });

    expect(plan.callset.resourceToResource.map((call) => call.resourceId)).toEqual([
      ResourcesIds.Knight,
      ResourcesIds.Crossbowman,
      ResourcesIds.KnightT2,
      ResourcesIds.CrossbowmanT2,
    ]);
  });

  it("does not spend same-pass T1 output as T2 input", () => {
    const plan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(),
      snapshot: makeSnapshot([ResourcesIds.Knight, ResourcesIds.KnightT2], {
        [ResourcesIds.Wheat]: 500,
        [ResourcesIds.Copper]: 500,
        [ResourcesIds.Essence]: 500,
        [ResourcesIds.Knight]: 0,
      }),
    });

    expect(plan.callset.resourceToResource.map((call) => call.resourceId)).toContain(ResourcesIds.Knight);
    expect(plan.callset.resourceToResource.map((call) => call.resourceId)).not.toContain(ResourcesIds.KnightT2);
    expect(plan.skipped).toContainEqual({
      resourceId: ResourcesIds.KnightT2,
      reason: "Insufficient complex recipe inputs",
    });
  });

  it("allows one smart troop cycle when percentage math floors to zero but one cycle is affordable", () => {
    const plan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(),
      snapshot: makeSnapshot([ResourcesIds.Knight], {
        [ResourcesIds.Wheat]: 2,
        [ResourcesIds.Copper]: 2,
      }),
    });

    expect(plan.callset.resourceToResource).toEqual([{ resourceId: ResourcesIds.Knight, cycles: 1 }]);
  });

  it("ignores stale custom resource keys when planning smart allocations", () => {
    const snapshot = makeSnapshot([ResourcesIds.Knight], {
      [ResourcesIds.Wheat]: 100,
      [ResourcesIds.Copper]: 100,
      [ResourcesIds.Essence]: 100,
      [ResourcesIds.Knight]: 100,
    });

    const baselinePlan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(),
      snapshot,
    });
    const planWithStaleCustomKeys = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(
        { presetId: "smart" },
        {
          [ResourcesIds.KnightT2]: { resourceToResource: 50, laborToResource: 0 },
        },
      ),
      snapshot,
    });

    expect(planWithStaleCustomKeys.evaluatedResourceIds).toEqual(baselinePlan.evaluatedResourceIds);
    expect(planWithStaleCustomKeys.callset.resourceToResource).toEqual(baselinePlan.callset.resourceToResource);
    expect(planWithStaleCustomKeys.skipped).not.toContainEqual({
      resourceId: ResourcesIds.KnightT2,
      reason: "No active production building",
    });
  });

  it("does not allow the smart minimum cycle when any input cannot fund one cycle inside budget", () => {
    const plan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(),
      snapshot: makeSnapshot([ResourcesIds.Knight], {
        [ResourcesIds.Wheat]: 2,
        [ResourcesIds.Copper]: 1,
      }),
    });

    expect(plan.callset.resourceToResource).toEqual([]);
    expect(plan.skipped).toContainEqual({
      resourceId: ResourcesIds.Knight,
      reason: "Insufficient complex recipe inputs",
    });
  });

  it("keeps T2 labor allocations skipped when no labor recipe exists", () => {
    const plan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(
        { presetId: "custom" },
        {
          [ResourcesIds.KnightT2]: { resourceToResource: 0, laborToResource: 20 },
        },
      ),
      snapshot: makeSnapshot([ResourcesIds.KnightT2], {
        [ResourcesIds.Wheat]: 100,
        [ResourcesIds.Knight]: 100,
        [ResourcesIds.Essence]: 100,
      }),
    });

    expect(plan.callset.laborToResource).toEqual([]);
    expect(plan.skipped).toContainEqual({
      resourceId: ResourcesIds.KnightT2,
      reason: "Missing labor recipe configuration",
    });
  });
});

describe("buildAutomationSkipMessage", () => {
  it("describes inactive production buildings with the resource name", () => {
    expect(
      buildAutomationSkipMessage({
        resourceId: ResourcesIds.PaladinT2,
        reason: "No active production building",
      }),
    ).toBe("PaladinT2 has no active production building");
  });

  it("describes troop input waits with the resource name", () => {
    expect(
      buildAutomationSkipMessage({
        resourceId: ResourcesIds.KnightT2,
        reason: "Insufficient complex recipe inputs",
      }),
    ).toBe("KnightT2 waiting for recipe inputs");
  });
});
