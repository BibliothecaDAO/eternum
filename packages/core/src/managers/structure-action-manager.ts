import { BiomeType, ContractAddress, getNeighborHexes, HexEntityInfo, type HexPosition } from "@bibliothecadao/types";
import { FELT_CENTER } from "../utils/utils";
import { ActionPath, ActionPaths, ActionType } from "../utils/action-paths";
import { configManager } from "./config-manager";
import { isViewerOwner } from "../utils/viewer";

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
    contractPosition: HexPosition,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
    playerAddress: ContractAddress,
    /** Whether anything occupies the tile (an army, a site, a chest): the contract raises no army onto it. */
    isOccupied: (hex: HexPosition) => boolean,
    guarded: boolean,
  ): ActionPaths {
    const actionPaths = new ActionPaths();

    const position = { col: contractPosition.col, row: contractPosition.row };

    this.addAdjacentSupportActionPaths(actionPaths, position, armyHexes, exploredHexes, playerAddress, isOccupied);
    if (guarded) this.addAttackActionPaths(actionPaths, position, armyHexes, exploredHexes, playerAddress);

    return actionPaths;
  }

  private addAdjacentSupportActionPaths(
    actionPaths: ActionPaths,
    position: HexPosition,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
    playerAddress: ContractAddress,
    isOccupied: (hex: HexPosition) => boolean,
  ) {
    const neighbors = getNeighborHexes(position.col, position.row);

    for (const { col, row } of neighbors) {
      const isExplored = exploredHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;

      if (!isExplored) continue;

      const hasArmy = armyHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
      const isArmyMine = isViewerOwner(
        armyHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER)?.owner,
        playerAddress,
      );

      if (hasArmy) {
        const biome = exploredHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);

        if (!isArmyMine) continue;
        if (configManager.helpTransfers("from-structure").length === 0) continue;

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
      } else if (!isOccupied({ col, row })) {
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
  ) {
    for (const { col, row } of getNeighborHexes(position.col, position.row)) {
      const exploredRow = exploredHexes.get(col - this.FELT_CENTER);
      if (!exploredRow?.has(row - this.FELT_CENTER)) continue;

      const targetArmy = armyHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);
      if (!targetArmy || isViewerOwner(targetArmy.owner, playerAddress)) continue;
      // A structure's guard attacking an army is its own command, which a game may leave out (Frontier does).
      if (!configManager.isCommandEnabled("GuardAttack")) {
        actionPaths.refuse(ActionPaths.posKey({ col, row }), { reason: "no-attack" });
        continue;
      }

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
