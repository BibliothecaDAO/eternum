import {
  EternumGlobalConfig,
  ID,
  ResourcesIds,
  WORLD_CONFIG_ID,
  getNeighborHexes,
  neighborOffsetsEven,
  neighborOffsetsOdd,
} from "@bibliothecadao/eternum";
import { FELT_CENTER } from "@/ui/config";
import { getEntityIdFromKeys } from "@/ui/utils/utils";
import { Component, Entity, OverridableComponent, getComponentValue } from "@dojoengine/recs";
import { ClientComponents } from "../createClientComponents";
import { SetupResult } from "../setup";
import { HexPosition } from "@/types";
import { uuid } from "@latticexyz/utils";
import { getCurrentArmiesTick, getCurrentTick } from "@/three/helpers/ticks";
import { ProductionManager } from "./ProductionManager";

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
  private tileModel: OverridableComponent<ClientComponents["Tile"]["schema"]>;
  private staminaModel: OverridableComponent<ClientComponents["Stamina"]["schema"]>;
  private positionModel: OverridableComponent<ClientComponents["Position"]["schema"]>;
  private armyModel: Component<ClientComponents["Army"]["schema"]>;
  private ownerModel: Component<ClientComponents["Owner"]["schema"]>;
  private entityOwnerModel: Component<ClientComponents["EntityOwner"]["schema"]>;
  private staminaConfigModel: Component<ClientComponents["StaminaConfig"]["schema"]>;
  private entity: Entity;
  private entityId: ID;
  private address: bigint;
  private fishManager: ProductionManager;
  private wheatManager: ProductionManager;

  constructor(private dojo: SetupResult, entityId: ID) {
    const {
      Tile,
      Stamina,
      Position,
      Army,
      Owner,
      EntityOwner,
      StaminaConfig,
      Production,
      Resource,
      BuildingQuantityv2,
    } = dojo.components;
    this.tileModel = Tile;
    this.staminaModel = Stamina;
    this.positionModel = Position;
    this.armyModel = Army;
    this.ownerModel = Owner;
    this.entityOwnerModel = EntityOwner;
    this.staminaConfigModel = StaminaConfig;
    this.entity = getEntityIdFromKeys([BigInt(entityId)]);
    this.entityId = entityId;
    this.address = BigInt(this.dojo.network.burnerManager.account?.address || 0n);
    const entityOwnerId = getComponentValue(EntityOwner, this.entity);
    this.wheatManager = new ProductionManager(
      Production,
      Resource,
      BuildingQuantityv2,
      entityOwnerId!.entity_owner_id,
      ResourcesIds.Wheat,
    );
    this.fishManager = new ProductionManager(
      Production,
      Resource,
      BuildingQuantityv2,
      entityOwnerId!.entity_owner_id,
      ResourcesIds.Fish,
    );
  }

  private _maxStamina = (troops: any): number => {
    let maxStaminas: number[] = [];
    if (troops.knight_count > 0) {
      const knightConfig = getComponentValue(
        this.staminaConfigModel,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Knight)]),
      );
      maxStaminas.push(knightConfig!.max_stamina);
    }
    if (troops.crossbowman_count > 0) {
      const crossbowmenConfig = getComponentValue(
        this.staminaConfigModel,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Crossbowman)]),
      );
      maxStaminas.push(crossbowmenConfig!.max_stamina);
    }
    if (troops.paladin_count > 0) {
      const paladinConfig = getComponentValue(
        this.staminaConfigModel,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Paladin)]),
      );
      maxStaminas.push(paladinConfig!.max_stamina);
    }

    if (maxStaminas.length === 0) return 0;

    const maxArmyStamina = Math.min(...maxStaminas);

    return maxArmyStamina;
  };

  getStamina() {
    let staminaEntity = getComponentValue(this.staminaModel, this.entity);
    if (!staminaEntity) {
      throw Error("no stamina for entity");
    }
    const armyEntity = getComponentValue(this.armyModel, this.entity);

    const currentArmiesTick = getCurrentArmiesTick();

    if (currentArmiesTick !== Number(staminaEntity?.last_refill_tick)) {
      staminaEntity = {
        ...staminaEntity!,
        last_refill_tick: BigInt(currentArmiesTick),
        amount: this._maxStamina(armyEntity!.troops),
      };
    }
    return staminaEntity;
  }

  private _canExplore(): boolean {
    const stamina = this.getStamina().amount;

    const currentTick = getCurrentTick();

    if (stamina < EternumGlobalConfig.stamina.exploreCost) {
      return false;
    }
    if (this.fishManager.balance(currentTick) < EternumGlobalConfig.exploration.fishBurn) {
      return false;
    }
    if (this.wheatManager.balance(currentTick) < EternumGlobalConfig.exploration.wheatBurn) {
      return false;
    }

    return true;
  }

  private _calculateMaxTravelPossible = () => {
    const stamina = this.getStamina();
    return Math.floor((stamina.amount || 0) / EternumGlobalConfig.stamina.travelCost);
  };

  private _getCurrentPosition = () => {
    const position = getComponentValue(this.positionModel, this.entity);
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
    let entityOwner = getComponentValue(this.entityOwnerModel, this.entity);
    let owner = getComponentValue(this.ownerModel, this.entity);
    if (!owner && entityOwner?.entity_owner_id) {
      owner = getComponentValue(this.ownerModel, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]));
    }
    return owner?.address === this.address;
  };

  private _optimisticStaminaUpdate = (overrideId: string, cost: number) => {
    const stamina = this.getStamina();

    // substract the costs
    this.staminaModel.addOverride(overrideId, {
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

    this.tileModel.addOverride(overrideId, {
      entity,
      value: {
        col: col,
        row: row,
        explored_by_id: this.entityId,
        explored_at: BigInt(Date.now() / 1000),
        biome: "None",
      },
    });
  };

  private _optimisticPositionUpdate = (overrideId: string, col: number, row: number) => {
    this.positionModel.addOverride(overrideId, {
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
    // setExploredHexes(path[1].x - FELT_CENTER, path[1].y - FELT_CENTER);

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
        // removeHex(path[1].x - FELT_CENTER, path[1].y - FELT_CENTER);
        this.positionModel.removeOverride(overrideId);
        this.staminaModel.removeOverride(overrideId);
      });
  };

  private _optimisticTravelHex = (col: number, row: number, pathLength: number) => {
    let overrideId = uuid();

    this._optimisticStaminaUpdate(overrideId, EternumGlobalConfig.stamina.travelCost * pathLength);

    this.positionModel.addOverride(overrideId, {
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
        this.positionModel.removeOverride(overrideId);
        this.staminaModel.removeOverride(overrideId);
      });
  };

  public moveArmy = (path: HexPosition[], isExplored: boolean) => {
    if (!isExplored) {
      this._exploreHex(path);
    } else {
      this._travelToHex(path);
    }
  };
}
