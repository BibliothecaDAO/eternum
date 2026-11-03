// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { BuildingType, getProducedResource, ResourcesIds, StructureType } from "@bibliothecadao/types";

/** The structure the panel shows (a realm or a village) and its wheat farm off the castle tile, at (11, 9). */
const world = vi.hoisted(() => ({ category: 0 }));

// Wheat's rule: 6 a second on a realm, half of one on a village (a fraction, kept until it is written).
const store = {
  require: (model: string, keys: { resource_type?: number }) => {
    if (model === "ResourceRule" && keys.resource_type === ResourcesIds.Wheat)
      return { realm_rate: 6_000_000_000n, village_rate: 500_000_000n };
    throw new Error(`${model} not synchronized`);
  },
  get: () => undefined,
};

vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store } }) }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: false }) }));
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => [] }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 0 }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ id: "blitz", labels: { village: "Village" } }),
}));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => false }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({
  useNativeRevision: () => 0,
  useNativeRow: (model: string, key: unknown) => {
    if (model === "Structure") return { game_id: 1, entity_id: 7n, base: { category: world.category } };
    if (model === "Building" && key) return { category: BuildingType.ResourceWheat, paused: false };
    return undefined;
  },
}));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  configManager: {
    getActiveGameId: () => 1,
    buildingCostMode: "simple",
    getResourceBuildingProduced: (building: BuildingType) => getProducedResource(building),
    getRecipeInputs: () => [],
    getBuildingCategoryConfig: () => ({ population_cost: 0, capacity_grant: 0 }),
    canRefillProduction: () => false,
    isCommandEnabled: () => false,
  },
  getConsumedBy: () => [],
  getBuildingCosts: () => [],
  // Whether another could be built is not this test's business: the player's orders are off.
  structureMapPosition: () => null,
}));
vi.mock("@/ui/features/settlement/construction/realm-build-actions", () => ({
  resolveRealmHasAvailableBuildingTile: () => false,
}));

import { useUIStore } from "@/hooks/store/use-ui-store";
import { useSelectedTileDetails } from "./bottom-right-panel";

const Details = () => <>{useSelectedTileDetails()}</>;

const host = document.createElement("div");
const root = createRoot(host);
afterEach(() => act(() => root.render(null)));

/** The panel's "Produces" row for the wheat farm on a structure of this category. */
const producesOn = (category: StructureType) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  world.category = category;
  act(() => {
    useUIStore.setState({ structureEntityId: 7, selectedBuildingHex: { structureId: 7, innerCol: 11, innerRow: 9 } });
    root.render(<Details />);
  });
  const row = [...host.querySelectorAll("div")].find((div) => div.firstElementChild?.textContent === "Produces");
  return row?.querySelector(".ui-chip")?.textContent;
};

it("shows what the farm makes on this structure, a realm's rate or a village's, by the minute", () => {
  expect(producesOn(StructureType.Realm)).toBe("+360/min");
  expect(producesOn(StructureType.Village)).toBe("+30/min");
});
