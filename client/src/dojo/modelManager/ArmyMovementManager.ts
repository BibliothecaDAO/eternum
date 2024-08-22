import { getCurrentTick } from "@/three/helpers/ticks";
import { HexPosition } from "@/types";
import { FELT_CENTER } from "@/ui/config";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  ContractAddress,
  EternumGlobalConfig,
  ID,
  ResourcesIds,
  getNeighborHexes,
  neighborOffsetsEven,
  neighborOffsetsOdd,
} from "@bibliothecadao/eternum";
import { Entity, OverridableComponent, getComponentValue } from "@dojoengine/recs";
import { uuid } from "@latticexyz/utils";
import { ClientComponents } from "../createClientComponents";
import { SetupResult } from "../setup";
import { ProductionManager } from "./ProductionManager";
import { getRemainingCapacity } from "./utils/ArmyMovementUtils";
import { StaminaManager } from "./StaminaManager";

export class TravelPaths {
  private paths: Map<string, { path: HexPosition[]; isExplored: boolean }>;

  constructor() {
    this.paths = new Map();
  }

  set(key: string, value: { path: HexPosition[]; isExplored: boolean }): void {
    this.paths.set(key, value);
  }

  deleteAll(): void {
    this.paths.clear();
  }

  get(key: string): { path: HexPosition[]; isExplored: boolean } | undefined {
    return this.paths.get(key);
  }

  has(key: string): boolean {
    return this.paths.has(key);
  }

  values(): IterableIterator<{ path: HexPosition[]; isExplored: boolean }> {
    return this.paths.values();
  }

  getHighlightedHexes(): { col: number; row: number }[] {
    return Array.from(this.paths.values()).map(({ path }) => ({
      col: path[path.length - 1].col - FELT_CENTER,
      row: path[path.length - 1].row - FELT_CENTER,
    }));
  }

  isHighlighted(row: number, col: number): boolean {
    return this.paths.has(TravelPaths.posKey({ col: col + FELT_CENTER, row: row + FELT_CENTER }));
  }

  getPaths(): Map<string, { path: HexPosition[]; isExplored: boolean }> {
    return this.paths;
  }

  static posKey(pos: HexPosition, normalized = false): string {
    const col = normalized ? pos.col + FELT_CENTER : pos.col;
    const row = normalized ? pos.row + FELT_CENTER : pos.row;
    return `${col},${row}`;
  }
}

export class ArmyMovementManager {
  private overridableTileModel: OverridableComponent<ClientComponents["Tile"]["schema"]>;
  private overridableStaminaModel: OverridableComponent<ClientComponents["Stamina"]["schema"]>;
  private overridablePositionModel: OverridableComponent<ClientComponents["Position"]["schema"]>;
  private entity: Entity;
  private entityId: ID;
  private address: ContractAddress;
  private fishManager: ProductionManager;
  private wheatManager: ProductionManager;
  private staminaManager: StaminaManager;

  constructor(
    private dojo: SetupResult,
    entityId: ID,
  ) {
    this.overridableTileModel = dojo.components.Tile;
    this.overridableStaminaModel = dojo.components.Stamina;
    this.overridablePositionModel = dojo.components.Position;
    this.entity = getEntityIdFromKeys([BigInt(entityId)]);
    this.entityId = entityId;
    this.address = ContractAddress(this.dojo.network.burnerManager.account?.address || 0n);
    const entityOwnerId = getComponentValue(dojo.components.EntityOwner, this.entity);
    this.wheatManager = new ProductionManager(
      dojo.components.Production,
      dojo.components.Resource,
      dojo.components.BuildingQuantityv2,
      entityOwnerId!.entity_owner_id,
      ResourcesIds.Wheat,
    );
    this.fishManager = new ProductionManager(
      dojo.components.Production,
      dojo.components.Resource,
      dojo.components.BuildingQuantityv2,
      entityOwnerId!.entity_owner_id,
      ResourcesIds.Fish,
    );
    this.staminaManager = new StaminaManager(entityId, dojo);
  }

  private _canExplore(): boolean {
    const stamina = this.staminaManager.getStamina().amount;

    if (stamina < EternumGlobalConfig.stamina.exploreCost) {
      return false;
    }
    const { wheat, fish } = this.getFood();

    if (fish < EternumGlobalConfig.exploration.fishBurn) {
      return false;
    }
    if (wheat < EternumGlobalConfig.exploration.wheatBurn) {
      return false;
    }

    if (this._getArmyRemainingCapacity() < EternumGlobalConfig.exploration.reward) {
      return false;
    }

    return true;
  }

  private _calculateMaxTravelPossible = () => {
    const stamina = this.staminaManager.getStamina();
    return Math.floor((stamina.amount || 0) / EternumGlobalConfig.stamina.travelCost);
  };

  private _getCurrentPosition = () => {
    const position = getComponentValue(this.overridablePositionModel, this.entity);
    return { col: position!.x, row: position!.y };
  };

  public getFood() {
    const currentTick = getCurrentTick();
    const wheatBalance = this.wheatManager.balance(currentTick);
    const fishBalance = this.fishManager.balance(currentTick);

    return {
      wheat: wheatBalance,
      fish: fishBalance,
    };
  }

