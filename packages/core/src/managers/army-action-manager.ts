import {
  type BiomeType,
  BiomeTypeToId,
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
  TileOccupier,
  TravelTypes,
  type TroopType,
} from "@bibliothecadao/types";
import { type Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import type { Account, AccountInterface } from "starknet";
import { Biome, divideByPrecision, getRemainingCapacityInKg, kgToNanogram } from "..";
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
    const requiredCapacity = configManager.getExploreReward();

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
      wheat: divideByPrecision(wheatBalance),
      fish: divideByPrecision(fishBalance),
    };
  }

  public findActionPaths(
    structureHexes: Map<number, Map<number, HexEntityInfo>>,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
    questHexes: Map<number, Map<number, HexEntityInfo>>,
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

        actionPaths.set(currentKey, path);

        // cannot go through these hexes so need to stop here
        if (!isExplored || hasArmy || hasStructure) continue;

        const neighbors = getNeighborHexes(current.col, current.row);
        for (const { col, row } of neighbors) {
          const neighborKey = ActionPaths.posKey({ col, row });
          const nextDistance = distance + 1;

          if (nextDistance > maxHex) continue;

          const isExplored = exploredHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
          const hasArmy = armyHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
          const hasStructure = structureHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
          const biome = exploredHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER);

          if (!isExplored || hasArmy || hasStructure) continue;

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

  private readonly _optimisticExplorerUpdate = (
    staminaAmount: bigint,
    staminaCost: number,
    currentArmiesTick: number,
    newPosition: HexPosition,
  ) => {
    const explorerTroops = getComponentValue(this.components.ExplorerTroops, this.entity);
    const stamina = explorerTroops?.troops.stamina;
    const overrideId = uuid();

    if (!stamina) return;

    // substract the costs
    this.components.ExplorerTroops.addOverride(overrideId, {
      entity: this.entity,
      value: {
        ...explorerTroops,
        coord: {
          x: newPosition.col,
          y: newPosition.row,
        },
        troops: {
          ...explorerTroops.troops,
          stamina: {
            ...explorerTroops.troops.stamina,
            amount: staminaAmount - BigInt(staminaCost),
            updated_tick: BigInt(currentArmiesTick),
          },
        },
      },
    });

    return () => {
      this.components.ExplorerTroops.removeOverride(overrideId);
    };
  };

  private readonly _optimisticCapacityUpdate = (additionalWeightKg: number) => {
    const overrideId = uuid();

    const resource = getComponentValue(this.components.Resource, this.entity);
    const weight = resource?.weight || { capacity: 0n, weight: 0n };
    const additionalWeight = kgToNanogram(additionalWeightKg);

    this.components.Resource.addOverride(overrideId, {
      entity: this.entity,
      value: {
        entity_id: this.entityId,
        ...resource,
        weight: {
          ...weight,
          weight: BigInt((weight?.weight || 0).toString()) + BigInt(additionalWeight),
        },
      },
    });

    return () => {
      this.components.Resource.removeOverride(overrideId);
    };
  };

  private readonly _optimisticTileUpdate = (newPosition: HexPosition, previousPosition: HexPosition) => {
    const overrideId1 = uuid();

    const previousEntity = getEntityIdFromKeys([BigInt(previousPosition.col), BigInt(previousPosition.row)]);

    const previousTile = getComponentValue(this.components.Tile, previousEntity);

    this.components.Tile.addOverride(overrideId1, {
      entity: previousEntity,
      value: {
        ...previousTile,
        col: previousPosition.col,
        row: previousPosition.row,
        occupier_id: 0,
        occupier_type: TileOccupier.None,
      },
    });

    const overrideId2 = uuid();

    this.components.Tile.addOverride(overrideId2, {
      entity: getEntityIdFromKeys([BigInt(newPosition.col), BigInt(newPosition.row)]),
      value: {
        col: newPosition.col,
        row: newPosition.row,
        occupier_id: this.entityId,
        occupier_type: previousTile?.occupier_type,
        biome: BiomeTypeToId[Biome.getBiome(newPosition.col, newPosition.row)],
        occupier_is_structure: false,
      },
    });

    return () => {
      this.components.Tile.removeOverride(overrideId1);
      this.components.Tile.removeOverride(overrideId2);
    };
  };

  private readonly _optimisticExplore = (col: number, row: number, currentArmiesTick: number) => {
    const previousPosition = this._getCurrentPosition();
    const newPosition = { col, row };

    const staminaManager = new StaminaManager(this.components, this.entityId);
    const staminaCost = configManager.getExploreStaminaCost();
    const currentStamina = staminaManager.getStamina(currentArmiesTick).amount;

    const removeExplorerOverride = this._optimisticExplorerUpdate(
      currentStamina,
      staminaCost,
      currentArmiesTick,
      newPosition,
    );
    const removeTileOverride = this._optimisticTileUpdate(newPosition, previousPosition);
    const removeCapacityOverride = this._optimisticCapacityUpdate(
      // all resources you can find have the same weight as wood
      configManager.getExploreReward() * configManager.getResourceWeightKg(ResourcesIds.Wood),
    );
    const removeFoodCostsOverride = this._optimisticFoodCosts(TravelTypes.Explore);

    return {
      removeOverrides: () => {
        removeExplorerOverride?.();
        removeTileOverride();
        removeCapacityOverride();
        removeFoodCostsOverride?.();
      },
    };
  };

  private readonly _findDirection = (path: HexPosition[]) => {
    if (path.length !== 2) return undefined;

    const startPos = { col: path[0].col, row: path[0].row };
    const endPos = { col: path[1].col, row: path[1].row };
    return getDirectionBetweenAdjacentHexes(startPos, endPos);
  };

  private readonly _exploreHex = async (signer: DojoAccount, path: ActionPath[], currentArmiesTick: number) => {
    const direction = this._findDirection(path.map((p) => p.hex));
    if (direction === undefined || direction === null) return;

    const { removeOverrides } = this._optimisticExplore(path[1].hex.col, path[1].hex.row, currentArmiesTick);

    try {
      await this.systemCalls.explorer_move({
        explorer_id: this.entityId,
        directions: [direction],
        explore: true,
        signer,
      });
    } catch (e) {
      console.log({ e });
    } finally {
      // remove all non visual overrides
      removeOverrides();
    }
  };

  private readonly _optimisticTravelHex = (col: number, row: number, path: ActionPath[], currentArmiesTick: number) => {
    const previousPosition = this._getCurrentPosition();
    const newPosition = { col, row };
    let staminaCost = 0;

    for (const { biomeType } of path) {
      if (!biomeType) continue;
      staminaCost += configManager.getTravelStaminaCost(biomeType, this._getTroopType());
    }

    const staminaManager = new StaminaManager(this.components, this.entityId);
    const currentStamina = staminaManager.getStamina(currentArmiesTick).amount;

    const removeExplorerOverride = this._optimisticExplorerUpdate(
      currentStamina,
      staminaCost,
      currentArmiesTick,
      newPosition,
    );
    const removeTileOverride = this._optimisticTileUpdate(newPosition, previousPosition);
    const removeFoodCostsOverride = this._optimisticFoodCosts(TravelTypes.Travel);

    return {
      removeOverrides: () => {
        removeExplorerOverride?.();
        removeTileOverride();
        removeFoodCostsOverride?.();
      },
    };
  };

  private readonly _optimisticFoodCosts = (travelType: TravelTypes) => {
    const entityArmy = getComponentValue(this.components.ExplorerTroops, this.entity);
    if (!entityArmy) return;
    let costs = { wheatPayAmount: 0, fishPayAmount: 0 };
    if (travelType === TravelTypes.Explore) {
      costs = computeExploreFoodCosts(entityArmy.troops);
    } else {
      costs = computeTravelFoodCosts(entityArmy.troops);
    }

    // need to add back precision for optimistic resource update
    const removeWheatResourceOverride = this.resourceManager.optimisticResourceUpdate(
      ResourcesIds.Wheat,
      -costs.wheatPayAmount,
    );
    const removeFishResourceOverride = this.resourceManager.optimisticResourceUpdate(
      ResourcesIds.Fish,
      -costs.fishPayAmount,
    );

    return () => {
      removeWheatResourceOverride();
      removeFishResourceOverride();
    };
  };

  private readonly _travelToHex = async (
    signer: Account | AccountInterface,
    path: ActionPath[],
    currentArmiesTick: number,
  ) => {
    const { removeOverrides } = this._optimisticTravelHex(
      path[path.length - 1].hex.col,
      path[path.length - 1].hex.row,
      path,
      currentArmiesTick,
    );

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
      await this.systemCalls.explorer_move({
        signer,
        explorer_id: this.entityId,
        directions,
        explore: false,
      });
    } catch (e) {
      console.log({ e });
    } finally {
      removeOverrides();
    }
  };

  public moveArmy = (
    signer: Account | AccountInterface,
    path: ActionPath[],
    isExplored: boolean,
    currentArmiesTick: number,
  ) => {
    if (!isExplored) {
      this._exploreHex(signer, path, currentArmiesTick);
    } else {
      this._travelToHex(signer, path, currentArmiesTick);
    }
  };
}
