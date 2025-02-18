import { getComponentValue, type Entity } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { Account, AccountInterface } from "starknet";
import { Biome, BiomeType, divideByPrecision, DojoAccount, getArmyTroops, multiplyByPrecision } from "..";
import {
  CapacityConfig,
  FELT_CENTER,
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
  ResourcesIds,
} from "../constants";
import { ClientComponents } from "../dojo/create-client-components";
import { EternumProvider } from "../provider";
import { ContractAddress, HexPosition, ID, TravelTypes, TroopType } from "../types";
import { ActionPath, ActionPaths, ActionType } from "../utils/action-paths";
import { configManager } from "./config-manager";
import { ResourceManager } from "./resource-manager";
import { StaminaManager } from "./stamina-manager";
import { computeExploreFoodCosts, computeTravelFoodCosts, getRemainingCapacityInKg } from "./utils";

export class ArmyMovementManager {
  private readonly entity: Entity;
  private readonly entityId: ID;
  private readonly fishManager: ResourceManager;
  private readonly wheatManager: ResourceManager;
  private readonly staminaManager: StaminaManager;

  constructor(
    private readonly components: ClientComponents,
    private readonly provider: EternumProvider,
    entityId: ID,
  ) {
    this.entity = getEntityIdFromKeys([BigInt(entityId)]);
    this.entityId = entityId;
    const entityOwnerId = getComponentValue(this.components.EntityOwner, this.entity);
    this.wheatManager = new ResourceManager(this.components, entityOwnerId!.entity_owner_id, ResourcesIds.Wheat);
    this.fishManager = new ResourceManager(this.components, entityOwnerId!.entity_owner_id, ResourcesIds.Fish);
    this.staminaManager = new StaminaManager(this.components, entityId);
  }

  private _getTroopType(): TroopType {
    const entityArmy = getComponentValue(this.components.Army, this.entity);
    const knightCount = entityArmy?.troops?.knight_count ?? 0;
    const crossbowmanCount = entityArmy?.troops?.crossbowman_count ?? 0;
    const paladinCount = entityArmy?.troops?.paladin_count ?? 0;

    if (knightCount >= crossbowmanCount && knightCount >= paladinCount) {
      return TroopType.Knight;
    }
    if (crossbowmanCount >= knightCount && crossbowmanCount >= paladinCount) {
      return TroopType.Crossbowman;
    }
    return TroopType.Paladin;
  }

  private _canExplore(currentDefaultTick: number, currentArmiesTick: number): boolean {
    const stamina = this.staminaManager.getStamina(currentArmiesTick);

    if (stamina.amount < configManager.getExploreStaminaCost()) {
      return false;
    }

    const entityArmy = getComponentValue(this.components.Army, this.entity);
    const exploreFoodCosts = entityArmy
      ? computeExploreFoodCosts(getArmyTroops(entityArmy?.troops))
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

    if (this._getArmyRemainingCapacity() < configManager.getExploreReward()) {
      return false;
    }

    return true;
  }

  private readonly _calculateMaxTravelPossible = (currentDefaultTick: number, currentArmiesTick: number) => {
    const stamina = this.staminaManager.getStamina(currentArmiesTick);
    // Calculate minimum stamina cost across all biomes for this troop type
    const minTravelStaminaCost = configManager.getMinTravelStaminaCost();
    const maxStaminaSteps = Math.floor(stamina.amount / minTravelStaminaCost);

    const entityArmy = getComponentValue(this.components.Army, this.entity);
    const travelFoodCosts = entityArmy
      ? computeTravelFoodCosts(getArmyTroops(entityArmy.troops))
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
    const position = getComponentValue(this.components.Position, this.entity);
    return { col: position!.x, row: position!.y };
  };

  public getFood(currentDefaultTick: number) {
    const wheatBalance = this.wheatManager.balance(currentDefaultTick);
    const fishBalance = this.fishManager.balance(currentDefaultTick);

    return {
      wheat: divideByPrecision(wheatBalance),
      fish: divideByPrecision(fishBalance),
    };
  }

