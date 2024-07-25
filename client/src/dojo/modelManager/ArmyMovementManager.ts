import {
  EternumGlobalConfig,
  ResourcesIds,
  TROOPS_STAMINAS,
  WORLD_CONFIG_ID,
  getNeighborHexes,
  neighborOffsetsEven,
  neighborOffsetsOdd,
} from "@bibliothecadao/eternum";
import { FELT_CENTER } from "@/ui/config";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Component, Entity, OverridableComponent, getComponentValue } from "@dojoengine/recs";
import { ClientComponents } from "../createClientComponents";
import { SetupResult } from "../setup";
import { HexPosition } from "@/types";
import { uuid } from "@latticexyz/utils";

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

  static posKey(pos: HexPosition, normalized = false): string {
    const col = normalized ? pos.col + FELT_CENTER : pos.col;
    const row = normalized ? pos.row + FELT_CENTER : pos.row;
    return `${col},${row}`;
  }
}

export class ArmyMovementManager {
  private staminaModel: OverridableComponent<ClientComponents["Stamina"]["schema"]>;
  private positionModel: OverridableComponent<ClientComponents["Position"]["schema"]>;
  private armyModel: Component<ClientComponents["Army"]["schema"]>;
  private ownerModel: Component<ClientComponents["Owner"]["schema"]>;
  private entityOwnerModel: Component<ClientComponents["EntityOwner"]["schema"]>;
  private staminaConfigModel: Component<ClientComponents["StaminaConfig"]["schema"]>;
  private currentArmiesTick: number;
  private entity: Entity;
  private entityId: bigint;
  private address: bigint;

  constructor(private dojo: SetupResult, entityId: number) {
    this.staminaModel = dojo.components.Stamina;
    this.positionModel = dojo.components.Position;
    this.armyModel = dojo.components.Army;
    this.ownerModel = dojo.components.Owner;
    this.entityOwnerModel = dojo.components.EntityOwner;
    this.staminaConfigModel = dojo.components.StaminaConfig;
    this.currentArmiesTick = Date.now() / 1000;
    this.entity = getEntityIdFromKeys([BigInt(entityId)]);
    this.entityId = BigInt(entityId);
    this.address = BigInt(this.dojo.network.burnerManager.account?.address || 0n);
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
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Crossbowmen)]),
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
    const armyEntity = getComponentValue(this.armyModel, this.entity);

    if (this.currentArmiesTick !== staminaEntity?.last_refill_tick) {
      staminaEntity = {
        ...staminaEntity!,
        last_refill_tick: this.currentArmiesTick,
        amount: this._maxStamina(armyEntity!.troops),
      };
    }
    return staminaEntity;
  }

  private _canExplore(): boolean {
    const stamina = this.getStamina().amount;

    const food = [
      { resourceId: 254, amount: 10000000 },
      { resourceId: 255, amount: 10000000 },
    ];

    if (stamina && stamina < EternumGlobalConfig.stamina.exploreCost) {
      return false;
    }
    const fish = food.find((resource) => resource.resourceId === ResourcesIds.Fish);
    if ((fish?.amount || 0) < EternumGlobalConfig.exploration.fishBurn) {
      return false;
    }
    const wheat = food.find((resource) => resource.resourceId === ResourcesIds.Wheat);
    if ((wheat?.amount || 0) < EternumGlobalConfig.exploration.wheatBurn) {
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

  private _optimisticExplore = (col: number, row: number) => {
    let overrideId = uuid();

    this._optimisticStaminaUpdate(overrideId, EternumGlobalConfig.stamina.exploreCost);

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

    // console.log({ direction });

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
    console.log({ path, isExplored });
    if (!isExplored) {
      this._exploreHex(path);
    } else {
      this._travelToHex(path);
    }
  };
}
