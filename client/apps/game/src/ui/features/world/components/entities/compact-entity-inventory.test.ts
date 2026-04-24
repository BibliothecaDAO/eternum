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
  },
  isRelic: () => false,
  getRelicInfo: () => undefined,
  resources: [],
}));

import { buildDisplayItems } from "./compact-entity-inventory";

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
});
