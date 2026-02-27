import { BiomeType, getNeighborHexes, type HexEntityInfo, type HexPosition, TroopType } from "@bibliothecadao/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArmyActionManager } from "./army-action-manager";
import { configManager } from "./config-manager";
import { StaminaManager } from "./stamina-manager";

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: (component: unknown, entity: unknown) => {
    if (component instanceof Map) {
      return component.get(entity);
    }
    return undefined;
  },
}));

vi.mock("@dojoengine/utils", () => ({
  getEntityIdFromKeys: (keys: bigint[]) => keys[0].toString(),
}));

const TEST_ENTITY_ID = 1;
const TEST_FELT_CENTER = 100;

function setNestedMapValue<T>(map: Map<number, Map<number, T>>, col: number, row: number, value: T): void {
  if (!map.has(col)) {
    map.set(col, new Map<number, T>());
  }
  map.get(col)?.set(row, value);
}

function toNormalizedNeighborSet(feltOrigin: HexPosition): Set<string> {
  return new Set(
    getNeighborHexes(feltOrigin.col, feltOrigin.row).map(
      (neighbor) => `${neighbor.col - TEST_FELT_CENTER},${neighbor.row - TEST_FELT_CENTER}`,
    ),
  );
}

function createTestSetup() {
  const oldFeltStart = { col: TEST_FELT_CENTER, row: TEST_FELT_CENTER };
  const overrideFeltStart = { col: TEST_FELT_CENTER + 5, row: TEST_FELT_CENTER + 3 };
  const exploredHexes = new Map<number, Map<number, BiomeType>>();

  const allExploredNeighbors = [
    ...getNeighborHexes(oldFeltStart.col, oldFeltStart.row),
    ...getNeighborHexes(overrideFeltStart.col, overrideFeltStart.row),
  ];

  for (const neighbor of allExploredNeighbors) {
    setNestedMapValue(exploredHexes, neighbor.col - TEST_FELT_CENTER, neighbor.row - TEST_FELT_CENTER, 1 as BiomeType);
  }

  const components = {
    ExplorerTroops: new Map([
      [
        TEST_ENTITY_ID.toString(),
        {
          owner: 77,
          coord: { x: oldFeltStart.col, y: oldFeltStart.row },
          troops: {
            category: TroopType.Knight,
            count: 1_000n,
          },
        },
      ],
    ]),
  } as any;

  const manager = new ArmyActionManager(components, {} as any, TEST_ENTITY_ID as any);
  vi.spyOn(manager, "getFood").mockReturnValue({ wheat: 999, fish: 999 });

  return {
    manager,
    oldFeltStart,
    overrideFeltStart,
    exploredHexes,
    structureHexes: new Map<number, Map<number, HexEntityInfo>>(),
    armyHexes: new Map<number, Map<number, HexEntityInfo>>(),
    chestHexes: new Map<number, Map<number, HexEntityInfo>>(),
  };
}

describe("ArmyActionManager.findActionPaths origin precedence", () => {
  beforeEach(() => {
    vi.spyOn(configManager, "getMapCenter").mockReturnValue(TEST_FELT_CENTER);
    vi.spyOn(configManager, "getMinTravelStaminaCost").mockReturnValue(1);
    vi.spyOn(configManager, "getTravelStaminaCost").mockReturnValue(1);
    vi.spyOn(configManager, "getExploreStaminaCost").mockReturnValue(1);
    vi.spyOn(configManager, "getTravelFoodCostConfig").mockReturnValue({
      travelWheatBurnAmount: 0,
      travelFishBurnAmount: 0,
      exploreWheatBurnAmount: 0,
      exploreFishBurnAmount: 0,
    } as any);
    vi.spyOn(StaminaManager.prototype, "getStamina").mockReturnValue({
      amount: 1n,
      updated_tick: 0n,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("anchors first-hop highlights to startPositionOverride when override and ECS coord diverge", () => {
    const { manager, structureHexes, armyHexes, exploredHexes, chestHexes, overrideFeltStart } = createTestSetup();

    const actionPaths = (manager.findActionPaths as any)(
      structureHexes,
      armyHexes,
      exploredHexes,
      chestHexes,
      0,
      0,
      0x123n,
      overrideFeltStart,
    );

    const highlightedHexes = new Set(
      actionPaths.getHighlightedHexes().map((action) => `${action.hex.col},${action.hex.row}`),
    );

    expect(highlightedHexes).toEqual(toNormalizedNeighborSet(overrideFeltStart));
  });

  it("falls back to ExplorerTroops coord when no override is provided", () => {
    const { manager, structureHexes, armyHexes, exploredHexes, chestHexes, oldFeltStart } = createTestSetup();

    const actionPaths = manager.findActionPaths(
      structureHexes,
      armyHexes,
      exploredHexes,
      chestHexes,
      0,
      0,
      0x123n as any,
    );

    const highlightedHexes = new Set(
      actionPaths.getHighlightedHexes().map((action) => `${action.hex.col},${action.hex.row}`),
    );

    expect(highlightedHexes).toEqual(toNormalizedNeighborSet(oldFeltStart));
  });
});
