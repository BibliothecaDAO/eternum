import { getComponentValue, type Entity } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { Account, AccountInterface } from "starknet";
import {
  Biome,
  BiomeType,
  divideByPrecision,
  DojoAccount,
  kgToNanogram,
  multiplyByPrecision,
  nanogramToKg,
  world,
} from "..";
import {
  BiomeTypeToId,
  FELT_CENTER,
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
  ResourcesIds,
} from "../constants";
import { ClientComponents } from "../dojo/create-client-components";
import { EternumProvider } from "../provider";
import { ContractAddress, HexEntityInfo, HexPosition, ID, TileOccupier, TravelTypes, TroopType } from "../types";
import { ActionPath, ActionPaths, ActionType } from "../utils/action-paths";
import { configManager } from "./config-manager";
import { ResourceManager } from "./resource-manager";
import { StaminaManager } from "./stamina-manager";
import { computeExploreFoodCosts, computeTravelFoodCosts, getRemainingCapacityInKg } from "./utils";

export class ArmyActionManager {
  private readonly entity: Entity;
  private readonly entityId: ID;
  private readonly resourceManager: ResourceManager;
  private readonly staminaManager: StaminaManager;

  constructor(
    private readonly components: ClientComponents,
    private readonly provider: EternumProvider,
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

    if (this._getArmyRemainingCapacity() < configManager.getExploreReward()) {
      return false;
    }

    return true;
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
    structureHexes: Map<number, Map<number, HexEntityInfo>>,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
    currentDefaultTick: number,
    currentArmiesTick: number,
    playerAddress: ContractAddress,
  ): ActionPaths {
    const armyStamina = this.staminaManager.getStamina(currentArmiesTick).amount;
    if (armyStamina === 0n) return new ActionPaths();

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
      const isArmyMine = armyHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER)?.owner === playerAddress || false;
      const hasStructure = structureHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
      const isStructureMine =
        structureHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER)?.owner === playerAddress || false;
      const biome = exploredHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER);

      if (!isExplored && !canExplore) continue;

      const isMine = isArmyMine || isStructureMine;

      const canAttack = (hasArmy || hasStructure) && !isMine;

      const staminaCost = biome
        ? ArmyActionManager.staminaDrain(biome, troopType)
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

          const staminaCost = ArmyActionManager.staminaDrain(biome!, troopType);
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

  private readonly _optimisticExplorerUpdate = (overrideId: string, staminaCost: number, newPosition: HexPosition) => {
    const explorerTroops = getComponentValue(this.components.ExplorerTroops, this.entity);
    const stamina = explorerTroops?.troops.stamina;

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
            amount: stamina.amount - BigInt(staminaCost),
            updated_tick: stamina.updated_tick,
          },
        },
      },
    });
  };

  private readonly _optimisticCapacityUpdate = (overrideId: string, additionalWeightKg: number) => {
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
  };

  private readonly _optimisticTileUpdate = (
    overrideId: string,
    newPosition: HexPosition,
    previousPosition: HexPosition,
  ) => {
    const previousEntity = getEntityIdFromKeys([BigInt(previousPosition.col), BigInt(previousPosition.row)]);

    this.components.Tile.addOverride(overrideId, {
      entity: previousEntity,
      value: {
        col: previousPosition.col,
        row: previousPosition.row,
        occupier_id: 0,
        occupier_type: TileOccupier.None,
      },
    });

    const newEntity = world.registerEntity({
      id: getEntityIdFromKeys([BigInt(newPosition.col), BigInt(newPosition.row)]),
    });

    this.components.Tile.addOverride(overrideId, {
      entity: newEntity,
      value: {
        col: newPosition.col,
        row: newPosition.row,
        occupier_id: this.entityId,
        occupier_type: TileOccupier.Explorer,
        biome: BiomeTypeToId[Biome.getBiome(newPosition.col, newPosition.row)],
      },
    });
  };

  private readonly _optimisticExplore = (col: number, row: number) => {
    const overrideId = uuid();

    const previousPosition = this._getCurrentPosition();
    const newPosition = { col, row };

    this._optimisticExplorerUpdate(overrideId, configManager.getExploreStaminaCost(), newPosition);
    this._optimisticTileUpdate(overrideId, newPosition, previousPosition);
    this._optimisticCapacityUpdate(
      overrideId,
      // all resources you can find have the same weight as wood
      configManager.getExploreReward() * configManager.getResourceWeightKg(ResourcesIds.Wood),
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

  private readonly _exploreHex = async (signer: DojoAccount, path: HexPosition[]) => {
    const direction = this._findDirection(path);
    if (direction === undefined || direction === null) return;

    const overrideId = this._optimisticExplore(path[1].col, path[1].row);

    this.provider
      .explorer_move({
        explorer_id: this.entityId,
        directions: [direction],
        explore: true,
        signer,
      })
      .catch((e) => {
        console.log({ e });
        // remove all visual overrides only when the action fails
        this._removeVisualOverride(overrideId);
        this._removeNonVisualOverrides(overrideId);
      })
      .then(() => {
        // remove all non visual overrides
        this._removeNonVisualOverrides(overrideId);
      });
  };

  private readonly _optimisticTravelHex = (col: number, row: number, pathLength: number) => {
    const overrideId = uuid();

    const previousPosition = this._getCurrentPosition();
    const newPosition = { col, row };

    this._optimisticExplorerUpdate(overrideId, configManager.getTravelStaminaCost() * pathLength, newPosition);
    this._optimisticTileUpdate(overrideId, newPosition, previousPosition);
    this._optimisticFoodCosts(overrideId, TravelTypes.Travel);

    return overrideId;
  };

  // only remove visual overrides (linked to models on world map) when the action fails
  private readonly _removeVisualOverride = (overrideId: string) => {
    this.components.Tile.removeOverride(overrideId);
    this.components.ExplorerTroops.removeOverride(overrideId);
  };

  // you can remove all non visual overrides when the action fails or succeeds
  private readonly _removeNonVisualOverrides = (overrideId: string) => {
    this.components.Resource.removeOverride(overrideId);
  };

  private readonly _optimisticFoodCosts = (overrideId: string, travelType: TravelTypes) => {
    const entityArmy = getComponentValue(this.components.ExplorerTroops, this.entity);
    if (!entityArmy) return;
    let costs = { wheatPayAmount: 0, fishPayAmount: 0 };
    if (travelType === TravelTypes.Explore) {
      costs = computeExploreFoodCosts(entityArmy.troops);
    } else {
      costs = computeTravelFoodCosts(entityArmy.troops);
    }

    // need to add back precision for optimistic resource update
    this.resourceManager.optimisticResourceUpdate(
      overrideId,
      ResourcesIds.Wheat,
      -BigInt(multiplyByPrecision(costs.wheatPayAmount)),
    );
    this.resourceManager.optimisticResourceUpdate(
      overrideId,
      ResourcesIds.Fish,
      -BigInt(multiplyByPrecision(costs.fishPayAmount)),
    );
  };

  private readonly _travelToHex = async (signer: Account | AccountInterface, path: HexPosition[]) => {
    const overrideId = this._optimisticTravelHex(path[path.length - 1].col, path[path.length - 1].row, path.length - 1);

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
      .explorer_move({
        signer,
        explorer_id: this.entityId,
        directions,
        explore: false,
      })
      .catch((e) => {
        console.log({ e });
        this._removeVisualOverride(overrideId);
        this._removeNonVisualOverrides(overrideId);
      })
      .then(() => {
        this._removeNonVisualOverrides(overrideId);
      });
  };

  public moveArmy = (signer: Account | AccountInterface, path: HexPosition[], isExplored: boolean) => {
    if (!isExplored) {
      this._exploreHex(signer, path);
    } else {
      this._travelToHex(signer, path);
    }
  };

  private readonly _getArmyRemainingCapacity = () => {
    // this weight is in nanograms
    const armyWeight = getComponentValue(this.components.Resource, this.entity)?.weight.weight || 0;

    const armyWeightKg = nanogramToKg(Number(armyWeight));

    const explorerTroops = getComponentValue(this.components.ExplorerTroops, this.entity);
    if (!explorerTroops) return 0;

    const actualExplorerTroopsCount = divideByPrecision(Number(explorerTroops.troops.count));

    return getRemainingCapacityInKg(actualExplorerTroopsCount, armyWeightKg);
  };
}