  // todo : refactor to use stamina config
  public static staminaDrain(biome: BiomeType, troopType: TroopType) {
    const baseStaminaCost = 20; // Base cost to move to adjacent hex

    // Biome-specific modifiers per troop type
    switch (biome) {
      case BiomeType.Ocean:
        return baseStaminaCost - 10; // -10 for all troops
      case BiomeType.DeepOcean:
        return baseStaminaCost - 10; // -10 for all troops
      case BiomeType.Beach:
        return baseStaminaCost; // No modifier
      case BiomeType.Grassland:
        return baseStaminaCost + (troopType === TroopType.Paladin ? -10 : 0);
      case BiomeType.Shrubland:
        return baseStaminaCost + (troopType === TroopType.Paladin ? -10 : 0);
      case BiomeType.SubtropicalDesert:
        return baseStaminaCost + (troopType === TroopType.Paladin ? -10 : 0);
      case BiomeType.TemperateDesert:
        return baseStaminaCost + (troopType === TroopType.Paladin ? -10 : 0);
      case BiomeType.TropicalRainForest:
        return baseStaminaCost + (troopType === TroopType.Paladin ? 10 : 0);
      case BiomeType.TropicalSeasonalForest:
        return baseStaminaCost + (troopType === TroopType.Paladin ? 10 : 0);
      case BiomeType.TemperateRainForest:
        return baseStaminaCost + (troopType === TroopType.Paladin ? 10 : 0);
      case BiomeType.TemperateDeciduousForest:
        return baseStaminaCost + (troopType === TroopType.Paladin ? 10 : 0);
      case BiomeType.Tundra:
        return baseStaminaCost + (troopType === TroopType.Paladin ? -10 : 0);
      case BiomeType.Taiga:
        return baseStaminaCost + (troopType === TroopType.Paladin ? 10 : 0);
      case BiomeType.Snow:
        return baseStaminaCost + (troopType === TroopType.Paladin ? 0 : 10);
      case BiomeType.Bare:
        return baseStaminaCost + (troopType === TroopType.Paladin ? -10 : 0);
      case BiomeType.Scorched:
        return baseStaminaCost + 10; // +10 for all troops
      default:
        return baseStaminaCost;
    }
  }

