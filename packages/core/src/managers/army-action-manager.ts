import { entityMapPosition } from "../utils/tile";
import {
  type BiomeType,
  type ContractAddress,
  type GameplayAccount,
  getLayerNeighborHexes,
  getLayeredAttackDistance,
  getNeighborHexes,
  getTroopAttackRange,
  type HexEntityInfo,
  type HexPosition,
  type ID,
  ResourcesIds,
  TileOccupier,
  type SystemCalls,
  type TroopType,
} from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { Account, AccountInterface } from "starknet";
import { divideByPrecision, FELT_CENTER, getTileAt } from "..";
import { type ActionPath, ActionPaths, ActionType } from "../utils/action-paths";
import { configManager } from "./config-manager";
import { ResourceManager } from "./resource-manager";
import { StaminaManager } from "./stamina-manager";
import { computeExploreFoodCosts, computeTravelFoodCosts } from "./utils";
import { isViewerOwner } from "../utils/viewer";

export class ArmyActionManager {
  private readonly entityId: ID;
  private readonly staminaManager: StaminaManager;
  private readonly FELT_CENTER: number;
  constructor(
    private readonly store: NativeFactStore,
    private readonly systemCalls: SystemCalls,
    entityId: ID,
  ) {
    this.entityId = entityId;
    this.staminaManager = new StaminaManager(this.store, entityId);
    this.FELT_CENTER = FELT_CENTER();
  }

  private _getTroopType(): TroopType {
    const entityArmy = this.store.require("ExplorerTroops", {
      game_id: configManager.getActiveGameId(),
      explorer_id: this.entityId,
    });

    return entityArmy?.troops.category as TroopType;
  }

  private _canExplore(currentDefaultTick: number, currentArmiesTick: number): boolean {
    const stamina = this.staminaManager.getStamina(currentArmiesTick);

    if (Number(stamina?.amount ?? 0n) < configManager.getExploreStaminaCost()) {
      return false;
    }

    const entityArmy = this.store.require("ExplorerTroops", {
      game_id: configManager.getActiveGameId(),
      explorer_id: this.entityId,
    });
    const exploreFoodCosts = entityArmy
      ? computeExploreFoodCosts(entityArmy?.troops)
      : {
          wheatPayAmount: 0,
          fishPayAmount: 0,
        };
    const food = this.getFood(currentDefaultTick);
    if (!food) return false;
    const { wheat, fish } = food;

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
    const maxStaminaSteps = Math.floor(Number(stamina?.amount ?? 0n) / minTravelStaminaCost);

    const entityArmy = this.store.require("ExplorerTroops", {
      game_id: configManager.getActiveGameId(),
      explorer_id: this.entityId,
    });
    const travelFoodCosts = entityArmy
      ? computeTravelFoodCosts(entityArmy.troops)
      : {
          wheatPayAmount: 0,
          fishPayAmount: 0,
        };

    const food = this.getFood(currentDefaultTick);
    if (!food) return 0;
    const { wheat, fish } = food;

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
    const position = entityMapPosition(this.store, configManager.getActiveGameId(), this.entityId);
    return { col: position.x, row: position.y, alt: position.alt };
  };

  /** The owner's food, without precision; undefined when this client holds no resource owner for it (unknown). */
  public getFood(currentDefaultTick: number): { wheat: number; fish: number } | undefined {
    const resourceManager = this._getOwnerResourceManager();
    const wheatBalance = resourceManager?.balanceWithProduction(currentDefaultTick, ResourcesIds.Wheat);
    const fishBalance = resourceManager?.balanceWithProduction(currentDefaultTick, ResourcesIds.Fish);
    if (!wheatBalance || !fishBalance) return undefined;

    return {
      wheat: divideByPrecision(wheatBalance.balance),
      fish: divideByPrecision(fishBalance.balance),
    };
  }

  private isWorldSpireHex(position: HexPosition): boolean {
    const tile = getTileAt(this.store, this._getCurrentPosition().alt, position.col, position.row);
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
    const targetHexes = this.getAttackHexesInRange(startPos, attackRange, armyHexes, structureHexes);

    for (const { col, row } of targetHexes.values()) {
      const army = armyHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);
      const structure = structureHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);
      const target = army ?? structure;
      if (!target || isViewerOwner(target.owner, playerAddress)) continue;

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

