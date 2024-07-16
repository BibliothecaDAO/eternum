import {
  EternumGlobalConfig,
  Position,
  Resource,
  ResourcesIds,
  TROOPS_STAMINAS,
  WORLD_CONFIG_ID,
  getNeighborHexes,
} from "@bibliothecadao/eternum";
import { FELT_CENTER } from "@/ui/config";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Component, Entity, getComponentValue } from "@dojoengine/recs";
import { ClientComponents } from "../createClientComponents";
import { SetupResult } from "../setup";
import { HexPosition } from "@/types";

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
    console.log("hello");
    console.log({ col, row });
    return `${col},${row}`;
  }
}

export class ArmyMovementManager {
  private staminaModel: Component<ClientComponents["Stamina"]["schema"]>;
  private positionModel: Component<ClientComponents["Position"]["schema"]>;
  private armyModel: Component<ClientComponents["Army"]["schema"]>;
  private ownerModel: Component<ClientComponents["Owner"]["schema"]>;
  private entityOwnerModel: Component<ClientComponents["EntityOwner"]["schema"]>;
  private staminaConfigModel: Component<ClientComponents["StaminaConfig"]["schema"]>;
  private currentArmiesTick: number;
  private entity: Entity;
  private address: bigint;

  constructor(private dojo: SetupResult, currentArmiesTick: number, entityId: number) {
    this.staminaModel = dojo.components.Stamina;
    this.positionModel = dojo.components.Position;
    this.armyModel = dojo.components.Army;
    this.ownerModel = dojo.components.Owner;
    this.entityOwnerModel = dojo.components.EntityOwner;
    this.staminaConfigModel = dojo.components.StaminaConfig;
    this.currentArmiesTick = currentArmiesTick;
    this.entity = getEntityIdFromKeys([BigInt(entityId)]);
    this.address = BigInt(this.dojo.network.burnerManager.account?.address || 0n);
  }

  getStamina() {
    let staminaEntity = getComponentValue(this.staminaModel, this.entity);
    const armyEntity = getComponentValue(this.armyModel, this.entity);

    if (this.currentArmiesTick !== staminaEntity?.last_refill_tick) {
      staminaEntity = {
        ...staminaEntity!,
        last_refill_tick: this.currentArmiesTick,
        amount: this.getMaxStamina(armyEntity!.troops),
      };
    }
    return staminaEntity;
  }

  getMaxStamina = (troops: any): number => {
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

  public canExplore(): boolean {
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

  private getMaxSteps(): number {
    const staminaCosts = Object.values(EternumGlobalConfig.stamina);
    const minCost = Math.min(...staminaCosts);

    const staminaValues = Object.values(TROOPS_STAMINAS);
    const maxStamina = Math.max(...staminaValues);

    return Math.floor(maxStamina / minCost);
  }

  public findShortestPathBFS(endPos: HexPosition, exploredHexes: Map<number, Set<number>>): HexPosition[] {
    const startPos = this._getCurrentPosition();
    const maxHex = this.getMaxSteps();

    const queue: { position: HexPosition; distance: number }[] = [{ position: startPos, distance: 0 }];
    const visited = new Set<string>();
    const path = new Map<string, HexPosition>();

    while (queue.length > 0) {
      const { position: current, distance } = queue.shift()!;
      if (current.col === endPos.col && current.row === endPos.row) {
        // Reconstruct the path upon reaching the end position
        let temp = current;
        const result = [];
        while (temp) {
          result.unshift(temp); // Add to the beginning of the result array
          //@ts-ignore:
          temp = path.get(TravelPaths.posKey(temp)); // Move backwards through the path
        }
        return result;
      }

      if (distance > maxHex) {
        break; // Stop processing if the current distance exceeds maxHex
      }

      const currentKey = TravelPaths.posKey(current);
      if (!visited.has(currentKey)) {
        visited.add(currentKey);
        const neighbors = getNeighborHexes(current.col, current.row); // Assuming getNeighbors is defined elsewhere
        for (const { col, row } of neighbors) {
          const neighborKey = TravelPaths.posKey({ col, row });
          const isExplored = exploredHexes.get(col - FELT_CENTER)?.has(row - FELT_CENTER);
          if (
            !visited.has(neighborKey) &&
            !queue.some((e) => TravelPaths.posKey(e.position) === neighborKey) &&
            isExplored
          ) {
            path.set(neighborKey, current); // Map each neighbor back to the current position
            queue.push({ position: { col, row }, distance: distance + 1 });
          }
        }
      }
    }

    return []; // Return empty array if no path is found within maxHex distance
  }

  private _calculateMaxTravelPossible = () => {
    const stamina = this.getStamina();
    return Math.floor((stamina.amount || 0) / EternumGlobalConfig.stamina.travelCost);
  };

  private _getCurrentPosition = () => {
    const position = getComponentValue(this.positionModel, this.entity);
    return { col: position!.x, row: position!.y };
  };

  public isMine = () => {
    let entityOwner = getComponentValue(this.entityOwnerModel, this.entity);
    let owner = getComponentValue(this.ownerModel, this.entity);
    if (!owner && entityOwner?.entity_owner_id) {
      owner = getComponentValue(this.ownerModel, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]));
    }
    return owner?.address === this.address;
  };

  public findAccessiblePositionsAndPaths(exploredHexes: Map<number, Set<number>>): TravelPaths {
    const startPos = this._getCurrentPosition();
    const maxHex = this._calculateMaxTravelPossible();
    const canExplore = this.canExplore();

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
        travelPaths.set(currentKey, { path: path, isExplored });
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
}
