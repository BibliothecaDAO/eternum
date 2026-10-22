import { safeInteger } from "../utils/safe-integer";
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
import { type ActionPath, ActionPaths, ActionType, type OrderRefusal } from "../utils/action-paths";
import { configManager } from "./config-manager";
import { ResourceManager } from "./resource-manager";
import { StaminaManager } from "./stamina-manager";
import { computeExploreFoodCosts, computeTravelFoodCosts } from "./utils";
import { isViewerOwner } from "../utils/viewer";
import { isTileOccupierMapSite } from "../utils/map/hex";
import { armyRealmSpire, isAtExpeditionSpire } from "../utils/expeditions";

/**
 * What bounds an army's orders as chain time passes: its spendable stamina, the steps its stamina and its owner's food
 * pay for, and whether it can explore. While these hold, the same map gives the same orders.
 */
export interface ArmyReach {
  stamina: number;
  travelSteps: number;
  canExplore: boolean;
}

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

  /** Whether the army can explore one hex now: its stamina and its owner's food for the explore. */
  public canExplore(currentDefaultTick: number): boolean {
    const stamina = this.staminaManager.getStamina(currentDefaultTick);

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

  /** How many hexes the army can travel now, by its stamina and its owner's food. */
  public readonly maxTravelSteps = (currentDefaultTick: number) => {
    const stamina = this.staminaManager.getStamina(currentDefaultTick);
    const maxStaminaSteps = this.staminaSteps(Number(stamina?.amount ?? 0n));

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

  /** The steps a stamina pays for at the cheapest biome's travel cost for this troop type. */
  private staminaSteps(stamina: number): number {
    return Math.floor(stamina / configManager.getMinTravelStaminaCost());
  }

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

  // A shrine, well or dormant spire holds its tile: no path enters or crosses it.
  private isMapSiteHex(position: HexPosition): boolean {
    const tile = getTileAt(this.store, this._getCurrentPosition().alt, position.col, position.row);
    return tile !== undefined && isTileOccupierMapSite(tile.occupier_type);
  }

  /**
   * Something holds the tile, by the tile's own occupancy: the contract refuses a move or an explore onto any held
   * tile, so no step enters or crosses it, whatever the indexes this plan was handed saw there (they leave out a
   * reserved Hyperstructure site, for one).
   */
  private isOccupiedHex(position: HexPosition): boolean {
    const tile = getTileAt(this.store, this._getCurrentPosition().alt, position.col, position.row);
    return tile !== undefined && tile.occupier_type !== TileOccupier.None;
  }

  /**
   * Another player's structure where the game lets an army attack only what nobody owns: the contract refuses the
   * attack, so the hex is no target and no order leads onto it.
   */
  private isStructureOffLimits(structure: HexEntityInfo | undefined): boolean {
    return (
      structure !== undefined && BigInt(structure.owner ?? 0n) !== 0n && configManager.attacksOnlyUnownedStructures()
    );
  }

  /** Why the army cannot explore now: the explore's stamina, or else its owner's food for it (canExplore). */
  private exploreRefusal(armyStamina: number): OrderRefusal {
    const need = configManager.getExploreStaminaCost();
    return armyStamina < need ? { reason: "stamina", need } : { reason: "food" };
  }

  private getAttackStaminaRequirement(): number {
    return configManager.getCombatConfig().stamina_attack_req;
  }

  private addAttackActionPaths(
    actionPaths: ActionPaths,
    startPos: HexPosition,
    attackRange: number,
    armyStamina: number,
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
      if (!army && this.isStructureOffLimits(structure)) {
        actionPaths.refuse(ActionPaths.posKey({ col, row }), { reason: "off-limits" });
        continue;
      }
      // A target in range the army cannot yet strike: the attack's stamina is the reason.
      if (attackStaminaCost > armyStamina) {
        actionPaths.refuse(ActionPaths.posKey({ col, row }), { reason: "stamina", need: attackStaminaCost });
        continue;
      }

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

  /** The time-dependent bounds findActionPaths plans within, read at the given tick. */
  public reach(currentDefaultTick: number): ArmyReach {
    return {
      stamina: Number(this.staminaManager.getStamina(currentDefaultTick)?.amount ?? 0n),
      travelSteps: this.maxTravelSteps(currentDefaultTick),
      canExplore: this.canExplore(currentDefaultTick),
    };
  }

  public findActionPaths(
    structureHexes: Map<number, Map<number, HexEntityInfo>>,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredHexes: Map<number, Map<number, BiomeType>>,
    chestHexes: Map<number, Map<number, HexEntityInfo>>,
    currentDefaultTick: number,
    playerAddress: ContractAddress,
  ): ActionPaths {
    const { stamina: armyStamina, travelSteps: maxHex, canExplore } = this.reach(currentDefaultTick);
    // Fewer steps than the stamina pays for: the owner's food is what runs out.
    const foodBoundsSteps = maxHex < this.staminaSteps(armyStamina);

    const troopType = this._getTroopType();
    // One truth: paths plan from the same ExplorerTroops coord the submit
    // freshness guard checks. Callers must not substitute a visual position.
    const startPos = this._getCurrentPosition();

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
      const key = ActionPaths.posKey({ col, row });

      // Each tile skipped here says why (ActionPaths.refuse), so the map can name the reason where no order leads.
      if (!isSpire && !isExplored && !canExplore) {
        actionPaths.refuse(key, this.exploreRefusal(armyStamina));
        continue;
      }
      if (this.isMapSiteHex({ col, row })) {
        actionPaths.refuse(key, { reason: "occupied" });
        continue;
      }
      if (
        !hasArmy &&
        !isStructureMine &&
        this.isStructureOffLimits(structureHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER))
      ) {
        actionPaths.refuse(key, { reason: "off-limits" });
        continue;
      }

      const isMine = isArmyMine || isStructureMine;
      const canAttack = (hasArmy || hasStructure) && !isMine;

      // Determine action type
      let actionType;
      let staminaCost = 0;

      if (isSpire) {
        actionType = ActionType.SpireTravel;
      } else if (isMine) {
        // Help is a transfer between the player's own entities; where the game allows none, the hex offers nothing.
        if (configManager.helpTransfers(!isArmyMine).length === 0) {
          actionPaths.refuse(key, { reason: "no-transfer" });
          continue;
        }
        actionType = ActionType.Help;
      } else if (canAttack) {
        actionType = ActionType.Attack;
        staminaCost = this.getAttackStaminaRequirement();
      } else if (hasChest) {
        actionType = ActionType.Chest;
      } else if (this.isOccupiedHex({ col, row })) {
        actionPaths.refuse(key, { reason: "occupied" });
        continue;
      } else if (biome) {
        actionType = ActionType.Move;
        staminaCost = configManager.getTravelStaminaCost(biome, troopType);
        // No step left: the stamina for one, or else the food.
        if (maxHex === 0) {
          actionPaths.refuse(
            key,
            staminaCost > armyStamina ? { reason: "stamina", need: staminaCost } : { reason: "food" },
          );
          continue;
        }
      } else {
        actionType = ActionType.Explore;
        staminaCost = configManager.getExploreStaminaCost();
      }

      if (staminaCost > armyStamina) {
        actionPaths.refuse(key, { reason: "stamina", need: staminaCost });
        continue;
      }

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

          const isExplored = exploredHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
          const hasArmy = armyHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
          const hasStructure = structureHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
          const biome = exploredHexes.get(col - this.FELT_CENTER)?.get(row - this.FELT_CENTER);
          const hasChest = chestHexes.get(col - this.FELT_CENTER)?.has(row - this.FELT_CENTER) || false;
          const hasSpire = this.isWorldSpireHex({ col, row });

          // A target ends a route where it stands: the attack paths or the distance decide it below.
          if (hasSpire || hasArmy || hasStructure || hasChest) continue;
          if (this.isOccupiedHex({ col, row })) {
            actionPaths.refuse(neighborKey, { reason: "occupied" });
            continue;
          }
          if (!isExplored) continue;

          const staminaCost = configManager.getTravelStaminaCost(biome!, troopType);
          const nextStaminaUsed = staminaUsed + staminaCost;

          if (nextDistance > maxHex) {
            actionPaths.refuse(
              neighborKey,
              foodBoundsSteps ? { reason: "food" } : { reason: "stamina", need: nextStaminaUsed },
            );
            continue;
          }

          if (nextStaminaUsed > armyStamina) {
            actionPaths.refuse(neighborKey, { reason: "stamina", need: nextStaminaUsed });
            continue;
          }

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

    this.addAttackActionPaths(
      actionPaths,
      startPos,
      getTroopAttackRange(troopType),
      armyStamina,
      armyHexes,
      structureHexes,
      exploredHexes,
      playerAddress,
    );

    this.refuseTargetsBeyondStep(actionPaths, startPos, [armyHexes, structureHexes, chestHexes]);
    this.addDepthEntry(actionPaths, startPos, currentDefaultTick);
    return actionPaths;
  }

  /**
   * Beside its realm's lit spire, a living army's order there is to enter a depth, which the spire's card picks: the
   * spire holds no tile, so the plan would otherwise offer a plain move onto it. Its stamina is the shallowest depth's
   * entry. An army standing on the spire has no order at its own tile; its card opens as it is selected.
   */
  private addDepthEntry(actionPaths: ActionPaths, startPos: HexPosition, nowSeconds: number) {
    const gameId = configManager.getActiveGameId();
    const spire = armyRealmSpire(this.store, gameId, this.entityId, nowSeconds);
    if (!spire || !configManager.isCommandEnabled("EnterDepth")) return;
    const onSpire = spire.col === startPos.col && spire.row === startPos.row;
    if (onSpire || !isAtExpeditionSpire(spire, { x: startPos.col, y: startPos.row })) return;
    actionPaths.set(ActionPaths.posKey(spire), [
      { hex: { col: startPos.col, row: startPos.row }, actionType: ActionType.Move },
      {
        hex: { col: spire.col, row: spire.row },
        actionType: ActionType.EnterDepth,
        staminaCost: this.store.require("DepthRules", { game_id: gameId, depth: 1 }).entry_stamina,
      },
    ]);
  }

  /**
   * A structure, army or crate the planner saw that no rule above ordered or refused stands beyond the army's step:
   * every tile next to the army has an order or a reason by now, so the reason here is the distance, unless a site
   * holds the tile and no step would ever enter it.
   */
  private refuseTargetsBeyondStep(
    actionPaths: ActionPaths,
    startPos: HexPosition,
    indexes: Map<number, Map<number, HexEntityInfo>>[],
  ) {
    const startKey = ActionPaths.posKey(startPos);
    for (const index of indexes)
      for (const [col, rows] of index)
        for (const row of rows.keys()) {
          const hex = { col: col + this.FELT_CENTER, row: row + this.FELT_CENTER };
          const key = ActionPaths.posKey(hex);
          if (key === startKey || actionPaths.decided(key)) continue;
          actionPaths.refuse(key, this.isMapSiteHex(hex) ? { reason: "occupied" } : { reason: "too-far" });
        }
  }

  private readonly _findDirection = (path: HexPosition[], spire = false) => {
    if (path.length !== 2) return undefined;

    const startPos = { col: path[0].col, row: path[0].row };
    const endPos = { col: path[1].col, row: path[1].row };
    return getLayerNeighborHexes(startPos.col, startPos.row, spire ? false : this._getCurrentPosition().alt).find(
      (hex) => hex.col === endPos.col && hex.row === endPos.row,
    )?.direction;
  };

  private readonly _exploreHex = async (signer: GameplayAccount, path: ActionPath[]) => {
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

  private readonly _travelToHex = async (signer: Account | AccountInterface, path: ActionPath[]) => {
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

  private readonly _travelThroughSpire = async (signer: Account | AccountInterface, path: ActionPath[]) => {
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

  public moveArmy = (signer: Account | AccountInterface, path: ActionPath[], isExplored: boolean) => {
    const actionType = ActionPaths.getActionType(path);
    if (actionType === ActionType.SpireTravel) {
      return this._travelThroughSpire(signer, path);
    }

    if (!isExplored) {
      return this._exploreHex(signer, path);
    } else {
      return this._travelToHex(signer, path);
    }
  };

  private _getOwnerResourceManager() {
    const ownerId = this.store.require("ExplorerTroops", {
      game_id: configManager.getActiveGameId(),
      explorer_id: this.entityId,
    })?.owner;
    return ownerId ? new ResourceManager(this.store, safeInteger(ownerId)) : null;
  }
}
