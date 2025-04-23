import { getComponentValue, type Entity } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { BiomeType, FELT_CENTER, getNeighborHexes, ClientComponents, ContractAddress, HexEntityInfo, ID } from "@bibliothecadao/types";
import { ActionPath, ActionPaths, ActionType } from "../utils/action-paths";

export class StructureActionManager {
  private readonly entity: Entity;

  constructor(
    private readonly components: ClientComponents,
    entityId: ID,
  ) {
    this.entity = getEntityIdFromKeys([BigInt(entityId)]);
  }

  private readonly _getCurrentPosition = () => {
    const structure = getComponentValue(this.components.Structure, this.entity);
    return { col: structure!.base.coord_x, row: structure!.base.coord_y };
  };

  /**
   * Find action paths for a structure, focusing on attacking or helping surrounding armies
   * @param structureHexes Map of structure positions
   * @param armyHexes Map of army positions
   * @param exploredHexes Map of explored hexes with their biome types
   * @returns ActionPaths object containing possible attack or help actions
   */
  public findActionPaths(
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
    playerAddress: ContractAddress,
  ): ActionPaths {
    const actionPaths = new ActionPaths();
    const startPos = this._getCurrentPosition();

    // Get the structure owner to determine which armies can be attacked
    const structure = getComponentValue(this.components.Structure, this.entity);
    if (!structure) return actionPaths;

    // Process immediate neighbors only
    const neighbors = getNeighborHexes(startPos.col, startPos.row);

    for (const { col, row } of neighbors) {
      const isExplored = exploredHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;

      // Skip unexplored hexes
      if (!isExplored) continue;

      const hasArmy = armyHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
      const isArmyMine = armyHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER)?.owner === playerAddress || false;

      // Check if there's an army
      if (hasArmy) {
        const biome = exploredHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER);

        // Determine action type based on ownership
        const actionType = isArmyMine ? ActionType.Help : ActionType.Attack;

        // Create an action path
        const path: ActionPath[] = [
          { hex: { col: startPos.col, row: startPos.row }, actionType: ActionType.Move },
          {
            hex: { col, row },
            actionType: actionType,
            biomeType: biome,
            staminaCost: 0, // Structures don't use stamina for actions
          },
        ];

        // Add the path to the action paths
        actionPaths.set(ActionPaths.posKey({ col, row }), path);
      }
    }

    return actionPaths;
  }
}
