import {
  BiomeType,
  Direction,
  ETHEREAL_STRIDE,
  getLayerNeighborHexes,
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
  alt?: boolean;
}): { data: bigint; occupancy: { entity_id: number; category: number; is_structure: boolean } } {
  return {
    data: BigInt(input.biome) << 41n,
    occupancy: {
      entity_id: input.occupierId,
      category: input.occupierType,
      is_structure: false,
    },
  };
}

function createTestSetup(systemCalls: Record<string, unknown> = {}) {
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(TEST_FELT_CENTER);
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
          troops: {
            category: TroopType.Knight,
            count: BigInt(RESOURCE_PRECISION),
          },
        },
      ],
    ]),
    Positions: new Map([[TEST_ENTITY_ID.toString(), { alt: false, x: oldFeltStart.col, y: oldFeltStart.row }]]),
    TileOpt: new Map(),
  } as any;

  const read = (model: string, keys: { explorer_id?: number; alt?: boolean; col?: number; row?: number }) => {
    if (model === "ExplorerTroops") return components.ExplorerTroops.get(String(keys.explorer_id));
    const tile = components.TileOpt.get(toTileEntityKey(keys.alt!, keys.col!, keys.row!));
    if (model === "TileOpt") return tile && { data: tile.data };
    if (model === "TileOccupancy") return tile?.occupancy;
    return undefined;
  };
  const manager = new ArmyActionManager(
    {
      get: read,
      require: read,
      entityOccupancy: (_game: number, entity: number) => {
        const p = components.Positions.get(String(entity));
        return p && { col: p.x, row: p.y, alt: p.alt };
      },
    } as any,
    systemCalls as any,
    TEST_ENTITY_ID as any,
  );
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

  it("anchors first-hop highlights to the TileOccupancy — the same coord the submit freshness guard checks", () => {
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

  it.each([false, true])("uses stride-one portal access on the army's layer (alt=%s)", (alt) => {
    const { manager, components, structureHexes, armyHexes, exploredHexes, chestHexes, oldFeltStart } =
      createTestSetup();
    components.Positions.get(TEST_ENTITY_ID.toString()).alt = alt;
    const spire = getNeighborHexes(oldFeltStart.col, oldFeltStart.row)[0];
    components.TileOpt.set(
      toTileEntityKey(alt, spire.col, spire.row),
      buildTileOptData({ ...spire, alt, biome: 1, occupierType: TileOccupier.Spire, occupierId: 999 }),
    );
    const paths = manager.findActionPaths(structureHexes, armyHexes, exploredHexes, chestHexes, 0, 0, 0x123n as any);
    expect(ActionPaths.getActionType(paths.get(ActionPaths.posKey(spire)) ?? [])).toBe(ActionType.SpireTravel);
    if (alt) {
      const step = getLayerNeighborHexes(oldFeltStart.col, oldFeltStart.row, true)[1];
      expect(ActionPaths.getActionType(paths.get(ActionPaths.posKey(step)) ?? [])).toBe(ActionType.Explore);
      expect(step.row - oldFeltStart.row).toBe(ETHEREAL_STRIDE);
      const surfaceStep = getNeighborHexes(oldFeltStart.col, oldFeltStart.row)[1];
      expect(paths.get(ActionPaths.posKey(surfaceStep))).toBeUndefined();
    }
  });

  it("uses ethereal attack distance for mines and armies", () => {
    const { manager, components, structureHexes, armyHexes, exploredHexes, chestHexes, oldFeltStart } =
      createTestSetup();
    components.Positions.get(TEST_ENTITY_ID.toString()).alt = true;
    const mineHex = { col: oldFeltStart.col + ETHEREAL_STRIDE, row: oldFeltStart.row };
    const tooFar = { col: mineHex.col + 1, row: mineHex.row };
    setNestedMapValue(structureHexes, mineHex.col - TEST_FELT_CENTER, mineHex.row - TEST_FELT_CENTER, {
      id: 21,
      owner: 0x999n,
    } as HexEntityInfo);
    setNestedMapValue(armyHexes, tooFar.col - TEST_FELT_CENTER, tooFar.row - TEST_FELT_CENTER, {
      id: 22,
      owner: 0x999n,
    } as HexEntityInfo);
    vi.mocked(StaminaManager.prototype.getStamina).mockReturnValue({ amount: 5n, updated_tick: 0n } as any);
    const paths = manager.findActionPaths(structureHexes, armyHexes, exploredHexes, chestHexes, 0, 0, 0x123n as any);
    expect(ActionPaths.getActionType(paths.get(ActionPaths.posKey(mineHex)) ?? [])).toBe(ActionType.Attack);
    expect(paths.get(ActionPaths.posKey(tooFar))).toBeUndefined();
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
  it("rejects explore when path[0] differs from TileOccupancy", async () => {
    const systemCalls = {
      explorer_explore: vi.fn().mockResolvedValue({}),
      explorer_travel: vi.fn().mockResolvedValue({}),
      toggle_alternate: vi.fn().mockResolvedValue({}),
    };
    const { manager, oldFeltStart } = createTestSetup(systemCalls);
    // Pick two adjacent neighbor hexes that both differ from oldFeltStart.
    // path[0] claims the army is at a neighbor (not the oldFeltStart that
    // TileOccupancy reports), so the freshness guard must reject.
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

  it("allows explore when path[0] matches TileOccupancy", async () => {
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
  it.each([false, true])("calls toggle_alternate at stride one on either layer (alt=%s)", async (alt) => {
    const systemCalls = {
      toggle_alternate: vi.fn().mockResolvedValue({}),
      explorer_travel: vi.fn().mockResolvedValue({}),
      explorer_explore: vi.fn().mockResolvedValue({}),
    };
    const { manager, components, oldFeltStart } = createTestSetup(systemCalls);
    components.Positions.get(TEST_ENTITY_ID.toString()).alt = alt;
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

describe("ArmyActionManager ethereal submissions", () => {
  it.each([
    [false, 100],
    [true, 100],
    [true, 101],
  ] as const)("packs the layer and follows contract row parity (alt=%s, row=%s)", async (alt, row) => {
    const explorer_explore = vi.fn().mockResolvedValue({});
    const { manager, components, oldFeltStart } = createTestSetup({ explorer_explore });
    oldFeltStart.row = row;
    Object.assign(components.Positions.get(TEST_ENTITY_ID.toString()), { alt, y: row });
    const stride = alt ? ETHEREAL_STRIDE : 1;
    const destination = {
      col: oldFeltStart.col + (row % 2 === 0 ? stride : 0),
      row: row + stride,
      direction: Direction.NORTH_EAST,
    };
    await manager.moveArmy(
      {} as any,
      [
        { hex: oldFeltStart, actionType: ActionType.Move },
        { hex: destination, actionType: ActionType.Explore },
      ],
      false,
      0,
    );
    expect(explorer_explore).toHaveBeenCalledWith(
      expect.objectContaining({
        directions: [destination.direction],
      }),
    );
  });

  it("rejects a stale surface path after the army crosses", async () => {
    const explorer_travel = vi.fn();
    const { manager, components, oldFeltStart } = createTestSetup({ explorer_travel });
    components.Positions.get(TEST_ENTITY_ID.toString()).alt = true;
    const destination = getNeighborHexes(oldFeltStart.col, oldFeltStart.row)[0];
    await expect(
      manager.moveArmy(
        {} as any,
        [
          { hex: oldFeltStart, actionType: ActionType.Move },
          { hex: destination, actionType: ActionType.Move },
        ],
        true,
        0,
      ),
    ).rejects.toThrow("Invalid travel direction");
    expect(explorer_travel).not.toHaveBeenCalled();
  });
});
