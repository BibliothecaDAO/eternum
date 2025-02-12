import { getComponentValue, type Entity } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { Account, AccountInterface } from "starknet";
import { DojoAccount } from "..";
import {
  BiomeType,
  CapacityConfigCategory,
  FELT_CENTER,
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
  ResourcesIds,
} from "../constants";
import { ClientComponents } from "../dojo/create-client-components";
import { EternumProvider } from "../provider";
import { ContractAddress, HexPosition, ID, TravelTypes } from "../types";
import { Biome, multiplyByPrecision } from "../utils";
import { TravelPaths } from "../utils/travel-path";
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

  private _canExplore(currentDefaultTick: number, currentArmiesTick: number): boolean {
    const stamina = this.staminaManager.getStamina(currentArmiesTick);

    if (stamina.amount < configManager.getExploreStaminaCost()) {
      return false;
    }

    const entityArmy = getComponentValue(this.components.Army, this.entity);
    const exploreFoodCosts = computeExploreFoodCosts(entityArmy?.troops);
    const { wheat, fish } = this.getFood(currentDefaultTick);

    if (fish < multiplyByPrecision(exploreFoodCosts.fishPayAmount)) {
      return false;
    }
    if (wheat < multiplyByPrecision(exploreFoodCosts.wheatPayAmount)) {
      return false;
    }

    if (this._getArmyRemainingCapacity() < configManager.getExploreReward()) {
      return false;
    }

    return true;
  }

  private readonly _calculateMaxTravelPossible = (currentDefaultTick: number, currentArmiesTick: number) => {
    const stamina = this.staminaManager.getStamina(currentArmiesTick);
    const travelStaminaCost = configManager.getTravelStaminaCost();

    const maxStaminaSteps = travelStaminaCost
      ? Math.floor((stamina.amount || 0) / configManager.getTravelStaminaCost())
      : 999;

    const entityArmy = getComponentValue(this.components.Army, this.entity);
    const travelFoodCosts = computeTravelFoodCosts(entityArmy?.troops);

    const { wheat, fish } = this.getFood(currentDefaultTick);
    const maxTravelWheatSteps = Math.floor(wheat / multiplyByPrecision(travelFoodCosts.wheatPayAmount));
    const maxTravelFishSteps = Math.floor(fish / multiplyByPrecision(travelFoodCosts.fishPayAmount));
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
      wheat: wheatBalance,
      fish: fishBalance,
    };
  }

  public static staminaDrain(biome: BiomeType) {
    if (biome === BiomeType.Grassland) {
      return 1;
    }
    if (biome === BiomeType.Bare) {
      return 2;
    }
    if (biome === BiomeType.Snow) {
      return 3;
    }
    if (biome === BiomeType.Tundra) {
      return 4;
    }
    return 0;
  }

  // public static findPath(
  //   startPos: HexPosition,
  //   endPos: HexPosition,
  //   structureHexes: Map<number, Set<number>>,
  //   armyHexes: Map<number, Set<number>>,
  //   exploredHexes: Map<number, Map<number, BiomeType>>,
  // ): HexPosition[] {
  //   console.log("[findPath] Finding path from", startPos, "to", endPos);
  //   console.log("[findPath] Structure hexes:", structureHexes);
  //   console.log("[findPath] Army hexes:", armyHexes);
  //   console.log("[findPath] Explored hexes:", exploredHexes);

  //   const priorityQueue: Array<{ position: HexPosition; staminaUsed: number; distance: number; path: HexPosition[] }> =
  //     [{ position: startPos, staminaUsed: 0, distance: 0, path: [startPos] }];
  //   const shortestDistances = new Map<string, { distance: number; staminaUsed: number }>();

  //   while (priorityQueue.length > 0) {
  //     priorityQueue.sort((a, b) => a.staminaUsed - b.staminaUsed || a.distance - b.distance);
  //     const { position: current, staminaUsed, distance, path } = priorityQueue.shift()!;
  //     const currentKey = TravelPaths.posKey(current);

  //     console.log("[findPath] Processing position:", current, "stamina:", staminaUsed, "distance:", distance);

  //     if (current.col === endPos.col && current.row === endPos.row) {
  //       console.log("[findPath] Found path:", path);
  //       return path;
  //     }

  //     const shortest = shortestDistances.get(currentKey);
  //     if (
  //       !shortest ||
  //       staminaUsed < shortest.staminaUsed ||
  //       (staminaUsed === shortest.staminaUsed && distance < shortest.distance)
  //     ) {
  //       shortestDistances.set(currentKey, { distance, staminaUsed });
  //       const isExplored = exploredHexes.get(current.col - FELT_CENTER)?.has(current.row - FELT_CENTER) || false;

  //       // Skip army and explored checks for start position
  //       if (path.length > 1) {
  //         if (!isExplored) {
  //           console.log("[findPath] Skipping unexplored hex:", current);
  //           continue;
  //         }

  //         const hasArmy = armyHexes.get(current.col - FELT_CENTER)?.has(current.row - FELT_CENTER) || false;
  //         const hasStructure = structureHexes.get(current.col - FELT_CENTER)?.has(current.row - FELT_CENTER) || false;

  //         if (hasArmy || hasStructure) {
  //           console.log("[findPath] Skipping hex with army/structure:", current);
  //           continue;
  //         }
  //       }

  //       const neighbors = getNeighborHexes(current.col, current.row);
  //       console.log("[findPath] Checking neighbors:", neighbors);

  //       for (const { col, row } of neighbors) {
  //         const neighborKey = TravelPaths.posKey({ col, row });
  //         const nextDistance = distance + 1;
  //         const nextPath = [...path, { col, row }];

  //         const isExplored = exploredHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
  //         const hasArmy = armyHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
  //         const hasStructure = structureHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
  //         const biome = exploredHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER);
  //         const staminaCost = biome ? this.staminaDrain(biome) : 0;
  //         const nextStaminaUsed = staminaUsed + staminaCost;

  //         console.log("[findPath] Neighbor:", { col, row }, "explored:", isExplored, "stamina cost:", staminaCost);

  //         if (hasStructure) {
  //           console.log("[findPath] Skipping neighbor with structure:", { col, row });
  //           continue;
  //         }
  //         if (hasArmy) {
  //           console.log("[findPath] Skipping neighbor with army:", { col, row });
  //           continue;
  //         }

  //         if (isExplored) {
  //           const shortest = shortestDistances.get(neighborKey);
  //           if (
  //             !shortest ||
  //             nextStaminaUsed < shortest.staminaUsed ||
  //             (nextStaminaUsed === shortest.staminaUsed && nextDistance < shortest.distance)
  //           ) {
  //             console.log("[findPath] Adding neighbor to queue:", { col, row });
  //             priorityQueue.push({
  //               position: { col, row },
  //               staminaUsed: nextStaminaUsed,
  //               distance: nextDistance,
  //               path: nextPath,
  //             });
  //           }
  //         }
  //       }
  //     }
  //   }

  //   console.log("[findPath] No path found");
  //   return [];
  // }

  public findPaths(
    structureHexes: Map<number, Set<number>>,
    armyHexes: Map<number, Set<number>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
    armyStamina: number,
    currentDefaultTick: number,
    currentArmiesTick: number,
  ): TravelPaths {
    console.log("[findPaths] Finding paths with:", {
      armyStamina,
      currentDefaultTick,
      currentArmiesTick,
    });

    const startPos = this._getCurrentPosition();
    const maxHex = this._calculateMaxTravelPossible(currentDefaultTick, currentArmiesTick);
    const canExplore = this._canExplore(currentDefaultTick, currentArmiesTick);

    console.log("[findPaths] Initial conditions:", {
      startPos,
      maxHex,
      canExplore,
    });

    const priorityQueue: Array<{ position: HexPosition; staminaUsed: number; distance: number; path: HexPosition[] }> =
      [{ position: startPos, staminaUsed: 0, distance: 0, path: [startPos] }];
    const travelPaths = new TravelPaths();
    const shortestDistances = new Map<string, number>();

    while (priorityQueue.length > 0) {
      priorityQueue.sort((a, b) => a.distance - b.distance);
      const { position: current, staminaUsed, distance, path } = priorityQueue.shift()!;
      const currentKey = TravelPaths.posKey(current);

      console.log("[findPaths] Processing position:", {
        current,
        staminaUsed,
        distance,
        pathLength: path.length,
      });

      if (!shortestDistances.has(currentKey) || distance < shortestDistances.get(currentKey)!) {
        shortestDistances.set(currentKey, distance);
        const isExplored = exploredHexes.get(current.col - FELT_CENTER)?.has(current.row - FELT_CENTER) || false;
        if (path.length >= 2) {
          travelPaths.set(currentKey, { path, isExplored });
        }

        // Skip army and explored checks for start position
        if (path.length > 1) {
          if (!isExplored) continue;

          const hasArmy = armyHexes.get(current.col - FELT_CENTER)?.has(current.row - FELT_CENTER) || false;
          const hasStructure = structureHexes.get(current.col - FELT_CENTER)?.has(current.row - FELT_CENTER) || false;
          console.log("[findPaths] Checking position:", {
            col: current.col,
            row: current.row,
            isExplored,
            hasArmy,
            hasStructure,
          });

          if (hasArmy || hasStructure) continue;
        }

        const neighbors = getNeighborHexes(current.col, current.row);
        for (const { col, row } of neighbors) {
          const neighborKey = TravelPaths.posKey({ col, row });
          const nextDistance = distance + 1;
          const nextPath = [...path, { col, row }];

          const isExplored = exploredHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
          const hasArmy = armyHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
          const hasStructure = structureHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
          const biome = exploredHexes.get(col - FELT_CENTER)?.get(row - FELT_CENTER);
          const staminaCost = biome ? ArmyMovementManager.staminaDrain(biome) : 0;
          const nextStaminaUsed = staminaUsed + staminaCost;

          console.log("[findPaths] Evaluating neighbor:", {
            col,
            row,
            hasStructure,
            hasArmy,
            isExplored,
            biome,
            staminaCost,
            nextStaminaUsed,
          });

          if (nextStaminaUsed > armyStamina) continue;
          if (hasStructure) continue;
          if (hasArmy) continue;

          if ((isExplored && nextDistance <= maxHex) || (!isExplored && canExplore && nextDistance === 1)) {
            if (!shortestDistances.has(neighborKey) || nextDistance < shortestDistances.get(neighborKey)!) {
              console.log("[findPaths] Adding to priority queue:", {
                col,
                row,
                nextDistance,
                nextStaminaUsed,
              });

              priorityQueue.push({
                position: { col, row },
                staminaUsed: nextStaminaUsed,
                distance: nextDistance,
                path: nextPath,
              });
            }
          }
        }
      }
    }

    return travelPaths;
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
        explored_by_id: this.entityId,
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
    let costs = { wheatPayAmount: 0, fishPayAmount: 0 };
    if (travelType === TravelTypes.Explore) {
      costs = computeExploreFoodCosts(entityArmy?.troops);
    } else {
      costs = computeTravelFoodCosts(entityArmy?.troops);
    }

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
      getEntityIdFromKeys([BigInt(CapacityConfigCategory.Army)]),
    );
    const armyWeight = getComponentValue(this.components.Weight, this.entity);

    const armyEntity = getComponentValue(this.components.Army, this.entity);

    if (!armyEntity || !armyCapacity) return 0n;

    return getRemainingCapacityInKg(armyEntity, armyCapacity, armyWeight);
  };
}
