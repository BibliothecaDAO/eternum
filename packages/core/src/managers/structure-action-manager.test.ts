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
    vi.spyOn(configManager, "isCommandEnabled").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("raises an army only onto an explored neighbour nothing occupies: not beside a site or a chest", () => {
    const [site, open] = getNeighborHexes(STRUCTURE_POSITION.col, STRUCTURE_POSITION.row);
    const exploredHexes = new Map<number, Map<number, BiomeType>>();
    for (const hex of [site, open]) {
      setNestedMapValue(exploredHexes, hex.col - TEST_FELT_CENTER, hex.row - TEST_FELT_CENTER, 1 as BiomeType);
    }
    const isOccupied = (hex: { col: number; row: number }) => hex.col === site.col && hex.row === site.row;

    const actionPaths = new StructureActionManager().findActionPaths(
      STRUCTURE_POSITION,
      new Map(),
      exploredHexes,
      0x123n as never,
      isOccupied,
    );

    expect(actionPaths.get(ActionPaths.posKey(site))).toBeUndefined();
    expect(ActionPaths.getActionType(actionPaths.get(ActionPaths.posKey(open))!)).toBe(ActionType.CreateArmy);
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
      () => false,
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
      () => false,
      2,
    );

    expect(ActionPaths.getActionType(actionPaths.get(ActionPaths.posKey(targetHex)) ?? [])).toBe(ActionType.Attack);
  });

  it("offers no guard attack where the game leaves GuardAttack out, and says so", () => {
    vi.spyOn(configManager, "isCommandEnabled").mockImplementation((command) => command !== "GuardAttack");
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
      () => false,
      2,
    );

    expect(actionPaths.get(ActionPaths.posKey(targetHex))).toBeUndefined();
    expect(actionPaths.getRefusals().get(ActionPaths.posKey(targetHex))).toEqual({ reason: "no-attack" });
  });
});