  public findActionPaths(
    structureHexes: Map<number, Map<number, boolean>>,
    armyHexes: Map<number, Map<number, boolean>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
    currentDefaultTick: number,
    currentArmiesTick: number,
  ): ActionPaths {
    const armyStamina = this.staminaManager.getStamina(currentArmiesTick).amount;
    if (armyStamina === 0) return new ActionPaths();

    const troopType = this._getTroopType();
    const startPos = this._getCurrentPosition();
    // max hex based on food
    const maxHex = this._calculateMaxTravelPossible(currentDefaultTick, currentArmiesTick);
    const canExplore = this._canExplore(currentDefaultTick, currentArmiesTick);

    const actionPaths = new ActionPaths();
    const lowestStaminaUse = new Map<string, number>();
    const priorityQueue: Array<{ position: HexPosition; staminaUsed: number; distance: number; path: ActionPath[] }> =
      [];

    // Process initial neighbors instead of start position
    const neighbors = getNeighborHexes(startPos.col, startPos.row);
    for (const { col, row } of neighbors) {
      const isExplored = exploredHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
      const hasArmy = armyHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
      const isArmyMine = armyHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER) || false;
      const hasStructure = structureHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
      const isStructureMine = structureHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER) || false;
      const biome = exploredHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER);

      if (!isExplored && !canExplore) continue;

      const isMine = isArmyMine || isStructureMine;
      const canAttack = (hasArmy || hasStructure) && !isMine;

      const staminaCost = biome
        ? ArmyMovementManager.staminaDrain(biome, troopType)
        : configManager.getExploreStaminaCost();

      if (staminaCost > armyStamina) continue;

      let actionType;
      if (isMine) {
        actionType = ActionType.Help;
      } else if (canAttack) {
        actionType = ActionType.Attack;
      } else if (biome) {
        actionType = ActionType.Move;
      } else {
        actionType = ActionType.Explore;
      }

      priorityQueue.push({
        position: { col, row },
        staminaUsed: staminaCost,
        distance: 1,
        path: [
          { hex: { col: startPos.col, row: startPos.row }, actionType: ActionType.Move },
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

          const staminaCost = ArmyMovementManager.staminaDrain(biome!, troopType);
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

  public isMine = (address: ContractAddress) => {
    const entityOwner = getComponentValue(this.components.EntityOwner, this.entity);
    let owner = getComponentValue(this.components.Owner, this.entity);
    if (!owner && entityOwner?.entity_owner_id) {
      owner = getComponentValue(this.components.Owner, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]));
    }
    return owner?.address === address;
  };

  private readonly _optimisticStaminaUpdate = (overrideId: string, cost: number, currentArmiesTick: number) => {
    const stamina = this.staminaManager.getStamina(currentArmiesTick);

    // substract the costs
    this.components.Stamina.addOverride(overrideId, {
      entity: this.entity,
      value: {
        entity_id: stamina.entity_id,
        last_refill_tick: stamina.last_refill_tick,
        amount: stamina.amount - cost,
      },
    });
  };

  private readonly _optimisticCapacityUpdate = (overrideId: string, capacity: number) => {
    const currentWeight = getComponentValue(this.components.Weight, this.entity);

    this.components.Weight.addOverride(overrideId, {
      entity: this.entity,
      value: {
        entity_id: this.entityId,
        value: (currentWeight?.value || 0n) + BigInt(capacity),
      },
    });
  };

  private readonly _optimisticTileUpdate = (overrideId: string, col: number, row: number) => {
    const entity = getEntityIdFromKeys([BigInt(col), BigInt(row)]);

    this.components.Tile.addOverride(overrideId, {
      entity,
      value: {
        col,
        row,
        explored_at: BigInt(Math.floor(Date.now() / 1000)),
        biome: Biome.getBiome(col, row),
      },
    });
  };

  private readonly _optimisticPositionUpdate = (overrideId: string, col: number, row: number) => {
    this.components.Position.addOverride(overrideId, {
      entity: this.entity,
      value: {
        entity_id: this.entityId,
        x: col,
        y: row,
      },
    });
  };

  private readonly _optimisticArrivalTimeUpdate = (blockTimestamp: number, overrideId: string) => {
    this.components.ArrivalTime.addOverride(overrideId, {
      entity: this.entity,
      value: {
        entity_id: this.entityId,
        arrives_at: BigInt(blockTimestamp || 0),
      },
    });
  };

  private readonly _optimisticExplore = (
    blockTimestamp: number,
    col: number,
    row: number,
    currentArmiesTick: number,
  ) => {
    const overrideId = uuid();

    this._optimisticStaminaUpdate(overrideId, configManager.getExploreStaminaCost(), currentArmiesTick);
    this._optimisticTileUpdate(overrideId, col, row);
    this._optimisticPositionUpdate(overrideId, col, row);
    this._optimisticArrivalTimeUpdate(blockTimestamp, overrideId);
    this._optimisticCapacityUpdate(
      overrideId,
      // all resources you can find have the same weight as wood
      configManager.getExploreReward() * configManager.getResourceWeight(ResourcesIds.Wood),
    );
    this._optimisticFoodCosts(overrideId, TravelTypes.Explore);

    return overrideId;
  };

  private readonly _findDirection = (path: HexPosition[]) => {
    if (path.length !== 2) return undefined;

    const startPos = { col: path[0].col, row: path[0].row };
    const endPos = { col: path[1].col, row: path[1].row };
    return getDirectionBetweenAdjacentHexes(startPos, endPos);
  };

  private readonly _exploreHex = async (
    signer: DojoAccount,
    blockTimestamp: number,
    path: HexPosition[],
    currentArmiesTick: number,
  ) => {
    const direction = this._findDirection(path);
    if (direction === undefined || direction === null) return;

    const overrideId = this._optimisticExplore(blockTimestamp, path[1].col, path[1].row, currentArmiesTick);

    this.provider
      .explore({
        unit_id: this.entityId,
        direction,
        signer,
      })
      .catch((e) => {
        // remove all visual overrides only when the action fails
        this._removeVisualOverride(overrideId);
        this._removeNonVisualOverrides(overrideId);
      })
      .then(() => {
        // remove all non visual overrides
        this._removeNonVisualOverrides(overrideId);
      });
  };

  private readonly _optimisticTravelHex = (
    col: number,
    row: number,
    pathLength: number,
    blockTimestamp: number,
    currentArmiesTick: number,
  ) => {
    const overrideId = uuid();

    this._optimisticStaminaUpdate(overrideId, configManager.getTravelStaminaCost() * pathLength, currentArmiesTick);
    this._optimisticFoodCosts(overrideId, TravelTypes.Travel);
    this._optimisticArrivalTimeUpdate(blockTimestamp, overrideId);

    this.components.Position.addOverride(overrideId, {
      entity: this.entity,
      value: {
        entity_id: this.entityId,
        x: col,
        y: row,
      },
    });
    return overrideId;
  };

  // only remove visual overrides (linked to models on world map) when the action fails
  private readonly _removeVisualOverride = (overrideId: string) => {
    this.components.Tile.removeOverride(overrideId);
    this.components.Position.removeOverride(overrideId);
  };

  // you can remove all non visual overrides when the action fails or succeeds
  private readonly _removeNonVisualOverrides = (overrideId: string) => {
    this.components.Stamina.removeOverride(overrideId);
    this.components.Resource.removeOverride(overrideId);
    this.components.Weight.removeOverride(overrideId);
    this.components.ArrivalTime.removeOverride(overrideId);
  };

  private readonly _optimisticFoodCosts = (overrideId: string, travelType: TravelTypes) => {
    const entityArmy = getComponentValue(this.components.Army, this.entity);
    if (!entityArmy) return;
    let costs = { wheatPayAmount: 0, fishPayAmount: 0 };
    if (travelType === TravelTypes.Explore) {
      costs = computeExploreFoodCosts(getArmyTroops(entityArmy.troops));
    } else {
      costs = computeTravelFoodCosts(getArmyTroops(entityArmy.troops));
    }

    // need to add back precision for optimistic resource update
    this.wheatManager.optimisticResourceUpdate(overrideId, -BigInt(multiplyByPrecision(costs.wheatPayAmount)));
    this.fishManager.optimisticResourceUpdate(overrideId, -BigInt(multiplyByPrecision(costs.fishPayAmount)));
  };

  private readonly _travelToHex = async (
    signer: Account | AccountInterface,
    path: HexPosition[],
    blockTimestamp: number,
    currentArmiesTick: number,
  ) => {
    const overrideId = this._optimisticTravelHex(
      path[path.length - 1].col,
      path[path.length - 1].row,
      path.length - 1,
      blockTimestamp,
      currentArmiesTick,
    );

    const directions = path
      .map((_, i) => {
        if (path[i + 1] === undefined) return undefined;
        return this._findDirection([
          { col: path[i].col, row: path[i].row },
          { col: path[i + 1].col, row: path[i + 1].row },
        ]);
      })
      .filter((d) => d !== undefined) as number[];

    this.provider
      .travel_hex({
        signer,
        travelling_entity_id: this.entityId,
        directions,
      })
      .catch(() => {
        this._removeVisualOverride(overrideId);
        this._removeNonVisualOverrides(overrideId);
      })
      .then(() => {
        this._removeNonVisualOverrides(overrideId);
      });
  };

  public moveArmy = (
    signer: Account | AccountInterface,
    path: HexPosition[],
    isExplored: boolean,
    blockTimestamp: number,
    currentArmiesTick: number,
  ) => {
    if (!isExplored) {
      this._exploreHex(signer, blockTimestamp, path, currentArmiesTick);
    } else {
      this._travelToHex(signer, path, blockTimestamp, currentArmiesTick);
    }
  };

  private readonly _getArmyRemainingCapacity = () => {
    const armyCapacity = getComponentValue(
      this.components.CapacityConfig,
      getEntityIdFromKeys([BigInt(CapacityConfig.Army)]),
    );
    const armyWeight = getComponentValue(this.components.Weight, this.entity);

    const armyEntity = getComponentValue(this.components.Army, this.entity);

    if (!armyEntity || !armyCapacity) return 0n;

    return getRemainingCapacityInKg(armyEntity, armyCapacity, armyWeight);
  };
}