  public findPaths(exploredHexes: Map<number, Set<number>>): TravelPaths {
    const startPos = this._getCurrentPosition();
    const maxHex = this._calculateMaxTravelPossible();
    const canExplore = this._canExplore();

    const priorityQueue: { position: HexPosition; distance: number; path: HexPosition[] }[] = [
      { position: startPos, distance: 0, path: [startPos] },
    ];
    const travelPaths = new TravelPaths();
    const shortestDistances = new Map<string, number>();

    while (priorityQueue.length > 0) {
      priorityQueue.sort((a, b) => a.distance - b.distance); // This makes the queue work as a priority queue
      const { position: current, distance, path } = priorityQueue.shift()!;
      const currentKey = TravelPaths.posKey(current);

      if (!shortestDistances.has(currentKey) || distance < shortestDistances.get(currentKey)!) {
        shortestDistances.set(currentKey, distance);
        const isExplored = exploredHexes.get(current.col - FELT_CENTER)?.has(current.row - FELT_CENTER) || false;
        if (path.length >= 2) {
          travelPaths.set(currentKey, { path: path, isExplored });
        }
        if (!isExplored) continue;

        const neighbors = getNeighborHexes(current.col, current.row); // This function needs to be defined
        for (const { col, row } of neighbors) {
          const neighborKey = TravelPaths.posKey({ col, row });
          const nextDistance = distance + 1;
          const nextPath = [...path, { col, row }];

          const isExplored = exploredHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER) || false;
          if ((isExplored && nextDistance <= maxHex) || (!isExplored && canExplore && nextDistance === 1)) {
            if (!shortestDistances.has(neighborKey) || nextDistance < shortestDistances.get(neighborKey)!) {
              priorityQueue.push({ position: { col, row }, distance: nextDistance, path: nextPath });
            }
          }
        }
      }
    }

    return travelPaths;
  }

  public isMine = () => {
    let entityOwner = getComponentValue(this.dojo.components.EntityOwner, this.entity);
    let owner = getComponentValue(this.dojo.components.Owner, this.entity);
    if (!owner && entityOwner?.entity_owner_id) {
      owner = getComponentValue(this.dojo.components.Owner, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]));
    }
    return owner?.address === this.address;
  };

  private _optimisticStaminaUpdate = (overrideId: string, cost: number) => {
    const stamina = this.staminaManager.getStamina();

    // substract the costs
    this.overridableStaminaModel.addOverride(overrideId, {
      entity: this.entity,
      value: {
        entity_id: stamina.entity_id,
        last_refill_tick: stamina.last_refill_tick,
        amount: stamina.amount - cost,
      },
    });
  };

  private _optimisticTileUpdate = (overrideId: string, col: number, row: number) => {
    const entity = getEntityIdFromKeys([BigInt(col), BigInt(row)]);

    this.overridableTileModel.addOverride(overrideId, {
      entity,
      value: {
        col: col,
        row: row,
        explored_by_id: this.entityId,
        explored_at: BigInt(Math.floor(Date.now() / 1000)),
        biome: "None",
      },
    });
  };

  private _optimisticPositionUpdate = (overrideId: string, col: number, row: number) => {
    this.overridablePositionModel.addOverride(overrideId, {
      entity: this.entity,
      value: {
        entity_id: this.entityId,
        x: col,
        y: row,
      },
    });
  };

  private _optimisticExplore = (col: number, row: number) => {
    let overrideId = uuid();

    this._optimisticStaminaUpdate(overrideId, EternumGlobalConfig.stamina.exploreCost);
    this._optimisticTileUpdate(overrideId, col, row);
    this._optimisticPositionUpdate(overrideId, col, row);

    return overrideId;
  };

  private _findDirection = (path: HexPosition[]) => {
    if (path.length !== 2) return undefined;

    const startPos = { col: path[0].col, row: path[0].row };
    const endPos = { col: path[1].col, row: path[1].row };
    const neighborOffsets = startPos.row % 2 === 0 ? neighborOffsetsEven : neighborOffsetsOdd;

    for (let offset of neighborOffsets) {
      if (startPos.col + offset.i === endPos.col && startPos.row + offset.j === endPos.row) {
        return offset.direction;
      }
    }
  };

  private _exploreHex = async (path: HexPosition[]) => {
    const direction = this._findDirection(path);
    if (direction === undefined) return;

    const overrideId = this._optimisticExplore(path[1].col, path[1].row);

    this.dojo.systemCalls
      .explore({
        unit_id: this.entityId,
        direction,
        signer: this.dojo.network.burnerManager.account!,
      })
      .catch((e) => {
        this.overridablePositionModel.removeOverride(overrideId);
        this.overridableStaminaModel.removeOverride(overrideId);
        this.overridableTileModel.removeOverride(overrideId);
      });
  };

  private _optimisticTravelHex = (col: number, row: number, pathLength: number) => {
    let overrideId = uuid();

    this._optimisticStaminaUpdate(overrideId, EternumGlobalConfig.stamina.travelCost * pathLength);

    this.overridablePositionModel.addOverride(overrideId, {
      entity: this.entity,
      value: {
        entity_id: this.entityId,
        x: col,
        y: row,
      },
    });
    return overrideId;
  };

  private _travelToHex = async (path: HexPosition[]) => {
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

    this.dojo.systemCalls
      .travel_hex({
        signer: this.dojo.network.burnerManager.account!,
        travelling_entity_id: this.entityId,
        directions,
      })
      .catch(() => {
        this.overridablePositionModel.removeOverride(overrideId);
        this.overridableStaminaModel.removeOverride(overrideId);
      });
  };

  public moveArmy = (path: HexPosition[], isExplored: boolean) => {
    if (!isExplored) {
      this._exploreHex(path);
    } else {
      this._travelToHex(path);
    }
  };

  private _getArmyRemainingCapacity = () => {
    const armyCapacity = getComponentValue(this.dojo.components.Capacity, this.entity);
    const armyWeight = getComponentValue(this.dojo.components.Weight, this.entity);
    const armyEntity = getComponentValue(this.dojo.components.Army, this.entity);

    if (!armyEntity || !armyCapacity) return 0n;

    return getRemainingCapacity(armyEntity, armyCapacity, armyWeight!);
  };
}
