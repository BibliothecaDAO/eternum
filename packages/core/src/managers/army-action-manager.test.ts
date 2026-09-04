import {
  BiomeType,
  getDirectionBetweenAdjacentHexes,
  getHexesWithinRadius,
  getNeighborHexes,
  type HexEntityInfo,
  type HexPosition,
  RESOURCE_PRECISION,
  TileOccupier,
  TroopType,
} from "@bibliothecadao/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArmyActionManager } from "./army-action-manager";
import { configManager } from "./config-manager";
import { StaminaManager } from "./stamina-manager";
import { ActionPaths, ActionType } from "../utils/action-paths";

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: (component: unknown, entity: unknown) => {
    if (component instanceof Map) {
      return component.get(entity);
    }
    return undefined;
  },
}));

vi.mock("@dojoengine/utils", () => ({
  getEntityIdFromKeys: (keys: bigint[]) => keys.map((key) => key.toString()).join(":"),
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

function toTileEntityKey(alt: boolean, col: number, row: number): string {
  return `${alt ? 1 : 0}:${col}:${row}`;
}

function buildTileOptData(input: {
  col: number;
  row: number;
  biome: number;
  occupierType: number;
  occupierId: number;
}): {
  data: bigint;
} {
  const data =
    (BigInt(input.occupierType) << 1n) |
    (BigInt(input.occupierId) << 9n) |
    (BigInt(input.biome) << 41n) |
    (BigInt(input.row) << 49n) |
    (BigInt(input.col) << 81n);
  return { data };
}

function createTestSetup(systemCalls: Record<string, unknown> = {}) {
  const oldFeltStart = { col: TEST_FELT_CENTER, row: TEST_FELT_CENTER };
  const exploredHexes = new Map<number, Map<number, BiomeType>>();

  const allExploredNeighbors = [...getNeighborHexes(oldFeltStart.col, oldFeltStart.row)];

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
            count: BigInt(RESOURCE_PRECISION),
          },
        },
      ],
    ]),
    Resource: createOptimisticResourceComponent({
      "77": buildResourceBalances({
        WHEAT_BALANCE: precise(100),
        FISH_BALANCE: precise(100),
      }),
    }),
    TileOpt: new Map(),
  } as any;

  const manager = new ArmyActionManager(components, systemCalls as any, TEST_ENTITY_ID as any);
  vi.spyOn(manager, "getFood").mockReturnValue({ wheat: 999, fish: 999 });

  return {
    manager,
    components,
    oldFeltStart,
    exploredHexes,
    structureHexes: new Map<number, Map<number, HexEntityInfo>>(),
    armyHexes: new Map<number, Map<number, HexEntityInfo>>(),
    chestHexes: new Map<number, Map<number, HexEntityInfo>>(),
  };
}

function createOptimisticResourceComponent(resourcesByEntity: Record<string, Record<string, unknown>>) {
  const originalValues = new Map(Object.entries(resourcesByEntity).map(([entity, value]) => [entity, { ...value }]));
  const component = new Map(Object.entries(resourcesByEntity).map(([entity, value]) => [entity, { ...value }]));
  const overrides = new Map<string, { entity: string; value: Record<string, unknown> }>();
  const overridesByEntity = new Map<string, string[]>();

  return Object.assign(component, {
    addOverride: (overrideId: string, update: { entity: string; value: Record<string, unknown> }) => {
      overrides.set(overrideId, update);
      const entityOverrides = overridesByEntity.get(update.entity) ?? [];
      entityOverrides.push(overrideId);
      overridesByEntity.set(update.entity, entityOverrides);
      applyLatestOverride(component, originalValues, overrides, overridesByEntity, update.entity);
    },
    removeOverride: (overrideId: string) => {
      const override = overrides.get(overrideId);
      if (!override) return;
      overrides.delete(overrideId);
      const entityOverrides = overridesByEntity.get(override.entity)?.filter((id) => id !== overrideId) ?? [];
      if (entityOverrides.length > 0) {
        overridesByEntity.set(override.entity, entityOverrides);
      } else {
        overridesByEntity.delete(override.entity);
      }
      applyLatestOverride(component, originalValues, overrides, overridesByEntity, override.entity);
    },
  });
}

