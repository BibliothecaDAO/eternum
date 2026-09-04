// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  balanceAndProduction: vi.fn(),
  calculateResourceProductionData: vi.fn(),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  ResourceManager: {
    balanceAndProduction: mocks.balanceAndProduction,
    calculateResourceProductionData: mocks.calculateResourceProductionData,
  },
}));

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 0,
}));

vi.mock("@bibliothecadao/react", () => ({
  useBuildings: () => [],
}));

vi.mock("@bibliothecadao/types", () => ({
  ResourcesIds: {
    Wood: 2,
    Stone: 3,
    Labor: 99,
  },
  getProducedResource: (category: number) => category > 0,
}));

import { ResourcesIds } from "@bibliothecadao/types";

import { buildStructureProductionSummary } from "./structure-production-summary";

describe("buildStructureProductionSummary", () => {
  beforeEach(() => {
    mocks.balanceAndProduction.mockReset();
    mocks.calculateResourceProductionData.mockReset();
  });

  it("counts active and total production buildings from shared production data", () => {
    mocks.balanceAndProduction.mockImplementation((_resources, resourceId: ResourcesIds) => ({
      production: {
        building_count: resourceId === ResourcesIds.Wood ? 2 : 0,
      },
    }));
    mocks.calculateResourceProductionData.mockImplementation((resourceId: ResourcesIds) => ({
      isProducing: resourceId === ResourcesIds.Wood,
      timeRemainingSeconds: resourceId === ResourcesIds.Wood ? 60 : null,
      productionPerSecond: resourceId === ResourcesIds.Wood ? 3 : null,
      outputRemaining: resourceId === ResourcesIds.Wood ? 180 : null,
    }));

    const summary = buildStructureProductionSummary({
      productionBuildings: [
        { category: 1, produced: { resource: ResourcesIds.Wood } },
        { category: 1, produced: { resource: ResourcesIds.Wood } },
        { category: 1, produced: { resource: ResourcesIds.Wood } },
        { category: 1, produced: { resource: ResourcesIds.Stone } },
      ],
      resources: {} as never,
      currentDefaultTick: 1234,
      calculatedAt: 5678,
    });

    expect(mocks.calculateResourceProductionData).toHaveBeenCalledWith(ResourcesIds.Wood, expect.any(Object), 1234);
    expect(summary.totalProductionBuildings).toBe(4);
    expect(summary.activeProductionBuildings).toBe(2);
    expect(summary.items).toEqual([
      {
        resourceId: ResourcesIds.Wood,
        totalBuildings: 3,
        activeBuildings: 2,
        isProducing: true,
        timeRemainingSeconds: 60,
        productionPerSecond: 3,
        outputRemaining: 180,
        calculatedAt: 5678,
      },
      {
        resourceId: ResourcesIds.Stone,
        totalBuildings: 1,
        activeBuildings: 0,
        isProducing: false,
        timeRemainingSeconds: null,
        productionPerSecond: null,
        outputRemaining: null,
        calculatedAt: 5678,
      },
    ]);
  });

  it("ignores labor and buildings without produced resources", () => {
    const summary = buildStructureProductionSummary({
      productionBuildings: [{ category: 1, produced: { resource: ResourcesIds.Labor } }, { category: 1 }],
      resources: {} as never,
      currentDefaultTick: 0,
      calculatedAt: 1,
    });

    expect(summary.totalProductionBuildings).toBe(0);
    expect(summary.activeProductionBuildings).toBe(0);
    expect(summary.items).toEqual([]);
    expect(mocks.balanceAndProduction).not.toHaveBeenCalled();
  });
});
