import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRealmConsumptionPerSecond } from "./use-realm-consumption-per-second";

const mocks = vi.hoisted(() => ({
  automationConfig: {
    entityType: "realm",
    presetId: "smart",
    customPercentages: {},
  },
  buildings: [] as Array<{ category: number }>,
  productionCounts: new Map<number, number>(),
  aggregateConsumptionPerSecond: vi.fn(),
}));

vi.mock("@/hooks/store/use-automation-store", () => ({
  MAX_RESOURCE_ALLOCATION_PERCENT: 90,
  useAutomationStore: (selector: (state: { realms: Record<string, unknown> }) => unknown) =>
    selector({ realms: { "7": mocks.automationConfig } }),
}));

vi.mock("@/ui/features/infrastructure/automation/model/automation-processor", () => ({
  PROCESS_INTERVAL_MS: 60_000,
}));

vi.mock("@/utils/automation-presets", () => ({
  inferRealmPreset: () => mocks.automationConfig.presetId,
  calculatePresetAllocations: (resourceIds: number[]) =>
    new Map(resourceIds.map((resourceId) => [resourceId, { resourceToResource: 90, laborToResource: 0 }])),
}));

vi.mock("@bibliothecadao/react", () => ({
  useBuildings: () => mocks.buildings,
}));

vi.mock("@bibliothecadao/eternum", () => ({
  aggregateConsumptionPerSecond: mocks.aggregateConsumptionPerSecond,
  ResourceManager: {
    balanceAndProduction: (_resources: unknown, resourceId: number) => ({
      production: { building_count: mocks.productionCounts.get(resourceId) ?? 0 },
    }),
  },
}));

vi.mock("@bibliothecadao/types", () => ({
  ResourcesIds: {
    Labor: 1,
    Wood: 2,
    Coal: 3,
  },
  getProducedResource: (category: number) => category,
}));

function HookHarness({
  structure,
  resources,
  entityId,
  onValue,
}: {
  structure: { base?: { coord_x?: number; coord_y?: number } } | null;
  resources: object | null;
  entityId: number | null;
  onValue: (value: Map<number, number>) => void;
}) {
  const value = useRealmConsumptionPerSecond(structure as never, resources as never, entityId);
  onValue(value);
  return null;
}

describe("useRealmConsumptionPerSecond", () => {
  let container: HTMLDivElement;
  let root: Root;
  let observedValue: Map<number, number>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    observedValue = new Map();
    mocks.buildings = [];
    mocks.productionCounts = new Map();
    mocks.aggregateConsumptionPerSecond.mockReset();
    mocks.aggregateConsumptionPerSecond.mockReturnValue(new Map([[2, 1.5]]));
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("only includes resources with active production when aggregating consumption", async () => {
    mocks.buildings = [{ category: 2 }, { category: 3 }];
    mocks.productionCounts = new Map([
      [2, 1],
      [3, 0],
    ]);

    await act(async () => {
      root.render(
        <HookHarness
          structure={{ base: { coord_x: 10, coord_y: 20 } }}
          resources={{}}
          entityId={7}
          onValue={(value) => {
            observedValue = value;
          }}
        />,
      );
    });

    expect(mocks.aggregateConsumptionPerSecond).toHaveBeenCalledWith(
      [2],
      {
        2: { resourceToResource: 90, laborToResource: 0 },
      },
      expect.objectContaining({
        maxAllocationPercent: 90,
        cycleSeconds: 60,
      }),
    );
    expect(observedValue.get(2)).toBe(1.5);
  });

  it("returns an empty map and skips aggregation when no produced resource is active", async () => {
    mocks.buildings = [{ category: 2 }];
    mocks.productionCounts = new Map([[2, 0]]);

    await act(async () => {
      root.render(
        <HookHarness
          structure={{ base: { coord_x: 10, coord_y: 20 } }}
          resources={{}}
          entityId={7}
          onValue={(value) => {
            observedValue = value;
          }}
        />,
      );
    });

    expect(mocks.aggregateConsumptionPerSecond).not.toHaveBeenCalled();
    expect(observedValue.size).toBe(0);
  });
});
