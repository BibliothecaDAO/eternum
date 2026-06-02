import { BiomeType, getHexesWithinRadius, getNeighborHexes, HexEntityInfo } from "@bibliothecadao/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionPaths, ActionType } from "../utils/action-paths";
import { configManager } from "./config-manager";
import { StructureActionManager } from "./structure-action-manager";

vi.mock("../utils", () => ({
  FELT_CENTER: () => TEST_FELT_CENTER,
}));

const TEST_FELT_CENTER = 100;
const STRUCTURE_POSITION = { col: TEST_FELT_CENTER, row: TEST_FELT_CENTER };

function setNestedMapValue<T>(map: Map<number, Map<number, T>>, col: number, row: number, value: T): void {
  if (!map.has(col)) {
    map.set(col, new Map<number, T>());
  }
  map.get(col)?.set(row, value);
}

function findRadiusTwoHex() {
  const adjacentKeys = new Set(
    getNeighborHexes(STRUCTURE_POSITION.col, STRUCTURE_POSITION.row).map((hex) => ActionPaths.posKey(hex)),
  );
  return getHexesWithinRadius(STRUCTURE_POSITION.col, STRUCTURE_POSITION.row, 2).find(
    (hex) => !adjacentKeys.has(ActionPaths.posKey(hex)),
  )!;
}

describe("StructureActionManager.findActionPaths", () => {
  beforeEach(() => {
    vi.spyOn(configManager, "getMapCenter").mockReturnValue(TEST_FELT_CENTER);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not add ranged attacks for unexplored enemy armies", () => {
    const targetHex = findRadiusTwoHex();
    const armyHexes = new Map<number, Map<number, HexEntityInfo>>();
    const exploredHexes = new Map<number, Map<number, BiomeType>>();
    setNestedMapValue(armyHexes, targetHex.col - TEST_FELT_CENTER, targetHex.row - TEST_FELT_CENTER, {
      owner: 0x999n,
    } as HexEntityInfo);

    const actionPaths = new StructureActionManager().findActionPaths(
      STRUCTURE_POSITION,
      armyHexes,
      exploredHexes,
      0x123n as never,
      2,
    );

    expect(actionPaths.get(ActionPaths.posKey(targetHex))).toBeUndefined();
  });

  it("adds ranged attacks for explored enemy armies", () => {
    const targetHex = findRadiusTwoHex();
    const armyHexes = new Map<number, Map<number, HexEntityInfo>>();
    const exploredHexes = new Map<number, Map<number, BiomeType>>();
    setNestedMapValue(armyHexes, targetHex.col - TEST_FELT_CENTER, targetHex.row - TEST_FELT_CENTER, {
      owner: 0x999n,
    } as HexEntityInfo);
    setNestedMapValue(
      exploredHexes,
      targetHex.col - TEST_FELT_CENTER,
      targetHex.row - TEST_FELT_CENTER,
      1 as BiomeType,
    );

    const actionPaths = new StructureActionManager().findActionPaths(
      STRUCTURE_POSITION,
      armyHexes,
      exploredHexes,
      0x123n as never,
      2,
    );

    expect(ActionPaths.getActionType(actionPaths.get(ActionPaths.posKey(targetHex)) ?? [])).toBe(ActionType.Attack);
  });
});
