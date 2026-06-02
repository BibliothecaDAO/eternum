import {
  BiomeType,
  ContractAddress,
  getHexesWithinRadius,
  getNeighborHexes,
  HexEntityInfo,
  type HexPosition,
} from "@bibliothecadao/types";
import { Position } from "../systems";
import { FELT_CENTER } from "../utils";
import { ActionPath, ActionPaths, ActionType } from "../utils/action-paths";

export class StructureActionManager {
  private readonly FELT_CENTER: number;

  constructor() {
    this.FELT_CENTER = FELT_CENTER();
  }

  /**
   * Find action paths for a structure, focusing on attacking or helping surrounding armies
   * @param position The structure's hex position
   * @param armyHexes Map of army positions
   * @param exploredHexes Map of explored hexes with their biome types
   * @param playerAddress The current player's address
   * @returns ActionPaths object containing possible attack or help actions
   */
  public findActionPaths(
    rawPosition: HexPosition,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
    playerAddress: ContractAddress,
    attackRange = 1,
  ): ActionPaths {
    const actionPaths = new ActionPaths();

    const contractPos = new Position({ x: rawPosition.col, y: rawPosition.row }).getContract();
    const position = { col: contractPos.x, row: contractPos.y };

    this.addAdjacentSupportActionPaths(actionPaths, position, armyHexes, exploredHexes, playerAddress);
    this.addAttackActionPaths(actionPaths, position, armyHexes, exploredHexes, playerAddress, attackRange);

    return actionPaths;
  }

  private addAdjacentSupportActionPaths(
    actionPaths: ActionPaths,
    position: HexPosition,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
    playerAddress: ContractAddress,
  ) {
    const neighbors = getNeighborHexes(position.col, position.row);

    for (const { col, row } of neighbors) {
      const isExplored = exploredHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;

      if (!isExplored) continue;

      const hasArmy = armyHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
      const isArmyMine =
        armyHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER)?.owner === playerAddress || false;

      if (hasArmy) {
        const biome = exploredHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);

        if (!isArmyMine) continue;

        const path: ActionPath[] = [
          { hex: { col: position.col, row: position.row }, actionType: ActionType.Move },
          {
            hex: { col, row },
            actionType: ActionType.Help,
            biomeType: biome,
            staminaCost: 0, // Structures don't use stamina for actions
          },
        ];

        actionPaths.set(ActionPaths.posKey({ col, row }), path);
      } else {
        const biome = exploredHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);

        const path: ActionPath[] = [
          { hex: { col: position.col, row: position.row }, actionType: ActionType.Move },
          { hex: { col, row }, actionType: ActionType.CreateArmy, biomeType: biome },
        ];

        actionPaths.set(ActionPaths.posKey({ col, row }), path);
      }
    }
  }

  private addAttackActionPaths(
    actionPaths: ActionPaths,
    position: HexPosition,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
    playerAddress: ContractAddress,
    attackRange: number,
  ) {
    for (const { col, row } of getHexesWithinRadius(position.col, position.row, attackRange)) {
      const exploredRow = exploredHexes.get(col - this.FELT_CENTER);
      if (!exploredRow?.has(row - this.FELT_CENTER)) continue;

      const targetArmy = armyHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);
      if (!targetArmy || targetArmy.owner === playerAddress) continue;

      const biome = exploredRow.get(row - this.FELT_CENTER);

      actionPaths.set(ActionPaths.posKey({ col, row }), [
        { hex: { col: position.col, row: position.row }, actionType: ActionType.Move },
        {
          hex: { col, row },
          actionType: ActionType.Attack,
          biomeType: biome,
          staminaCost: 0,
        },
      ]);
    }
  }
}
