// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";

const mocks = vi.hoisted(() => ({
  getResourceBalancesWithProduction: vi.fn(),
}));

vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({
    resources: {
      getTiers: () => ({}),
    },
  }),
}));

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 0,
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: () => vi.fn(),
}));

vi.mock("@/ui/design-system/atoms/lib/utils", () => ({
  cn: (...values: string[]) => values.filter(Boolean).join(" "),
}));

vi.mock("@/ui/design-system/molecules/resource-icon", () => ({
  ResourceIcon: () => null,
}));

vi.mock("@/ui/features/relics/components/relic-activation-selector", () => ({
  RelicActivationSelector: () => null,
}));

vi.mock("@bibliothecadao/eternum", () => ({
  divideByPrecision: (value: number) => value,
  ResourceManager: {
    getResourceBalancesWithProduction: mocks.getResourceBalancesWithProduction,
  },
}));

vi.mock("@bibliothecadao/types", () => ({
  ResourcesIds: {
    Lords: 1,
    Wood: 2,
    Wheat: 3,
    Dragonhide: 99,
    AncientFragment: 100,
  },
  RelicRecipientType: {
    Explorer: 1,
    Structure: 2,
  },
  isRelic: (resourceId: number) => resourceId === 99 || resourceId === 100,
  getRelicInfo: (resourceId: number) => {
    if (resourceId === 99) return { recipientType: 1 };
    if (resourceId === 100) return { recipientType: 2 };
    return undefined;
  },
  resources: [],
}));

import { RelicRecipientType } from "@bibliothecadao/types";

import { buildDisplayItems, countDisplayItems, filterDisplayItems } from "./compact-entity-inventory";

describe("buildDisplayItems", () => {
  it("uses the provided currentDefaultTick when projecting balances", () => {
    mocks.getResourceBalancesWithProduction.mockReturnValue([
      { resourceId: ResourcesIds.Wood, amount: 25 },
      { resourceId: ResourcesIds.Wheat, amount: 0 },
    ]);

    const resourceComponent = { some: "resource" } as never;
    const result = buildDisplayItems(resourceComponent, 1234, [], undefined, {
      common: [ResourcesIds.Wood],
      food: [ResourcesIds.Wheat],
    });

    expect(mocks.getResourceBalancesWithProduction).toHaveBeenCalledWith(resourceComponent, 1234);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      resourceId: ResourcesIds.Wood,
      amount: 25,
    });
  });

  it("filters inventory items into resource and relic groups", () => {
    mocks.getResourceBalancesWithProduction.mockReturnValue([
      { resourceId: ResourcesIds.Wood, amount: 25 },
      { resourceId: ResourcesIds.Dragonhide, amount: 1 },
    ]);

    const result = buildDisplayItems(
      { some: "resource" } as never,
      1234,
      [ResourcesIds.Dragonhide],
      RelicRecipientType.Explorer,
    );

    expect(filterDisplayItems(result, "resources")).toEqual([
      expect.objectContaining({
        resourceId: ResourcesIds.Wood,
        isRelic: false,
      }),
    ]);
    expect(filterDisplayItems(result, "relics")).toEqual([
      expect.objectContaining({
        resourceId: ResourcesIds.Dragonhide,
        isRelic: true,
        isActive: true,
        canActivate: true,
      }),
    ]);
  });

  it("filters usable relics to compatible inactive relics", () => {
    mocks.getResourceBalancesWithProduction.mockReturnValue([
      { resourceId: ResourcesIds.Wood, amount: 25 },
      { resourceId: ResourcesIds.Dragonhide, amount: 1 },
      { resourceId: ResourcesIds.AncientFragment, amount: 1 },
    ]);

    const result = buildDisplayItems({ some: "resource" } as never, 1234, [], RelicRecipientType.Explorer);

    expect(filterDisplayItems(result, "usableRelics")).toEqual([
      expect.objectContaining({
        resourceId: ResourcesIds.Dragonhide,
        isRelic: true,
        isActive: false,
        canActivate: true,
      }),
    ]);
  });

  it("excludes active compatible relics from usable relic filters", () => {
    mocks.getResourceBalancesWithProduction.mockReturnValue([{ resourceId: ResourcesIds.Dragonhide, amount: 1 }]);

    const result = buildDisplayItems(
      { some: "resource" } as never,
      1234,
      [ResourcesIds.Dragonhide],
      RelicRecipientType.Explorer,
    );

    expect(filterDisplayItems(result, "usableRelics")).toEqual([]);
  });

  it("counts total, resource, relic, and active relic item groups without treating active relics as usable", () => {
    mocks.getResourceBalancesWithProduction.mockReturnValue([
      { resourceId: ResourcesIds.Wood, amount: 25 },
      { resourceId: ResourcesIds.Wheat, amount: 10 },
      { resourceId: ResourcesIds.Dragonhide, amount: 2 },
    ]);

    const result = buildDisplayItems(
      { some: "resource" } as never,
      1234,
      [ResourcesIds.Dragonhide],
      RelicRecipientType.Explorer,
    );

    expect(countDisplayItems(result)).toEqual({
      total: 3,
      resources: 2,
      relics: 1,
      activeRelics: 1,
      totalRelics: 2,
      usableRelics: 0,
    });
  });

  it("marks relics compatible with the selected recipient type", () => {
    mocks.getResourceBalancesWithProduction.mockReturnValue([
      { resourceId: ResourcesIds.Dragonhide, amount: 1 },
      { resourceId: ResourcesIds.AncientFragment, amount: 1 },
    ]);

    const result = buildDisplayItems({ some: "resource" } as never, 1234, [], RelicRecipientType.Explorer);

    expect(result).toEqual([
      expect.objectContaining({
        resourceId: ResourcesIds.Dragonhide,
        isRelic: true,
        canActivate: true,
      }),
      expect.objectContaining({
        resourceId: ResourcesIds.AncientFragment,
        isRelic: true,
        canActivate: false,
      }),
    ]);
  });

  it("counts inactive compatible relics as usable", () => {
    mocks.getResourceBalancesWithProduction.mockReturnValue([
      { resourceId: ResourcesIds.Dragonhide, amount: 2 },
      { resourceId: ResourcesIds.AncientFragment, amount: 1 },
    ]);

    const result = buildDisplayItems(
      { some: "resource" } as never,
      1234,
      [ResourcesIds.AncientFragment],
      RelicRecipientType.Explorer,
    );

    expect(countDisplayItems(result)).toMatchObject({
      relics: 2,
      activeRelics: 1,
      totalRelics: 3,
      usableRelics: 2,
    });
  });
});
