// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";

const routeMocks = vi.hoisted(() => ({ isMapView: false }));
const uiMocks = vi.hoisted(() => ({
  setPreviewBuilding: vi.fn(),
  setLeftNavigationView: vi.fn(),
  setSelectedBuildingHex: vi.fn(),
}));
const buildMocks = vi.hoisted(() => ({ buildRealmBuilding: vi.fn(async () => true) }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const components = {
  Structure: { name: "Structure" },
  StructureBuildings: { name: "StructureBuildings" },
  Resource: { name: "Resource" },
};

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useNowMs: () => 0,
  useNowSeconds: () => 0,
  useCoarseNowSeconds: () => 0,
  useCurrentBlockTimestamp: () => 0,
  useCurrentDefaultTick: () => 0,
  useCoarseCurrentDefaultTick: () => 0,
  useCurrentArmiesTick: () => 0,
  useBlockTimestamp: () => ({
    currentBlockTimestamp: 0,
    currentDefaultTick: 0,
    currentArmiesTick: 0,
    armiesTickTimeRemaining: 0,
  }),
}));

vi.mock("@/audio", () => ({
  usePlayResourceSound: () => ({ playResourceSound: vi.fn() }),
}));

vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: {
    getInstance: () => ({ play: vi.fn() }),
  },
}));

vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({
    rules: {
      isBuildingTypeAllowed: (buildingType: string) => buildingType === "ResourceWheat",
    },
  }),
}));

vi.mock("@/ui/config", () => ({
  BUILDING_IMAGES_PATH: {
    [BuildingType.ResourceWheat]: "/farm.png",
  },
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      previewBuilding: null,
      setPreviewBuilding: uiMocks.setPreviewBuilding,
      setLeftNavigationView: uiMocks.setLeftNavigationView,
      useSimpleCost: false,
      setUseSimpleCost: vi.fn(),
      setSelectedBuildingHex: uiMocks.setSelectedBuildingHex,
      setTooltip: vi.fn(),
    }),
}));

vi.mock("@/ui/design-system/atoms/button", () => ({
  default: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock("@/ui/design-system/atoms/tab", () => ({
  Tabs: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    List: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Tab: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Panels: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
}));

vi.mock("@/ui/design-system/molecules/headline", () => ({
  Headline: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/ui/design-system/molecules/hint-modal-button", () => ({
  HintModalButton: () => null,
}));

vi.mock("@/ui/design-system/molecules/resource-cost", () => ({
  ResourceCost: () => null,
}));

vi.mock("@/ui/design-system/molecules/resource-icon", () => ({
  ResourceIcon: ({ resource }: { resource: string }) => <span>{resource}</span>,
}));

vi.mock("@/ui/features/progression/hints/hint-modal", () => ({
  HintSection: { Buildings: "Buildings" },
}));

vi.mock("@/ui/shared", () => ({
  ProductionStatusBadge: ({ cornerTopLeft }: { cornerTopLeft?: string }) => (
    <div data-testid="production-status-badge" data-corner-top-left={cornerTopLeft} />
  ),
}));

vi.mock("@/ui/utils/utils", () => ({
  adjustWonderLordsCost: (cost: unknown) => cost,
  currencyIntlFormat: (value: number) => String(value),
  getEntityIdFromKeys: () => "realm-entity",
}));

vi.mock("@/ui/features/economy/resources/entity-resource-table/utils", () => ({
  formatTimeRemaining: (seconds: number) => `${seconds}s`,
}));

vi.mock("./construction-buildability", () => ({
  resolveConstructionBuildability: () => ({ canSubmit: true, reason: undefined }),
}));

vi.mock("./realm-build-actions", () => ({
  buildRealmBuilding: buildMocks.buildRealmBuilding,
  resolveRealmHasAvailableBuildingTile: () => true,
}));

vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({
    account: { account: {} },
    setup: {
      components,
      systemCalls: {},
    },
  }),
  useQuery: () => ({ isMapView: routeMocks.isMapView }),
}));