function applyLatestOverride(
  component: Map<string, Record<string, unknown>>,
  originalValues: Map<string, Record<string, unknown>>,
  overrides: Map<string, { entity: string; value: Record<string, unknown> }>,
  overridesByEntity: Map<string, string[]>,
  entity: string,
) {
  const latestOverrideId = overridesByEntity.get(entity)?.at(-1);
  const originalValue = originalValues.get(entity) ?? {};
  const latestOverride = latestOverrideId ? overrides.get(latestOverrideId)?.value : undefined;
  component.set(entity, latestOverride ? { ...originalValue, ...latestOverride } : { ...originalValue });
}

function buildResourceBalances(overrides: Record<string, bigint>) {
  return {
    entity_id: 77,
    weight: { capacity: 0n, weight: 0n },
    WHEAT_BALANCE: 0n,
    FISH_BALANCE: 0n,
    ...overrides,
  };
}

function precise(amount: number) {
  return BigInt(amount) * BigInt(RESOURCE_PRECISION);
}

describe("ArmyActionManager.findActionPaths origin precedence", () => {
  beforeEach(() => {
    vi.spyOn(configManager, "getMapCenter").mockReturnValue(TEST_FELT_CENTER);
    vi.spyOn(configManager, "getMinTravelStaminaCost").mockReturnValue(1);
    vi.spyOn(configManager, "getTravelStaminaCost").mockReturnValue(1);
    vi.spyOn(configManager, "getExploreStaminaCost").mockReturnValue(1);
    vi.spyOn(configManager, "getCombatConfig").mockReturnValue({
      stamina_attack_req: 5,
    } as any);
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

  it("anchors first-hop highlights to the ExplorerTroops coord — the same coord the submit freshness guard checks", () => {
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

  it("marks adjacent world spires as spire travel actions", () => {
    const { manager, components, structureHexes, armyHexes, exploredHexes, chestHexes, oldFeltStart } =
      createTestSetup();
    const spireHex = getNeighborHexes(oldFeltStart.col, oldFeltStart.row)[0];
    components.TileOpt.set(
      toTileEntityKey(false, spireHex.col, spireHex.row),
      buildTileOptData({
        col: spireHex.col,
        row: spireHex.row,
        biome: 1,
        occupierType: TileOccupier.Spire,
        occupierId: 999,
      }),
    );

    const actionPaths = manager.findActionPaths(
      structureHexes,
      armyHexes,
      exploredHexes,
      chestHexes,
      0,
      0,
      0x123n as any,
    );

    const spireActionPath = actionPaths.get(ActionPaths.posKey(spireHex));
    expect(spireActionPath).toBeDefined();
    expect(ActionPaths.getActionType(spireActionPath ?? [])).toBe(ActionType.SpireTravel);
  });

  it("omits adjacent enemy structure attack paths when attack stamina is below the required threshold", () => {
    const { manager, structureHexes, armyHexes, exploredHexes, chestHexes, oldFeltStart } = createTestSetup();
    const targetHex = getNeighborHexes(oldFeltStart.col, oldFeltStart.row)[0];

    setNestedMapValue(structureHexes, targetHex.col - TEST_FELT_CENTER, targetHex.row - TEST_FELT_CENTER, {
      owner: 0x999n,
    } as HexEntityInfo);
    vi.mocked(StaminaManager.prototype.getStamina).mockReturnValue({
      amount: 4n,
      updated_tick: 0n,
    } as any);

    const actionPaths = manager.findActionPaths(
      structureHexes,
      armyHexes,
      exploredHexes,
      chestHexes,
      0,
      0,
      0x123n as any,
    );

    expect(actionPaths.get(ActionPaths.posKey(targetHex))).toBeUndefined();
  });

  it("keeps adjacent enemy structure attack paths when attack stamina meets the required threshold", () => {
    const { manager, structureHexes, armyHexes, exploredHexes, chestHexes, oldFeltStart } = createTestSetup();
    const targetHex = getNeighborHexes(oldFeltStart.col, oldFeltStart.row)[0];

    setNestedMapValue(structureHexes, targetHex.col - TEST_FELT_CENTER, targetHex.row - TEST_FELT_CENTER, {
      owner: 0x999n,
    } as HexEntityInfo);
    vi.mocked(StaminaManager.prototype.getStamina).mockReturnValue({
      amount: 5n,
      updated_tick: 0n,
    } as any);

    const actionPaths = manager.findActionPaths(
      structureHexes,
      armyHexes,
      exploredHexes,
      chestHexes,
      0,
      0,
      0x123n as any,
    );

    expect(ActionPaths.getActionType(actionPaths.get(ActionPaths.posKey(targetHex)) ?? [])).toBe(ActionType.Attack);
  });

  it("adds radius-two attack paths for crossbowman armies", () => {
    const { manager, components, structureHexes, armyHexes, exploredHexes, chestHexes, oldFeltStart } =
      createTestSetup();
    const adjacentKeys = new Set(
      getNeighborHexes(oldFeltStart.col, oldFeltStart.row).map((hex) => ActionPaths.posKey(hex)),
    );
    const targetHex = getHexesWithinRadius(oldFeltStart.col, oldFeltStart.row, 2).find(
      (hex) => !adjacentKeys.has(ActionPaths.posKey(hex)),
    )!;

    components.ExplorerTroops.get(TEST_ENTITY_ID.toString())!.troops.category = TroopType.Crossbowman;
    setNestedMapValue(armyHexes, targetHex.col - TEST_FELT_CENTER, targetHex.row - TEST_FELT_CENTER, {
      owner: 0x999n,
    } as HexEntityInfo);
    vi.mocked(StaminaManager.prototype.getStamina).mockReturnValue({
      amount: 5n,
      updated_tick: 0n,
    } as any);

    const actionPaths = manager.findActionPaths(
      structureHexes,
      armyHexes,
      exploredHexes,
      chestHexes,
      0,
      0,
      0x123n as any,
    );

    expect(ActionPaths.getActionType(actionPaths.get(ActionPaths.posKey(targetHex)) ?? [])).toBe(ActionType.Attack);
  });

  it("does not add radius-two attack paths for non-ranged armies", () => {
    const { manager, structureHexes, armyHexes, exploredHexes, chestHexes, oldFeltStart } = createTestSetup();
    const adjacentKeys = new Set(
      getNeighborHexes(oldFeltStart.col, oldFeltStart.row).map((hex) => ActionPaths.posKey(hex)),
    );
    const targetHex = getHexesWithinRadius(oldFeltStart.col, oldFeltStart.row, 2).find(
      (hex) => !adjacentKeys.has(ActionPaths.posKey(hex)),
    )!;

    setNestedMapValue(armyHexes, targetHex.col - TEST_FELT_CENTER, targetHex.row - TEST_FELT_CENTER, {
      owner: 0x999n,
    } as HexEntityInfo);
    vi.mocked(StaminaManager.prototype.getStamina).mockReturnValue({
      amount: 5n,
      updated_tick: 0n,
    } as any);

    const actionPaths = manager.findActionPaths(
      structureHexes,
      armyHexes,
      exploredHexes,
      chestHexes,
      0,
      0,
      0x123n as any,
    );

    expect(actionPaths.get(ActionPaths.posKey(targetHex))).toBeUndefined();
  });
});

describe("ArmyActionManager.moveArmy explore position-freshness guard", () => {
  it("rejects explore when path[0] differs from ExplorerTroops.coord", async () => {
    const systemCalls = {
      explorer_explore: vi.fn().mockResolvedValue({}),
      explorer_travel: vi.fn().mockResolvedValue({}),
      toggle_alternate: vi.fn().mockResolvedValue({}),
    };
    const { manager, oldFeltStart } = createTestSetup(systemCalls);
    // Pick two adjacent neighbor hexes that both differ from oldFeltStart.
    // path[0] claims the army is at a neighbor (not the oldFeltStart that
    // ExplorerTroops.coord reports), so the freshness guard must reject.
    const neighbor1 = getNeighborHexes(oldFeltStart.col, oldFeltStart.row)[0];
    const neighbor2 = getNeighborHexes(neighbor1.col, neighbor1.row).find(
      (n) => n.col !== oldFeltStart.col || n.row !== oldFeltStart.row,
    )!;
    expect(neighbor2).toBeDefined();

    const actionPath = [
      { hex: { col: neighbor1.col, row: neighbor1.row }, actionType: ActionType.Explore },
      { hex: { col: neighbor2.col, row: neighbor2.row }, actionType: ActionType.Explore },
    ];

    const signer = { address: "0x123" } as any;

    await expect(manager.moveArmy(signer, actionPath as any, false, 0)).rejects.toThrow(/drifted|position/i);
    expect(systemCalls.explorer_explore).not.toHaveBeenCalled();
  });

  it("allows explore when path[0] matches ExplorerTroops.coord", async () => {
    const systemCalls = {
      explorer_explore: vi.fn().mockResolvedValue({}),
      explorer_travel: vi.fn().mockResolvedValue({}),
      toggle_alternate: vi.fn().mockResolvedValue({}),
    };
    const { manager, oldFeltStart } = createTestSetup(systemCalls);
    const neighbor = getNeighborHexes(oldFeltStart.col, oldFeltStart.row)[0];

    const actionPath = [
      { hex: { col: oldFeltStart.col, row: oldFeltStart.row }, actionType: ActionType.Explore },
      { hex: { col: neighbor.col, row: neighbor.row }, actionType: ActionType.Explore },
    ];

    const signer = { address: "0x123" } as any;

    await manager.moveArmy(signer, actionPath as any, false, 0);

    expect(systemCalls.explorer_explore).toHaveBeenCalledTimes(1);
  });

  it("rejects explore when an obsolete provisional coord reports the destination", async () => {
    const systemCalls = {
      explorer_explore: vi.fn().mockResolvedValue({}),
      explorer_travel: vi.fn().mockResolvedValue({}),
      toggle_alternate: vi.fn().mockResolvedValue({}),
    };
    const { manager, oldFeltStart } = createTestSetup(systemCalls);
    // The path starts at a neighbor while ExplorerTroops still reports
    // oldFeltStart. Destination matching is not freshness evidence: movement
    // now starts only from the authoritative source coordinate.
    const neighbor = getNeighborHexes(oldFeltStart.col, oldFeltStart.row)[0];

    const actionPath = [
      { hex: { col: neighbor.col, row: neighbor.row }, actionType: ActionType.Explore },
      { hex: { col: oldFeltStart.col, row: oldFeltStart.row }, actionType: ActionType.Explore },
    ];

    const signer = { address: "0x123" } as any;

    await expect(manager.moveArmy(signer, actionPath as any, false, 0)).rejects.toThrow(/drifted|position/i);
    expect(systemCalls.explorer_explore).not.toHaveBeenCalled();
  });
});

describe("ArmyActionManager.moveArmy spire traversal", () => {
  it("calls toggle_alternate for spire travel action paths", async () => {
    const systemCalls = {
      toggle_alternate: vi.fn().mockResolvedValue({}),
      explorer_travel: vi.fn().mockResolvedValue({}),
      explorer_explore: vi.fn().mockResolvedValue({}),
    };
    const { manager, oldFeltStart } = createTestSetup(systemCalls);
    const spireHex = getNeighborHexes(oldFeltStart.col, oldFeltStart.row)[0];
    const spireDirection = getDirectionBetweenAdjacentHexes(oldFeltStart, spireHex);

    expect(spireDirection).toBeDefined();

    const actionPath = [
      {
        hex: { col: oldFeltStart.col, row: oldFeltStart.row },
        actionType: ActionType.Move,
      },
      {
        hex: { col: spireHex.col, row: spireHex.row },
        actionType: ActionType.SpireTravel,
      },
    ];

    const signer = { address: "0x123" } as any;

    await manager.moveArmy(signer, actionPath as any, true, 0);

    expect(systemCalls.toggle_alternate).toHaveBeenCalledWith({
      signer,
      explorer_id: TEST_ENTITY_ID,
      spire_direction: spireDirection,
    });
    expect(systemCalls.explorer_travel).not.toHaveBeenCalled();
    expect(systemCalls.explorer_explore).not.toHaveBeenCalled();
  });
});
