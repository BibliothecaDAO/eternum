import {
  type BiomeType,
  type ClientComponents,
  type ContractAddress,
  type DojoAccount,
  getDirectionBetweenAdjacentHexes,
  getHexesWithinRadius,
  getNeighborHexes,
  getTroopAttackRange,
  type HexEntityInfo,
  type HexPosition,
  type ID,
  packTileSeed,
  ResourcesIds,
  TileOccupier,
  type SystemCalls,
  type TroopType,
} from "@bibliothecadao/types";
import { type Entity, getComponentValue } from "@dojoengine/recs";
import type { Account, AccountInterface } from "starknet";
import { divideByPrecision, FELT_CENTER, getTileAt } from "..";
import { type ActionPath, ActionPaths, ActionType } from "../utils/action-paths";
import { configManager, gameEntityKey } from "./config-manager";
import { ResourceManager } from "./resource-manager";
import { StaminaManager } from "./stamina-manager";
import { computeExploreFoodCosts, computeTravelFoodCosts } from "./utils";

export class ArmyActionManager {
  private readonly entity: Entity;
  private readonly entityId: ID;
  private readonly staminaManager: StaminaManager;
  private readonly FELT_CENTER: number;
  constructor(
    private readonly components: ClientComponents,
    private readonly systemCalls: SystemCalls,
    entityId: ID,
  ) {
    this.entity = gameEntityKey([BigInt(entityId)]);
    this.entityId = entityId;
    this.staminaManager = new StaminaManager(this.components, entityId);
    this.FELT_CENTER = FELT_CENTER();
  }

  private _getTroopType(): TroopType {
    const entityArmy = getComponentValue(this.components.ExplorerTroops, this.entity);

    return entityArmy?.troops.category as TroopType;
  }

  private _canExplore(currentDefaultTick: number, currentArmiesTick: number): boolean {
    const stamina = this.staminaManager.getStamina(currentArmiesTick);

    if (Number(stamina.amount) < configManager.getExploreStaminaCost()) {
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

    let maxTravelWheatSteps = Infinity;
    let maxTravelFishSteps = Infinity;
    if (travelFoodCosts.wheatPayAmount > 0) {
      maxTravelWheatSteps = Math.floor(wheat / travelFoodCosts.wheatPayAmount);
    }
    if (travelFoodCosts.fishPayAmount > 0) {
      maxTravelFishSteps = Math.floor(fish / travelFoodCosts.fishPayAmount);
    }

    const maxTravelSteps = Math.min(maxTravelWheatSteps, maxTravelFishSteps);
    return Math.min(maxStaminaSteps, maxTravelSteps);
  };

  private readonly _getCurrentPosition = () => {
    const position = getComponentValue(this.components.ExplorerTroops, this.entity)?.coord;
    return { col: position!.x, row: position!.y };
  };

  // getFood is without precision
  public getFood(currentDefaultTick: number) {
    const resourceManager = this._getOwnerResourceManager();
    if (!resourceManager) {
      return {
        wheat: 0,
        fish: 0,
      };
    }

    const wheatBalance = resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Wheat);
    const fishBalance = resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Fish);

