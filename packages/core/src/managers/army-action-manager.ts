import {
  type BiomeType,
  type ClientComponents,
  type ContractAddress,
  type DojoAccount,
  FELT_CENTER,
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
  type HexEntityInfo,
  type HexPosition,
  type ID,
  ResourcesIds,
  type SystemCalls,
  type TroopType,
} from "@bibliothecadao/types";
import { type Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import type { Account, AccountInterface } from "starknet";
import { divideByPrecision, getRemainingCapacityInKg } from "..";
import { type ActionPath, ActionPaths, ActionType } from "../utils/action-paths";
import { configManager } from "./config-manager";
import { ResourceManager } from "./resource-manager";
import { StaminaManager } from "./stamina-manager";
import { computeExploreFoodCosts, computeTravelFoodCosts } from "./utils";

export class ArmyActionManager {
  private readonly entity: Entity;
  private readonly entityId: ID;
  private readonly resourceManager: ResourceManager;
  private readonly staminaManager: StaminaManager;

  constructor(
    private readonly components: ClientComponents,
    private readonly systemCalls: SystemCalls,
    entityId: ID,
  ) {
    this.entity = getEntityIdFromKeys([BigInt(entityId)]);
    this.entityId = entityId;
    const entityOwnerId = getComponentValue(this.components.ExplorerTroops, this.entity)?.owner;
    this.resourceManager = new ResourceManager(this.components, entityOwnerId!);
    this.staminaManager = new StaminaManager(this.components, entityId);
  }

  private _getTroopType(): TroopType {
    const entityArmy = getComponentValue(this.components.ExplorerTroops, this.entity);

    return entityArmy?.troops.category as TroopType;
  }

  private _canExplore(currentDefaultTick: number, currentArmiesTick: number): boolean {
    const stamina = this.staminaManager.getStamina(currentArmiesTick);

    if (stamina.amount < configManager.getExploreStaminaCost()) {
      return false;
    }

    const entityArmy = getComponentValue(this.components.ExplorerTroops, this.entity);
    const exploreFoodCosts = entityArmy
      ? computeExploreFoodCosts(entityArmy?.troops)
      : {
          wheatPayAmount: 0,
          fishPayAmount: 0,
        };
    const { wheat, fish } = this.getFood(currentDefaultTick);

    if (fish < exploreFoodCosts.fishPayAmount) {
      return false;
    }
    if (wheat < exploreFoodCosts.wheatPayAmount) {
      return false;
    }
    const resource = getComponentValue(this.components.Resource, this.entity);
    if (!resource) return false;

    const remainingCapacity = getRemainingCapacityInKg(resource);
    const requiredCapacity = configManager.getExploreReward().resource_weight;

    return remainingCapacity >= requiredCapacity;
  }

  private readonly _calculateMaxTravelPossible = (currentDefaultTick: number, currentArmiesTick: number) => {
    const stamina = this.staminaManager.getStamina(currentArmiesTick);
    // Calculate minimum stamina cost across all biomes for this troop type
    const minTravelStaminaCost = configManager.getMinTravelStaminaCost();
    const maxStaminaSteps = Math.floor(Number(stamina.amount) / minTravelStaminaCost);

    const entityArmy = getComponentValue(this.components.ExplorerTroops, this.entity);
    const travelFoodCosts = entityArmy
      ? computeTravelFoodCosts(entityArmy.troops)
      : {
          wheatPayAmount: 0,
          fishPayAmount: 0,
        };

    const { wheat, fish } = this.getFood(currentDefaultTick);
    const maxTravelWheatSteps = Math.floor(wheat / travelFoodCosts.wheatPayAmount);
    const maxTravelFishSteps = Math.floor(fish / travelFoodCosts.fishPayAmount);
    const maxTravelSteps = Math.min(maxTravelWheatSteps, maxTravelFishSteps);

    return Math.min(maxStaminaSteps, maxTravelSteps);
  };

  private readonly _getCurrentPosition = () => {
    const position = getComponentValue(this.components.ExplorerTroops, this.entity)?.coord;
    return { col: position!.x, row: position!.y };
  };

  // getFood is without precision
  public getFood(currentDefaultTick: number) {
    const wheatBalance = this.resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Wheat);
    const fishBalance = this.resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Fish);

    return {
      wheat: divideByPrecision(wheatBalance.balance),
      fish: divideByPrecision(fishBalance.balance),
    };
  }

  public findActionPaths(
    structureHexes: Map<number, Map<number, HexEntityInfo>>,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
    questHexes: Map<number, Map<number, HexEntityInfo>>,
    chestHexes: Map<number, Map<number, HexEntityInfo>>,
    currentDefaultTick: number,
    currentArmiesTick: number,
    playerAddress: ContractAddress,
  ): ActionPaths {
    const armyStamina = this.staminaManager.getStamina(currentArmiesTick).amount;

    const troopType = this._getTroopType();
    const startPos = this._getCurrentPosition();
    // max hex based on food
    const maxHex = this._calculateMaxTravelPossible(currentDefaultTick, currentArmiesTick);
    const canExplore = this._canExplore(currentDefaultTick, currentArmiesTick);

    const actionPaths = new ActionPaths();
    const lowestStaminaUse = new Map<string, number>();
    const priorityQueue: Array<{
      position: HexPosition;
      staminaUsed: number;
      distance: number;
      path: ActionPath[];
    }> = [];

    // Process initial neighbors instead of start position
    const neighbors = getNeighborHexes(startPos.col, startPos.row);
    for (const { col, row } of neighbors) {
      const isExplored = exploredHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
      const hasArmy = armyHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
      const isArmyMine = armyHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER)?.owner === playerAddress || false;
      const hasStructure = structureHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
      const hasQuest = questHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
      const hasChest = chestHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
      const isStructureMine =
        structureHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER)?.owner === playerAddress || false;
      const biome = exploredHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER);

      // Skip if hex requires exploration but army can't explore
      if (!isExplored && !canExplore) continue;

      const isMine = isArmyMine || isStructureMine;
      const canAttack = (hasArmy || hasStructure) && !isMine;

      // Determine action type
      let actionType;
      let staminaCost = 0;

      if (isMine) {
        actionType = ActionType.Help;
      } else if (canAttack) {
        actionType = ActionType.Attack;
      } else if (hasQuest) {
        actionType = ActionType.Quest;
      } else if (hasChest) {
        actionType = ActionType.Chest;
      } else if (biome) {
        actionType = ActionType.Move;
        // Skip if no movement range available
        if (maxHex === 0) continue;
        staminaCost = configManager.getTravelStaminaCost(biome, troopType);
      } else {
        actionType = ActionType.Explore;
        staminaCost = configManager.getExploreStaminaCost();
      }

      // Skip if not enough stamina for the action
      if (staminaCost > armyStamina) continue;

      priorityQueue.push({
        position: { col, row },
        staminaUsed: staminaCost,
        distance: 1,
        path: [
          {
            hex: { col: startPos.col, row: startPos.row },
            actionType: ActionType.Move,
          },
          {
            hex: { col, row },
            actionType,
            biomeType: biome,
            staminaCost,
          },
        ],
      });
    }

    while (priorityQueue.length > 0) {
      priorityQueue.sort((a, b) => a.staminaUsed - b.staminaUsed);
      const { position: current, staminaUsed, distance, path } = priorityQueue.shift()!;
      const currentKey = ActionPaths.posKey(current);

      if (!lowestStaminaUse.has(currentKey) || staminaUsed < lowestStaminaUse.get(currentKey)!) {
        lowestStaminaUse.set(currentKey, staminaUsed);
        const isExplored = exploredHexes.get(current.col - FELT_CENTER)?.has(current.row - FELT_CENTER) || false;
        const hasArmy = armyHexes.get(current.col - FELT_CENTER)?.has(current.row - FELT_CENTER) || false;
        const hasStructure = structureHexes.get(current.col - FELT_CENTER)?.has(current.row - FELT_CENTER) || false;
        const hasQuest = questHexes.get(current.col - FELT_CENTER)?.has(current.row - FELT_CENTER) || false;
        const hasChest = chestHexes.get(current.col - FELT_CENTER)?.has(current.row - FELT_CENTER) || false;

        actionPaths.set(currentKey, path);

        // cannot go through these hexes so need to stop here
        if (!isExplored || hasArmy || hasStructure || hasQuest || hasChest) continue;

        const neighbors = getNeighborHexes(current.col, current.row);
        for (const { col, row } of neighbors) {
          const neighborKey = ActionPaths.posKey({ col, row });
          const nextDistance = distance + 1;

          if (nextDistance > maxHex) continue;

          const isExplored = exploredHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
          const hasArmy = armyHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
          const hasStructure = structureHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
          const biome = exploredHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER);
          const hasQuest = questHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
          const hasChest = chestHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;

          if (!isExplored || hasArmy || hasStructure || hasQuest || hasChest) continue;

          const staminaCost = configManager.getTravelStaminaCost(biome!, troopType);
          const nextStaminaUsed = staminaUsed + staminaCost;

          if (nextStaminaUsed > armyStamina) continue;

          if (!lowestStaminaUse.has(neighborKey) || nextStaminaUsed < lowestStaminaUse.get(neighborKey)!) {
            priorityQueue.push({
              position: { col, row },
              staminaUsed: nextStaminaUsed,
              distance: nextDistance,
              path: [
                ...path,
                {
                  hex: { col, row },
                  actionType: biome ? ActionType.Move : ActionType.Explore,
                  biomeType: biome,
                  staminaCost,
                },
              ],
            });
          }
        }
      }
    }

    return actionPaths;
  }

  private readonly _findDirection = (path: HexPosition[]) => {
    if (path.length !== 2) return undefined;

    const startPos = { col: path[0].col, row: path[0].row };
    const endPos = { col: path[1].col, row: path[1].row };
    return getDirectionBetweenAdjacentHexes(startPos, endPos);
  };

  private readonly _exploreHex = async (signer: DojoAccount, path: ActionPath[], currentArmiesTick: number) => {
    const direction = this._findDirection(path.map((p) => p.hex));
    if (direction === undefined || direction === null) {
      return Promise.reject(new Error("Invalid direction"));
    }

    try {
      return await this.systemCalls.explorer_move({
        explorer_id: this.entityId,
        directions: [direction],
        explore: true,
        signer,
      });
    } catch (e) {
      return Promise.reject(e);
    }
  };

  private readonly _travelToHex = async (
    signer: Account | AccountInterface,
    path: ActionPath[],
    currentArmiesTick: number,
  ) => {
    const directions = path
      .map((_, i) => {
        if (path[i + 1] === undefined) return undefined;
        return this._findDirection([
          { col: path[i].hex.col, row: path[i].hex.row },
          { col: path[i + 1].hex.col, row: path[i + 1].hex.row },
        ]);
      })
      .filter((d) => d !== undefined) as number[];

    try {
      return await this.systemCalls.explorer_move({
        signer,
        explorer_id: this.entityId,
        directions,
        explore: false,
      });
    } catch (e) {
      console.log({ e });
      return Promise.reject(e);
    }
  };

  public moveArmy = (
    signer: Account | AccountInterface,
    path: ActionPath[],
    isExplored: boolean,
    currentArmiesTick: number,
  ) => {
    if (!isExplored) {
      return this._exploreHex(signer, path, currentArmiesTick);
    } else {
      return this._travelToHex(signer, path, currentArmiesTick);
    }
  };
}