vi.mock("@dojoengine/react", () => ({
  useComponentValue: (component: { name: string }) => {
    if (component.name === "Structure") {
      return { base: { level: 1 }, metadata: { has_wonder: false } };
    }
    if (component.name === "StructureBuildings") {
      return { packed_counts_1: 0n, packed_counts_2: 0n, packed_counts_3: 0n };
    }
    if (component.name === "Resource") {
      return {
        WHEAT_PRODUCTION: { building_count: 4, production_rate: 1n, output_amount_left: 100n, last_updated_at: 0 },
      };
    }
    return undefined;
  },
}));

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: () => ({ metadata: { has_wonder: false } }),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  Biome: {
    getBiome: () => 1,
  },
  configManager: {
    complexSystemResourceInputs: {},
    complexSystemResourceOutput: {},
    getBiome: () => 1,
    getBiomeCombatBonus: () => 1,
    getBuildingCategoryConfig: () => ({ population_cost: 0, capacity_grant: 0 }),
    getResourceBuildingProduced: (buildingType: BuildingType) =>
      buildingType === BuildingType.ResourceWheat ? ResourcesIds.Wheat : undefined,
  },
  divideByPrecision: (value: number) => value,
  getBalance: () => 1000,
  getBlockTimestamp: () => ({ currentDefaultTick: 1 }),
  getBuildingCosts: () => [],
  getBuildingCount: (buildingType: BuildingType) => (buildingType === BuildingType.ResourceWheat ? 5 : 0),
  getConsumedBy: () => [],
  getRealmInfo: () => ({
    entityId: 101,
    position: { x: 0, y: 0 },
    resources: [ResourcesIds.Wheat],
  }),
  ResourceManager: {
    balanceAndProduction: () => ({
      balance: 0n,
      production: { building_count: 4, production_rate: 1n, output_amount_left: 100n, last_updated_at: 0 },
    }),
    calculateResourceProductionData: () => ({
      isProducing: true,
      productionPerSecond: 1,
      outputRemaining: 100,
      timeRemainingSeconds: 100,
    }),
  },
  ResourceIdToMiningType: {},
  TileManager: class {
    existingBuildings() {
      return [];
    }

    isHexOccupied() {
      return false;
    }
  },
}));

describe("SelectPreviewBuildingMenu production badge", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    routeMocks.isMapView = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container = null;
  });

  it("uses the structural building count for the visible production badge total", async () => {
    const { SelectPreviewBuildingMenu } = await import("./select-preview-building");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<SelectPreviewBuildingMenu entityId={101} />);
    });

    expect(
      container.querySelector("[data-testid='production-status-badge']")?.getAttribute("data-corner-top-left"),
    ).toBe("5");
  });

  const renderMenu = async () => {
    const { SelectPreviewBuildingMenu } = await import("./select-preview-building");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(<SelectPreviewBuildingMenu entityId={101} />);
    });
    return container.querySelector<HTMLElement>("img[alt='Farm']")!.closest("div.cursor-pointer") as HTMLElement;
  };

  it("builds straight onto a free tile from the world view and keeps the panel open", async () => {
    routeMocks.isMapView = true;
    const card = await renderMenu();
    await act(async () => card.click());
    expect(buildMocks.buildRealmBuilding).toHaveBeenCalledTimes(1);
    expect(buildMocks.buildRealmBuilding).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 101, target: { type: BuildingType.ResourceWheat } }),
    );
    expect(uiMocks.setPreviewBuilding).not.toHaveBeenCalled();
    expect(uiMocks.setLeftNavigationView).not.toHaveBeenCalled();
  });

  it("arms the placement preview and closes the panel from the local view", async () => {
    const card = await renderMenu();
    await act(async () => card.click());
    expect(buildMocks.buildRealmBuilding).not.toHaveBeenCalled();
    expect(uiMocks.setPreviewBuilding).toHaveBeenCalledWith({ type: BuildingType.ResourceWheat });
    expect(uiMocks.setLeftNavigationView).toHaveBeenCalledTimes(1);
  });
});
