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
import { Component, getComponentValue } from "@dojoengine/recs";
import { ClientComponents } from "../createClientComponents";
import { SetupResult } from "../setup";

export class TravelPaths {
  private paths: Map<string, { path: Position[]; isExplored: boolean }>;

  constructor() {
    this.paths = new Map();
  }

  set(key: string, value: { path: Position[]; isExplored: boolean }): void {
    this.paths.set(key, value);
  }

  get(key: string): { path: Position[]; isExplored: boolean } | undefined {
    return this.paths.get(key);
  }

  has(key: string): boolean {
    return this.paths.has(key);
  }

  values(): IterableIterator<{ path: Position[]; isExplored: boolean }> {
    return this.paths.values();
  }

  getHighlightedHexes(): { col: number; row: number }[] {
    return Array.from(this.paths.values()).map(({ path }) => ({
      col: path[path.length - 1].x - FELT_CENTER,
      row: path[path.length - 1].y - FELT_CENTER,
    }));
  }
}

export class ArmyMovementManager {
  private staminaModel: Component<ClientComponents["Stamina"]["schema"]>;
  private positionModel: Component<ClientComponents["Position"]["schema"]>;
  private armyModel: Component<ClientComponents["Army"]["schema"]>;
  private staminaConfigModel: Component<ClientComponents["StaminaConfig"]["schema"]>;
  private currentArmiesTick: number;
  private entityId: bigint;

  constructor(private dojo: SetupResult, currentArmiesTick: number, entityId: number) {
    this.staminaModel = dojo.components.Stamina;
    this.positionModel = dojo.components.Position;
    this.armyModel = dojo.components.Army;
    this.staminaConfigModel = dojo.components.StaminaConfig;
    this.currentArmiesTick = currentArmiesTick;
    this.entityId = BigInt(entityId);
  }

  getStamina() {
    let staminaEntity = getComponentValue(this.staminaModel, getEntityIdFromKeys([this.entityId]));
    const armyEntity = getComponentValue(this.armyModel, getEntityIdFromKeys([this.entityId]));

    if (this.currentArmiesTick !== staminaEntity?.last_refill_tick) {
      staminaEntity = {
        ...staminaEntity!,
        last_refill_tick: this.currentArmiesTick,
        amount: this.getMaxStamina(armyEntity!.troops),
      };
    }
    return staminaEntity as unknown as ClientComponents["Stamina"]["schema"];
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

  public findShortestPathBFS(endPos: Position, exploredHexes: Map<number, Set<number>>): Position[] {
    const startPos = this._getCurrentPosition();
    const maxHex = this.getMaxSteps();

    const queue: { position: Position; distance: number }[] = [{ position: startPos, distance: 0 }];
    const visited = new Set<string>();
    const path = new Map<string, Position>();

    const posKey = (pos: Position) => `${pos.x},${pos.y}`;

    while (queue.length > 0) {
      const { position: current, distance } = queue.shift()!;
      if (current.x === endPos.x && current.y === endPos.y) {
        // Reconstruct the path upon reaching the end position
        let temp = current;
        const result = [];
        while (temp) {
          result.unshift(temp); // Add to the beginning of the result array
          //@ts-ignore:
          temp = path.get(posKey(temp)); // Move backwards through the path
        }
        return result;
      }

      if (distance > maxHex) {
        break; // Stop processing if the current distance exceeds maxHex
      }

      const currentKey = posKey(current);
      if (!visited.has(currentKey)) {
        visited.add(currentKey);
        const neighbors = getNeighborHexes(current.x, current.y); // Assuming getNeighbors is defined elsewhere
        for (const { col: x, row: y } of neighbors) {
          const neighborKey = posKey({ x, y });
          const isExplored = exploredHexes.get(x - FELT_CENTER)?.has(y - FELT_CENTER);
          if (!visited.has(neighborKey) && !queue.some((e) => posKey(e.position) === neighborKey) && isExplored) {
            path.set(neighborKey, current); // Map each neighbor back to the current position
            queue.push({ position: { x, y }, distance: distance + 1 });
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
    console.log({ entityId: this.entityId });
    const position = getComponentValue(this.positionModel, getEntityIdFromKeys([this.entityId]));
    return { x: position!.x, y: position!.y };
  };

  public findAccessiblePositionsAndPaths(exploredHexes: Map<number, Set<number>>): TravelPaths {
    const startPos = this._getCurrentPosition();
    const maxHex = this._calculateMaxTravelPossible();
    const canExplore = this.canExplore();

    const posKey = (pos: Position) => `${pos.x},${pos.y}`;
    const priorityQueue: { position: Position; distance: number; path: Position[] }[] = [
      { position: startPos, distance: 0, path: [startPos] },
    ];
    const travelPaths = new TravelPaths();
    const shortestDistances = new Map<string, number>();

    while (priorityQueue.length > 0) {
      priorityQueue.sort((a, b) => a.distance - b.distance); // This makes the queue work as a priority queue
      const { position: current, distance, path } = priorityQueue.shift()!;
      const currentKey = posKey(current);

      if (!shortestDistances.has(currentKey) || distance < shortestDistances.get(currentKey)!) {
        shortestDistances.set(currentKey, distance);
        const isExplored = exploredHexes.get(current.x - FELT_CENTER)?.has(current.y - FELT_CENTER) || false;
        travelPaths.set(currentKey, { path: path, isExplored });
        if (!isExplored) continue;

        const neighbors = getNeighborHexes(current.x, current.y); // This function needs to be defined
        for (const { col: x, row: y } of neighbors) {
          const neighborKey = posKey({ x, y });
          const nextDistance = distance + 1;
          const nextPath = [...path, { x, y }];

          const isExplored = exploredHexes.get(x - FELT_CENTER)?.has(y - FELT_CENTER) || false;
          if ((isExplored && nextDistance <= maxHex) || (!isExplored && canExplore && nextDistance === 1)) {
            if (!shortestDistances.has(neighborKey) || nextDistance < shortestDistances.get(neighborKey)!) {
              priorityQueue.push({ position: { x, y }, distance: nextDistance, path: nextPath });
            }
          }
        }
      }
    }

    return travelPaths;
  }
}
