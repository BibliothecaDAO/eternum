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

  it("does not let T1 same-pass output fund T2 when pre-existing T1 balance is zero", () => {
    const plan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(),
      snapshot: makeSnapshot([ResourcesIds.Knight, ResourcesIds.KnightT2], {
        [ResourcesIds.Wheat]: 500,
        [ResourcesIds.Copper]: 500,
        [ResourcesIds.Essence]: 500,
        [ResourcesIds.Knight]: 0,
      }),
    });

    const callResourceIds = plan.callset.resourceToResource.map((call) => call.resourceId);
    expect(callResourceIds).toContain(ResourcesIds.Knight);
    expect(callResourceIds).not.toContain(ResourcesIds.KnightT2);

    const t1Cycles =
      plan.callset.resourceToResource.find((call) => call.resourceId === ResourcesIds.Knight)?.cycles ?? 0;
    expect(t1Cycles).toBeGreaterThan(0);
  });

  it("sizes T2 cycles from pre-existing T1 balance only, ignoring same-pass T1 output", () => {
    // Use custom preset with 100% percentages so the T2 cycle cap is clearly bounded by Knight balance
    // and not by any preset-specific allocation math.
    const plan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(
        { presetId: "custom" },
        {
          [ResourcesIds.Knight]: { resourceToResource: 10, laborToResource: 0 },
          [ResourcesIds.KnightT2]: { resourceToResource: 50, laborToResource: 0 },
        },
      ),
      snapshot: makeSnapshot([ResourcesIds.Knight, ResourcesIds.KnightT2], {
        [ResourcesIds.Wheat]: 10_000,
        [ResourcesIds.Copper]: 10_000,
        [ResourcesIds.Essence]: 10_000,
        [ResourcesIds.Knight]: 100,
      }),
    });

    const t2Cycles =
      plan.callset.resourceToResource.find((call) => call.resourceId === ResourcesIds.KnightT2)?.cycles ?? 0;

    // KnightT2 consumes 1 Knight per cycle. Real Knight balance is 100, MAX_RESOURCE_ALLOCATION_PERCENT = 90%,
    // so the binding cap is 90. Same-pass Knight output must NOT raise this ceiling.
    expect(t2Cycles).toBeGreaterThan(0);
    expect(t2Cycles).toBeLessThanOrEqual(90);
  });

  it("skips T2 when there is no snapshot Knight balance and T1 produces nothing (recipe undeployable)", () => {
    configManagerMock.complexSystemResourceInputs[ResourcesIds.Knight] = [
      { resource: ResourcesIds.Wheat, amount: 1 },
      { resource: ResourcesIds.Copper, amount: 1 },
    ];
    const plan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(),
      snapshot: makeSnapshot([ResourcesIds.Knight, ResourcesIds.KnightT2], {
        [ResourcesIds.Wheat]: 0,
        [ResourcesIds.Copper]: 0,
        [ResourcesIds.Essence]: 500,
        [ResourcesIds.Knight]: 0,
      }),
    });

    const callResourceIds = plan.callset.resourceToResource.map((call) => call.resourceId);
    expect(callResourceIds).not.toContain(ResourcesIds.Knight);
    expect(callResourceIds).not.toContain(ResourcesIds.KnightT2);
  });

  it("does not let same-pass output of one recipe leak into an unrelated recipe's budget", () => {
    configureComplexRecipe(
      ResourcesIds.Wood,
      [
        { resource: ResourcesIds.Wheat, amount: 1 },
        { resource: ResourcesIds.Copper, amount: 1 },
      ],
      10,
    );

    const plan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(
        { presetId: "custom" },
        {
          [ResourcesIds.Wood]: { resourceToResource: 50, laborToResource: 0 },
        },
      ),
      snapshot: makeSnapshot([ResourcesIds.Wood], {
        [ResourcesIds.Wheat]: 100,
        [ResourcesIds.Copper]: 100,
      }),
    });

    expect(plan.outputsByResource[ResourcesIds.Wood]).toBeGreaterThan(0);
    expect(plan.consumptionByResource[ResourcesIds.Wood]).toBeUndefined();
  });

  it("primes a three-tier chain (Ore -> Iron -> Steel) tier-by-tier across passes, not all in one pass", () => {
    const Ore = ResourcesIds.Stone;
    const Iron = ResourcesIds.Coal;
    const Steel = ResourcesIds.Ironwood;

    configureComplexRecipe(Ore, [{ resource: ResourcesIds.Wheat, amount: 1 }], 10);
    configureComplexRecipe(Iron, [{ resource: Ore, amount: 1 }], 5);
    configureComplexRecipe(Steel, [{ resource: Iron, amount: 1 }], 2);

    const plan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(
        { presetId: "custom" },
        {
          [Ore]: { resourceToResource: 50, laborToResource: 0 },
          [Iron]: { resourceToResource: 50, laborToResource: 0 },
          [Steel]: { resourceToResource: 50, laborToResource: 0 },
        },
      ),
      snapshot: makeSnapshot([Ore, Iron, Steel], {
        [ResourcesIds.Wheat]: 1000,
        [Ore]: 0,
        [Iron]: 0,
        [Steel]: 0,
      }),
    });

    // Topological order is preserved even when downstream tiers cannot run — evaluation order is observable via ordering of evaluatedResourceIds.
    expect(plan.evaluatedResourceIds.indexOf(Ore)).toBeLessThan(plan.evaluatedResourceIds.indexOf(Iron));
    expect(plan.evaluatedResourceIds.indexOf(Iron)).toBeLessThan(plan.evaluatedResourceIds.indexOf(Steel));

    const callOrder = plan.callset.resourceToResource.map((call) => call.resourceId);
    // Only Ore has a spendable input (Wheat). Iron and Steel cannot execute this pass because
    // their upstream output goes to `output_amount_left` on chain and only materializes
    // into spendable balance over future ticks.
    expect(callOrder).toEqual([Ore]);

    const oreCycles = plan.callset.resourceToResource.find((call) => call.resourceId === Ore)?.cycles ?? 0;
    expect(oreCycles).toBeGreaterThan(0);
  });

  it("regression: downstream COAL consumption is bounded by real COAL balance, ignoring same-pass output (COAL chain bug)", () => {
    // Reproduces the on-chain failure: "Insufficient Balance: COAL (id: 209, balance: 463) < 1279".
    // Upstream recipe that produces COAL must NOT inflate the downstream COAL-consuming budget.
    const CoalProducer = ResourcesIds.Stone; // stand-in for a recipe whose output is COAL
    const CoalConsumer = ResourcesIds.Ironwood; // stand-in for a recipe that consumes COAL

    // CoalProducer: consumes Wheat, outputs COAL (10 per cycle).
    configManagerMock.complexSystemResourceInputs[CoalProducer] = [{ resource: ResourcesIds.Wheat, amount: 1 }];
    configManagerMock.complexSystemResourceOutput[CoalProducer] = {
      resource: ResourcesIds.Coal,
      amount: 10,
    };

    // CoalConsumer: consumes COAL (1 per cycle), outputs itself.
    configureComplexRecipe(CoalConsumer, [{ resource: ResourcesIds.Coal, amount: 1 }], 2);

    const plan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(
        { presetId: "custom" },
        {
          [CoalProducer]: { resourceToResource: 50, laborToResource: 0 },
          [CoalConsumer]: { resourceToResource: 50, laborToResource: 0 },
        },
      ),
      snapshot: makeSnapshot([CoalProducer, CoalConsumer], {
        [ResourcesIds.Wheat]: 10_000, // plenty of upstream input
        [ResourcesIds.Coal]: 463, // low pre-existing COAL balance
      }),
    });

    const consumerCycles =
      plan.callset.resourceToResource.find((call) => call.resourceId === CoalConsumer)?.cycles ?? 0;
    const coalConsumed = plan.consumptionByResource[ResourcesIds.Coal] ?? 0;

    // CoalConsumer needs 1 COAL per cycle; with 90% cap and 463 balance, max cycles = floor(463 * 0.9) = 416.
    // Without the fix, same-pass credit from CoalProducer would push this far higher (contract reverts on chain).
    expect(consumerCycles).toBeLessThanOrEqual(416);
    expect(coalConsumed).toBeLessThanOrEqual(416);
  });

  it("falls back to numeric order and warns when recipe config introduces a cycle", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      configureComplexRecipe(ResourcesIds.Wood, [{ resource: ResourcesIds.Stone, amount: 1 }], 1);
      configureComplexRecipe(ResourcesIds.Stone, [{ resource: ResourcesIds.Wood, amount: 1 }], 1);

      const plan = buildRealmProductionPlan({
        realmConfig: makeRealmConfig(
          { presetId: "custom" },
          {
            [ResourcesIds.Wood]: { resourceToResource: 50, laborToResource: 0 },
            [ResourcesIds.Stone]: { resourceToResource: 50, laborToResource: 0 },
          },
        ),
        snapshot: makeSnapshot([ResourcesIds.Wood, ResourcesIds.Stone], {
          [ResourcesIds.Wood]: 100,
          [ResourcesIds.Stone]: 100,
        }),
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("dependency cycle"),
        expect.objectContaining({ missing: expect.any(Array) }),
      );

      // The cycle is a config property re-detected every evaluation — the
      // warning must not repeat (one session logged it 111 times).
      buildRealmProductionPlan({
        realmConfig: makeRealmConfig(
          { presetId: "custom" },
          {
            [ResourcesIds.Wood]: { resourceToResource: 50, laborToResource: 0 },
            [ResourcesIds.Stone]: { resourceToResource: 50, laborToResource: 0 },
          },
        ),
        snapshot: makeSnapshot([ResourcesIds.Wood, ResourcesIds.Stone], {
          [ResourcesIds.Wood]: 100,
          [ResourcesIds.Stone]: 100,
        }),
      });
      const cycleWarnings = warnSpy.mock.calls.filter(([message]) => String(message).includes("dependency cycle"));
      expect(cycleWarnings).toHaveLength(1);
      expect(plan.evaluatedResourceIds).toContain(ResourcesIds.Wood);
      expect(plan.evaluatedResourceIds).toContain(ResourcesIds.Stone);
    } finally {
      warnSpy.mockRestore();
    }
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

  it("splits a shared input's execution budget proportionally so late-ordered consumers aren't starved", () => {
    // Reproduces the user-reported troop-starvation bug: when raw resources and a troop
    // share Wheat as input and aggregate allocation exceeds the execution budget cap,
    // sequential first-come reservation leaves the last consumer with crumbs. Proportional
    // allocation must give each consumer its scaled share of the cap.
    configureComplexRecipe(ResourcesIds.Wood, [{ resource: ResourcesIds.Wheat, amount: 1 }], 1);
    configureComplexRecipe(ResourcesIds.Coal, [{ resource: ResourcesIds.Wheat, amount: 1 }], 1);
    // Knight's troop recipe is already configured: needs 1 Wheat + 1 Copper per cycle, output 1.

    const plan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(
        { presetId: "custom" },
        {
          [ResourcesIds.Wood]: { resourceToResource: 40, laborToResource: 0 },
          [ResourcesIds.Coal]: { resourceToResource: 40, laborToResource: 0 },
          [ResourcesIds.Knight]: { resourceToResource: 50, laborToResource: 0 },
        },
      ),
      snapshot: makeSnapshot([ResourcesIds.Wood, ResourcesIds.Coal, ResourcesIds.Knight], {
        [ResourcesIds.Wheat]: 1000,
        [ResourcesIds.Copper]: 10_000,
      }),
    });

    // Total Wheat demand = 40 + 40 + 50 = 130%. Execution budget cap = 75%. Scale = 75/130 ≈ 0.5769.
    // Knight scaled demand ≈ 50% * 0.5769 * 1000 ≈ 288 Wheat → 288 cycles.
    const knightCycles =
      plan.callset.resourceToResource.find((call) => call.resourceId === ResourcesIds.Knight)?.cycles ?? 0;
    const woodCycles =
      plan.callset.resourceToResource.find((call) => call.resourceId === ResourcesIds.Wood)?.cycles ?? 0;
    const coalCycles =
      plan.callset.resourceToResource.find((call) => call.resourceId === ResourcesIds.Coal)?.cycles ?? 0;

    // Sequential-first-come would give Knight ~0 cycles after Wood/Coal drain the budget.
    // Proportional allocation gives every consumer their scaled share simultaneously.
    expect(knightCycles).toBeGreaterThan(250);
    expect(woodCycles).toBeGreaterThan(200);
    expect(coalCycles).toBeGreaterThan(200);

    // Total Wheat consumed must never exceed the 75% execution budget cap.
    const totalWheat = plan.consumptionByResource[ResourcesIds.Wheat] ?? 0;
    expect(totalWheat).toBeLessThanOrEqual(750);
  });

  it("does not scale when aggregate demand fits inside the execution budget cap", () => {
    // Regression: if demand <= execution budget, every consumer gets its full unscaled desired share.
    configureComplexRecipe(ResourcesIds.Wood, [{ resource: ResourcesIds.Wheat, amount: 1 }], 1);

    const plan = buildRealmProductionPlan({
      realmConfig: makeRealmConfig(
        { presetId: "custom" },
        {
          [ResourcesIds.Wood]: { resourceToResource: 30, laborToResource: 0 },
          [ResourcesIds.Knight]: { resourceToResource: 30, laborToResource: 0 },
        },
      ),
      snapshot: makeSnapshot([ResourcesIds.Wood, ResourcesIds.Knight], {
        [ResourcesIds.Wheat]: 1000,
        [ResourcesIds.Copper]: 10_000,
      }),
    });

    // Total Wheat demand = 60%. No scaling. Each gets floor(1000 * 30 / 100) = 300.
    const knightCycles =
      plan.callset.resourceToResource.find((call) => call.resourceId === ResourcesIds.Knight)?.cycles ?? 0;
    const woodCycles =
      plan.callset.resourceToResource.find((call) => call.resourceId === ResourcesIds.Wood)?.cycles ?? 0;

    expect(knightCycles).toBe(300);
    expect(woodCycles).toBe(300);
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