  private getAttackHexesInRange(
    startPos: HexPosition,
    attackRange: number,
    ...indexes: Map<number, Map<number, HexEntityInfo>>[]
  ): Map<string, HexPosition> {
    const alt = this._getCurrentPosition().alt;
    const targets = new Map<string, HexPosition>();
    for (const index of indexes) {
      for (const [col, rows] of index) {
        for (const row of rows.keys()) {
          const hex = { col: col + this.FELT_CENTER, row: row + this.FELT_CENTER };
          const distance = getLayeredAttackDistance({ ...startPos, alt }, { ...hex, alt });
          if (distance > 0 && distance <= attackRange) targets.set(ActionPaths.posKey(hex), hex);
        }
      }
    }
    return targets;
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
    const armyStamina = Number(this.staminaManager.getStamina(currentArmiesTick)?.amount ?? 0n);

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
    // Portal reach is one surface hex on either layer; ordinary moves use the army's stride.
    const spires = getNeighborHexes(startPos.col, startPos.row).filter((hex) => this.isWorldSpireHex(hex));
    const neighbors = [
      ...getLayerNeighborHexes(startPos.col, startPos.row, startPos.alt).filter((hex) => !this.isWorldSpireHex(hex)),
      ...spires,
    ];
    for (const { col, row } of neighbors) {
      const isSpire = this.isWorldSpireHex({ col, row });
      const isExplored = exploredHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
      const hasArmy = armyHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
      const isArmyMine = isViewerOwner(
        armyHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER)?.owner,
        playerAddress,
      );
      const hasStructure = structureHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
      const hasChest = chestHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
      const isStructureMine = isViewerOwner(
        structureHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER)?.owner,
        playerAddress,
      );
      const biome = exploredHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);

      // Skip if hex requires exploration but army can't explore
      if (!isSpire && !isExplored && !canExplore) continue;

      const isMine = isArmyMine || isStructureMine;
      const canAttack = (hasArmy || hasStructure) && !isMine;

      // Determine action type
      let actionType;
      let staminaCost = 0;

      if (isSpire) {
        actionType = ActionType.SpireTravel;
      } else if (isMine) {
        // Help is a transfer between the player's own entities; where the game allows none, the hex offers nothing.
        if (configManager.helpTransfers(!isArmyMine).length === 0) continue;
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

        const neighbors = getLayerNeighborHexes(current.col, current.row, startPos.alt);
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

  private readonly _findDirection = (path: HexPosition[], spire = false) => {
    if (path.length !== 2) return undefined;

    const startPos = { col: path[0].col, row: path[0].row };
    const endPos = { col: path[1].col, row: path[1].row };
    return getLayerNeighborHexes(startPos.col, startPos.row, spire ? false : this._getCurrentPosition().alt).find(
      (hex) => hex.col === endPos.col && hex.row === endPos.row,
    )?.direction;
  };

  private readonly _exploreHex = async (signer: GameplayAccount, path: ActionPath[], currentArmiesTick: number) => {
    const direction = this._findDirection(path.map((p) => p.hex));
    if (direction === undefined || direction === null) {
      return Promise.reject(new Error("Invalid direction"));
    }
    const destinationHex = path[path.length - 1]?.hex;
    if (!destinationHex) {
      return Promise.reject(new Error("Missing destination tile for explore"));
    }

    // A selected path must still start at the authoritative explorer position.
    const pathStart = path[0]?.hex;
    const position = entityMapPosition(this.store, configManager.getActiveGameId(), this.entityId);
    if (pathStart && (pathStart.col !== position.x || pathStart.row !== position.y)) {
      return Promise.reject(
        new Error(
          `Explorer position drifted — path expected (${pathStart.col}, ${pathStart.row}) but chain reports (${position.x}, ${position.y}). Retry with a fresh path.`,
        ),
      );
    }

    return this.systemCalls.explorer_explore({
      explorer_id: this.entityId,
      directions: [direction],
      signer,
    });
  };

  private readonly _travelToHex = async (
    signer: Account | AccountInterface,
    path: ActionPath[],
    currentArmiesTick: number,
  ) => {
    const directions = path.slice(0, -1).map((step, index) => this._findDirection([step.hex, path[index + 1].hex]));
    if (!directions.length || directions.some((direction) => direction === undefined)) {
      throw new Error("Invalid travel direction for the army's layer");
    }
    return this.systemCalls.explorer_travel({
      signer,
      explorer_id: this.entityId,
      directions: directions as number[],
    });
  };

  private readonly _travelThroughSpire = async (
    signer: Account | AccountInterface,
    path: ActionPath[],
    currentArmiesTick: number,
  ) => {
    const direction = this._findDirection(
      path.map((p) => p.hex),
      true,
    );
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
    const ownerId = this.store.require("ExplorerTroops", {
      game_id: configManager.getActiveGameId(),
      explorer_id: this.entityId,
    })?.owner;
    return ownerId ? new ResourceManager(this.store, ownerId) : null;
  }
}
