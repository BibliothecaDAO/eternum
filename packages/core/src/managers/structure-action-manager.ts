import { getComponentValue, type Entity } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { BiomeType, FELT_CENTER, getNeighborHexes } from "../constants";
import { ClientComponents } from "../dojo/create-client-components";
import { HexEntityInfo, ID } from "../types";
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
   * Find action paths for a structure, focusing only on attacking surrounding armies
   * @param structureHexes Map of structure positions
   * @param armyHexes Map of army positions
   * @param exploredHexes Map of explored hexes with their biome types
   * @returns ActionPaths object containing possible attack actions
   */
  public findActionPaths(
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
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
      // todo: add this back when finish debug
      // const isArmyMine = armyHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER) || false;

      // Check if there's an army that can be attacked (not owned by the structure owner)
      if (hasArmy) {
        const biome = exploredHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER);

        // Create an attack action path
        const path: ActionPath[] = [
          { hex: { col: startPos.col, row: startPos.row }, actionType: ActionType.Move },
          {
            hex: { col, row },
            actionType: ActionType.Attack,
            biomeType: biome,
            staminaCost: 0, // Structures don't use stamina for attacks
          },
        ];

        // Add the path to the action paths
        actionPaths.set(ActionPaths.posKey({ col, row }), path);
      }
    }

    return actionPaths;
  }
}
