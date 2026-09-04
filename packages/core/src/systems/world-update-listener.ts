import type { SetupResult } from "@bibliothecadao/dojo";
import { BuildingType, type ContractAddress, type HexPosition, type ID, ResourcesIds } from "@bibliothecadao/types";
import { type Component, defineComponentSystem, defineQuery, HasValue, isComponentUpdate } from "@dojoengine/recs";
import { divideByPrecision } from "../utils";
import type { BattleEventSystemUpdate, BuildingSystemUpdate, ExplorerRewardSystemUpdate } from "./types";

interface SubscriptionHandle {
  unsubscribe(): void;
}

/** Translates the few scene-local RECS effects that do not belong to the spatial projection. */
export class WorldUpdateListener {
  constructor(private readonly setup: SetupResult) {}

  private setupSystem<T>(
    component: Component,
    callback: (value: T) => void,
    resolveUpdate: (update: any) => T | undefined | Promise<T | undefined>,
    runOnInit = true,
  ): () => void {
    let active = true;
    const handleUpdate = async (update: any) => {
      if (!active) return;
      const value = await resolveUpdate(update);
      if (value && active) callback(value);
    };

    defineComponentSystem(this.setup.network.world, component, handleUpdate, { runOnInit });
    return () => {
      active = false;
    };
  }

  public get Buildings() {
    return {
      onBuildingUpdate: (hexCoords: HexPosition, callback: (value: BuildingSystemUpdate) => void): (() => void) =>
        this.setupSystem(
          this.setup.components.Building,
          callback,
          (update: any) => this.resolveBuildingUpdate(hexCoords, update),
          false,
        ),
    };
  }

  private resolveBuildingUpdate(hexCoords: HexPosition, update: any): BuildingSystemUpdate | undefined {
    if (!isComponentUpdate(update, this.setup.components.Building)) return;

    const [current, previous] = update.value;
    const building = current ?? previous;
    if (!building || building.outer_col !== hexCoords.col || building.outer_row !== hexCoords.row) return;

    if (!current || current.category === BuildingType.None) {
      return {
        buildingType: BuildingType.None,
        innerCol: building.inner_col,
        innerRow: building.inner_row,
        paused: false,
      };
    }

    return {
      buildingType: current.category,
      innerCol: current.inner_col,
      innerRow: current.inner_row,
      paused: current.paused,
    };
  }

  public get StructureEntityListener(): {
    onLevelUpdate(entityId: ID, callback: (update: { entityId: ID; level: number }) => void): SubscriptionHandle;
  } {
    return {
      onLevelUpdate: (entityId: ID, callback: (update: { entityId: ID; level: number }) => void) => {
        const query = defineQuery([HasValue(this.setup.components.Structure, { entity_id: entityId })], {
          runOnInit: false,
        });

        return query.update$.subscribe((update) => {
          if (!isComponentUpdate(update, this.setup.components.Structure)) return;
          const [current] = update.value;
          if (current) callback({ entityId, level: current.base.level });
        });
      },
    };
  }

  public get ExplorerReward() {
    return {
      onExplorerRewardEventUpdate: (callback: (value: ExplorerRewardSystemUpdate) => void) => {
        const component = this.setup.components.events?.ExplorerRewardEvent;
        if (!component) {
          console.warn("ExplorerRewardEvent component is not registered on setup.components.events");
          return;
        }

        return this.setupSystem(
          component,
          callback,
          (update: any) => {
            if (!isComponentUpdate(update, component)) return;
            const [current] = update.value;
            return current ? this.parseExplorerRewardEvent(current) : undefined;
          },
          false,
        );
      },
    };
  }

  public get BattleEvent() {
    return {
      onBattleUpdate: (callback: (value: BattleEventSystemUpdate) => void) =>
        this.setupSystem(
          this.setup.components.events.BattleEvent,
          callback,
          (update: any) => this.resolveBattleEventUpdate(update),
          false,
        ),
    };
  }

  private resolveBattleEventUpdate(update: any): BattleEventSystemUpdate | undefined {
    const component = this.setup.components.events.BattleEvent;
    if (!isComponentUpdate(update, component)) return;

    const [current] = update.value;
    if (!current) return;

    const entityId = current.winner_id === current.attacker_owner ? current.attacker_id : current.defender_id;
    if (entityId === undefined || entityId === null) return;

    const maxReward = Array.isArray(current.max_reward)
      ? current.max_reward.flatMap((reward: unknown) => {
          if (!Array.isArray(reward) || reward.length !== 2) return [];
          return [{ resourceType: Number(reward[0]), amount: divideByPrecision(Number(reward[1])) }];
        })
      : [];

    return {
      entityId,
      battleData: {
        attackerId: current.attacker_id,
        defenderId: current.defender_id,
        attackerOwner: current.attacker_owner,
        defenderOwner: current.defender_owner,
        winnerId: current.winner_id,
        maxReward,
        timestamp: Number(current.timestamp),
      },
    };
  }

  private parseExplorerRewardEvent(current: any): ExplorerRewardSystemUpdate | undefined {
    const explorerId = this.toNumber(current?.explorer_id);
    if (explorerId === null) return;

    const rawAmount = current?.reward_resource_amount ?? null;
    const normalizedAmount = this.toNumber(rawAmount);
    return {
      explorerId,
      explorerStructureId: this.toNumber(current?.explorer_structure_id) ?? 0,
      explorerOwnerAddress: this.toContractAddress(current?.explorer_owner_address),
      resourceId: (this.toNumber(current?.reward_resource_id) ?? 0) as ResourcesIds | 0,
      amount: normalizedAmount === null ? 0 : divideByPrecision(normalizedAmount),
      rawAmount,
      timestamp: this.toNumber(current?.timestamp) ?? 0,
    };
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "bigint") return Number(value);
    if (typeof value !== "string" || value.length === 0) return null;

    try {
      const parsed = value.startsWith("0x") ? Number(BigInt(value)) : Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private toContractAddress(value: unknown): ContractAddress | null {
    if (value === undefined || value === null || value === "" || value === "0" || value === "0x0") return null;
    try {
      const address = typeof value === "number" ? BigInt(Math.trunc(value)) : BigInt(value as bigint | string);
      return address === 0n ? null : address;
    } catch {
      return null;
    }
  }
}