    return {
      wheat: divideByPrecision(wheatBalance.balance),
      fish: divideByPrecision(fishBalance.balance),
    };
  }

  private isWorldSpireHex(position: HexPosition): boolean {
    const tile = getTileAt(this.components, false, position.col, position.row);
    return tile?.occupier_type === TileOccupier.Spire;
  }

  private getAttackStaminaRequirement(): number {
    return configManager.getCombatConfig().stamina_attack_req;
  }

  private addAttackActionPaths(
    actionPaths: ActionPaths,
    startPos: HexPosition,
    attackRange: number,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    structureHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
    playerAddress: ContractAddress,
  ) {
    const attackStaminaCost = this.getAttackStaminaRequirement();
    const targetHexes = getHexesWithinRadius(startPos.col, startPos.row, attackRange);

    for (const { col, row } of targetHexes) {
      const army = armyHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);
      const structure = structureHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);
      const target = army ?? structure;
      if (!target || target.owner === playerAddress) continue;

      const biome = exploredHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);
      actionPaths.set(ActionPaths.posKey({ col, row }), [
        {
          hex: { col: startPos.col, row: startPos.row },
          actionType: ActionType.Move,
        },
        {
          hex: { col, row },
          actionType: ActionType.Attack,
          biomeType: biome,
          staminaCost: attackStaminaCost,
        },
      ]);
    }
  }

  public findActionPaths(
    structureHexes: Map<number, Map<number, HexEntityInfo>>,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
    chestHexes: Map<number, Map<number, HexEntityInfo>>,
    currentDefaultTick: number,
    currentArmiesTick: number,
    playerAddress: ContractAddress,
  ): ActionPaths {
    const armyStamina = Number(this.staminaManager.getStamina(currentArmiesTick).amount);

    const troopType = this._getTroopType();
    // One truth: paths plan from the same ExplorerTroops coord the submit
    // freshness guard checks. Callers must not substitute a visual position.
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
      const isSpire = this.isWorldSpireHex({ col, row });
      const isExplored = exploredHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
      const hasArmy = armyHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
      const isArmyMine =
        armyHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER)?.owner === playerAddress || false;
      const hasStructure = structureHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
      const hasChest = chestHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
      const isStructureMine =
        structureHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER)?.owner === playerAddress || false;
      const biome = exploredHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);

      // Skip if hex requires exploration but army can't explore
      if (!isExplored && !canExplore) continue;

      const isMine = isArmyMine || isStructureMine;
      const canAttack = (hasArmy || hasStructure) && !isMine;

      // Determine action type
      let actionType;
      let staminaCost = 0;

      if (isSpire) {
        actionType = ActionType.SpireTravel;
      } else if (isMine) {
        actionType = ActionType.Help;
      } else if (canAttack) {
        actionType = ActionType.Attack;
        staminaCost = this.getAttackStaminaRequirement();
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
      const sortedQueue = priorityQueue.toSorted((a, b) => a.staminaUsed - b.staminaUsed);
      priorityQueue.length = 0;
      priorityQueue.push(...sortedQueue.slice(1));
      const { position: current, staminaUsed, distance, path } = sortedQueue[0];
      const currentKey = ActionPaths.posKey(current);

      if (!lowestStaminaUse.has(currentKey) || staminaUsed < lowestStaminaUse.get(currentKey)!) {
        lowestStaminaUse.set(currentKey, staminaUsed);
        const isExplored =
          exploredHexes.get(current.col - this.FELT_CENTER)?.has(current.row - this.FELT_CENTER) || false;
        const hasArmy = armyHexes.get(current.col - this.FELT_CENTER)?.has(current.row - this.FELT_CENTER) || false;
        const hasStructure =
          structureHexes.get(current.col - this.FELT_CENTER)?.has(current.row - this.FELT_CENTER) || false;
        const hasChest = chestHexes.get(current.col - this.FELT_CENTER)?.has(current.row - this.FELT_CENTER) || false;
        const hasSpire = this.isWorldSpireHex(current);

        actionPaths.set(currentKey, path);

        // cannot go through these hexes so need to stop here
        if (!isExplored || hasArmy || hasStructure || hasChest || hasSpire) continue;

        const neighbors = getNeighborHexes(current.col, current.row);
        for (const { col, row } of neighbors) {
          const neighborKey = ActionPaths.posKey({ col, row });
          const nextDistance = distance + 1;

          if (nextDistance > maxHex) continue;

          const isExplored = exploredHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
          const hasArmy = armyHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
          const hasStructure = structureHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
          const biome = exploredHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);
          const hasChest = chestHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
          const hasSpire = this.isWorldSpireHex({ col, row });

          if (hasSpire) continue;

          if (!isExplored || hasArmy || hasStructure || hasChest) continue;

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

    if (armyStamina >= this.getAttackStaminaRequirement()) {
      this.addAttackActionPaths(
        actionPaths,
        startPos,
        getTroopAttackRange(troopType),
        armyHexes,
        structureHexes,
        exploredHexes,
        playerAddress,
      );
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
    const destinationHex = path[path.length - 1]?.hex;
    if (!destinationHex) {
      return Promise.reject(new Error("Missing destination tile for explore"));
    }

    // Position-freshness guard. The vrf_source_salt below is baked into the
    // multicall from `destinationHex`, but the chain's actual end tile is
    // `explorer.coord + direction`. If the client's path[0] disagrees with the
    // chain-visible coord, the salted request_random and the real consume will
    // reference different tiles → "VrfProvider: not consumed". Reject upfront
    // so the user retries with a fresh action path instead of eating a failed tx.
    const pathStart = path[0]?.hex;
    const explorerTroops = getComponentValue(this.components.ExplorerTroops, this.entity);
    const chainCoord = explorerTroops?.coord as { x?: unknown; y?: unknown } | undefined;
    if (pathStart && chainCoord !== undefined && chainCoord.x !== undefined && chainCoord.y !== undefined) {
      const chainCol = Number(chainCoord.x);
      const chainRow = Number(chainCoord.y);
      if (Number.isFinite(chainCol) && Number.isFinite(chainRow)) {
        const matchesPathStart = pathStart.col === chainCol && pathStart.row === chainRow;
        if (!matchesPathStart) {
          return Promise.reject(
            new Error(
              `Explorer position drifted — path expected (${pathStart.col}, ${pathStart.row}) but chain reports (${chainCol}, ${chainRow}). Retry with a fresh path.`,
            ),
          );
        }
      }
    }

    const vrfSourceSalt = packTileSeed({ alt: false, col: destinationHex.col, row: destinationHex.row });
    return this.systemCalls.explorer_explore({
      explorer_id: this.entityId,
      directions: [direction],
      vrf_source_salt: vrfSourceSalt,
      signer,
    });
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
    return this.systemCalls.explorer_travel({
      signer,
      explorer_id: this.entityId,
      directions,
    });
  };

  private readonly _travelThroughSpire = async (
    signer: Account | AccountInterface,
    path: ActionPath[],
    currentArmiesTick: number,
  ) => {
    const direction = this._findDirection(path.map((p) => p.hex));
    if (direction === undefined || direction === null) {
      return Promise.reject(new Error("Invalid spire direction"));
    }

    try {
      return await this.systemCalls.toggle_alternate({
        signer,
        explorer_id: this.entityId,
        spire_direction: direction,
      });
    } catch (e) {
      return Promise.reject(e);
    }
  };

  public moveArmy = (
    signer: Account | AccountInterface,
    path: ActionPath[],
    isExplored: boolean,
    currentArmiesTick: number,
  ) => {
    const actionType = ActionPaths.getActionType(path);
    if (actionType === ActionType.SpireTravel) {
      return this._travelThroughSpire(signer, path, currentArmiesTick);
    }

    if (!isExplored) {
      return this._exploreHex(signer, path, currentArmiesTick);
    } else {
      return this._travelToHex(signer, path, currentArmiesTick);
    }
  };

  private _getOwnerResourceManager() {
    const ownerId = getComponentValue(this.components.ExplorerTroops, this.entity)?.owner;
    return ownerId ? new ResourceManager(this.components, ownerId) : null;
  }
}
