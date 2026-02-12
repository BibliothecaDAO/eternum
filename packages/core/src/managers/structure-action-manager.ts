import { BiomeType, ContractAddress, getNeighborHexes, HexEntityInfo, type HexPosition } from "@bibliothecadao/types";
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
  ): ActionPaths {
    const actionPaths = new ActionPaths();

    const contractPos = new Position({ x: rawPosition.col, y: rawPosition.row }).getContract();
    const position = { col: contractPos.x, row: contractPos.y };

    // Process immediate neighbors only
    const neighbors = getNeighborHexes(position.col, position.row);

    for (const { col, row } of neighbors) {
      const isExplored = exploredHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;

      // Skip unexplored hexes
      if (!isExplored) continue;

      const hasArmy = armyHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
      const isArmyMine =
        armyHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER)?.owner === playerAddress || false;

      // Check if there's an army
      if (hasArmy) {
        const biome = exploredHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);

        // Determine action type based on ownership
        const actionType = isArmyMine ? ActionType.Help : ActionType.Attack;

        // Create an action path
        const path: ActionPath[] = [
          { hex: { col: position.col, row: position.row }, actionType: ActionType.Move },
          {
            hex: { col, row },
            actionType: actionType,
            biomeType: biome,
            staminaCost: 0, // Structures don't use stamina for actions
          },
        ];

        // Add the path to the action paths
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

    return actionPaths;
  }
}
