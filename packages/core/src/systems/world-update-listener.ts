import { type SetupResult } from "@bibliothecadao/dojo";
import { SqlApi } from "@bibliothecadao/torii";
import {
  BANDITS_NAME,
  BiomeIdToType,
  BiomeType,
  BuildingType,
  ContractAddress,
  GuardSlot,
  type HexPosition,
  type ID,
  ResourcesIds,
  StructureType,
  TileOccupier,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";
import {
  type Component,
  defineComponentSystem,
  defineQuery,
  type Entity,
  getComponentValue,
  HasValue,
  isComponentUpdate,
} from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { StaminaManager } from "../managers";
import { ActiveProduction, GuardArmy, MapDataStore, TROOP_TIERS } from "../stores/map-data-store";
import { divideByPrecision, getIsBlitz, getStructureTypeName, tileOptToTile, unpackBuildingCounts } from "../utils";
import { MAP_DATA_REFRESH_INTERVAL } from "../utils/constants";
import { getStructureName } from "../utils/entities";
import { getBlockTimestamp } from "../utils/timestamp";
import { DataEnhancer } from "./data-enhancer";
import { recordArmyMovementLatencyPhase } from "./army-movement-latency-trace";
import { resolveFreshestArmyStaminaSource } from "./army-stamina-source";
import {
  type BattleEventSystemUpdate,
  type BuildingSystemUpdate,
  ExplorerRewardSystemUpdate,
  ExplorerTroopsSystemUpdate,
  type ExplorerTroopsTileBatchSystemUpdate,
  type ExplorerTroopsTileSystemUpdate,
  StructureSystemUpdate,
  type StructureTileSystemUpdate,
  type TileSystemUpdate,
} from "./types";
import { getExplorerInfoFromTileOccupier, getStructureInfoFromTileOccupier } from "./utils";

const ARMY_TILE_BATCH_SETTLE_MS = 32;

interface PendingArmyTileLiveSignal {
  kind: "live";
  entityId: ID;
  hexCoords: HexPosition;
  troopType: TroopType;
  troopTier: TroopTier;
  isDaydreamsAgent: boolean;
}

interface PendingArmyTileRemovedSignal {
  kind: "removed";
  entityId: ID;
  hexCoords: HexPosition;
  troopType: TroopType;
  troopTier: TroopTier;
  isDaydreamsAgent: boolean;
}

type PendingArmyTileSignal = PendingArmyTileLiveSignal | PendingArmyTileRemovedSignal;

interface PendingArmyTileBatchEntry {
  entityId: ID;
  latestLiveSignal?: PendingArmyTileLiveSignal;
  latestRemovedSignal?: PendingArmyTileRemovedSignal;
}

function queuePendingArmyTileBatchSignal(
  pendingEntries: Map<ID, PendingArmyTileBatchEntry>,
  signal: PendingArmyTileSignal,
): void {
  const entry = pendingEntries.get(signal.entityId) ?? { entityId: signal.entityId };

  if (signal.kind === "live") {
    entry.latestLiveSignal = signal;
  } else {
    entry.latestRemovedSignal = signal;
  }

  pendingEntries.set(signal.entityId, entry);
}

// The WorldUpdateListener class is responsible for updating the Three.js models when there are changes in the game state.
// It listens for updates from torii and translates them into a format that can be consumed by the Three.js model managers.
export class WorldUpdateListener {
  private mapDataStore: MapDataStore;
  private dataEnhancer: DataEnhancer;
  private updateSequenceMap: Map<ID, number> = new Map(); // Track update sequence numbers
  private pendingUpdates: Map<ID, Promise<any>> = new Map(); // Track pending async updates

  constructor(
    private setup: SetupResult,
    sqlApi: SqlApi,
  ) {
    // Initialize MapDataStore with centralized refresh interval
    this.mapDataStore = MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL, sqlApi);

    // Initialize DataEnhancer to handle all data fetching
    this.dataEnhancer = new DataEnhancer(this.mapDataStore);

    // Start initial data fetch
    this.mapDataStore.refresh().catch((error) => {
      console.warn("Initial MapDataStore refresh failed:", error);
    });
  }

  private resolveEntityId(
    entityId: ID | undefined,
    updateEntity: Entity,
    getComponentEntityId: () => ID | undefined,
  ): ID | undefined {
    if (entityId) {
      return entityId;
    }

    // console.log(`[WorldUpdateListener] entityId not in currentState, checking component:`, updateEntity);

    const componentEntityId = getComponentEntityId();

    if (componentEntityId) {
      return componentEntityId;
    }

    // console.log(`[WorldUpdateListener] entityId not in component, checking mapDataStore:`, updateEntity);
    const mapStoreEntityId = this.mapDataStore.getEntityIdFromEntity(String(updateEntity));

    if (!mapStoreEntityId) {
      this.logMissingEntityId("resolveEntityId", {
        updateEntity,
      });
    }

    return mapStoreEntityId;
  }

  private logMissingEntityId(context: string, details: unknown) {
    // const border = "❗".repeat(40);
    // console.error(
    //   `\n${border}\n🚨❗️ CRITICAL: MISSING ENTITY ID DETECTED (${context}) ❗️🚨\n${border}\n` +
    //     "🚫 This condition should NEVER happen. Investigate immediately! 🚫",
    // );
    // console.error(`🛑 [WorldUpdateListener] Missing entityId context: ${context} 🛑`, details);
    // console.trace(`🔍 [WorldUpdateListener] Missing entityId stack trace (${context})`);
  }

  private resolveLiveArmySnapshot(
    entityId: ID,
    currentArmiesTick: number,
  ):
    | {
        troopCount: number;
        currentStamina: number;
        onChainStamina?: {
          amount: bigint;
          updatedTick: number;
        };
        ownerStructureId?: ID;
      }
    | undefined {
    try {
      const explorerTroops = getComponentValue(
        this.setup.components.ExplorerTroops,
        getEntityIdFromKeys([BigInt(entityId)]),
      );
      if (!explorerTroops?.troops) {
        return undefined;
      }

      const ownerStructureId = explorerTroops.owner && explorerTroops.owner !== 0 ? explorerTroops.owner : undefined;

      return {
        troopCount: divideByPrecision(Number(explorerTroops.troops.count)),
        currentStamina: Number(StaminaManager.getStamina(explorerTroops.troops, currentArmiesTick).amount),
        onChainStamina: {
          amount: BigInt(explorerTroops.troops.stamina.amount),
          updatedTick: Number(explorerTroops.troops.stamina.updated_tick),
        },
        ownerStructureId,
      };
    } catch (error) {
      console.warn(`[DEBUG] Could not get live explorer stamina snapshot for army ${entityId}:`, error);
      return undefined;
    }
  }

  private buildGuardArmies(troopGuards: any): GuardArmy[] {
    if (!troopGuards) {
      return [];
    }

    const guardArmies: GuardArmy[] = [];

    const pushGuard = (slot: number, guard?: any) => {
      if (!guard) return;
      guardArmies.push({
        slot,
        category: guard.category,
        tier: TROOP_TIERS[guard.tier],
        count: divideByPrecision(Number(guard.count ?? 0)),
        stamina: Number(guard.stamina?.amount ?? 0),
      });
    };

    pushGuard(GuardSlot.Delta, troopGuards.delta);
    pushGuard(GuardSlot.Charlie, troopGuards.charlie);
    pushGuard(GuardSlot.Bravo, troopGuards.bravo);
    pushGuard(GuardSlot.Alpha, troopGuards.alpha);

    return guardArmies;
  }

  private getBattleCooldownEnd(troopGuards: any): number {
    if (!troopGuards) {
      return 0;
    }

    return Math.max(
      troopGuards.alpha?.battle_cooldown_end ?? 0,
      troopGuards.bravo?.battle_cooldown_end ?? 0,
      troopGuards.charlie?.battle_cooldown_end ?? 0,
      troopGuards.delta?.battle_cooldown_end ?? 0,
    );
  }

  private shouldResolveOwnerNameFromAddress(
    ownerAddress: bigint | undefined,
    ownerName: string | undefined,
  ): ownerAddress is bigint {
    if (ownerAddress === undefined || ownerAddress === 0n) {
      return false;
    }

    const trimmedOwnerName = ownerName?.trim() ?? "";
    return trimmedOwnerName.length === 0 || trimmedOwnerName === BANDITS_NAME;
  }

  private resolveOwnerNameFromAddress(ownerAddress: bigint | undefined, fallbackOwnerName: string | undefined): string {
    let resolvedOwnerName = fallbackOwnerName?.trim() ?? "";

    if (this.shouldResolveOwnerNameFromAddress(ownerAddress, resolvedOwnerName) && this.setup.components.AddressName) {
      try {
        const addressName = getComponentValue(this.setup.components.AddressName, getEntityIdFromKeys([ownerAddress]));

        if (addressName?.name) {
          resolvedOwnerName = shortString.decodeShortString(addressName.name.toString());
        }
      } catch (error) {
        console.warn(`Failed to decode address name for owner ${ownerAddress}:`, error);
      }
    }

    if ((ownerAddress === undefined || ownerAddress === 0n) && resolvedOwnerName.length === 0) {
      return BANDITS_NAME;
    }

    return resolvedOwnerName;
  }

  private setupSystem<T>(
    component: Component,
    callback: (value: T) => void,
    getUpdate: (update: any) => T | Promise<T | undefined>,
    runOnInit = true,
  ): () => void {
    let active = true;

    const handleUpdate = async (update: any) => {
      if (!active) return;
      const value = await getUpdate(update);
      if (value && active) {
        // Add console log for every update before calling the callback
        // console.log(`[WorldUpdateListener] [${component?.metadata?.name ?? "<unknown>"}] update:`, value);
        callback(value);
      }
    };

    defineComponentSystem(this.setup.network.world, component, handleUpdate, {
      runOnInit,
    });

    return () => {
      active = false;
    };
  }

  private resolvePendingArmyTileSignal(update: any): PendingArmyTileSignal | undefined {
    if (!isComponentUpdate(update, this.setup.components.TileOpt)) {
      return undefined;
    }

    const [currentStateOpt, prevStateOpt] = update.value;
    const currentState = currentStateOpt ? tileOptToTile(currentStateOpt) : undefined;
    const prevState = prevStateOpt ? tileOptToTile(prevStateOpt) : undefined;
    const explorer = currentState && getExplorerInfoFromTileOccupier(currentState.occupier_type);
    const previousExplorer = prevState && getExplorerInfoFromTileOccupier(prevState.occupier_type);

    if (!explorer) {
      return this.resolvePendingRemovedArmyTileSignal({
        currentState,
        prevState,
        previousExplorer,
        update,
      });
    }

    const rawOccupierId = currentState?.occupier_id;
    if (rawOccupierId === undefined || rawOccupierId === null) {
      this.logMissingEntityId("Army.onTileUpdate.current", {
        update,
        currentState,
        prevState,
      });
      return undefined;
    }

    recordArmyMovementLatencyPhase({
      phase: "tileopt_component_received",
      source: "world_update_listener",
      entityId: rawOccupierId,
      details: {
        col: currentState.col,
        row: currentState.row,
      },
    });

    return {
      kind: "live",
      entityId: rawOccupierId,
      hexCoords: { col: currentState.col, row: currentState.row },
      troopType: explorer.troopType as TroopType,
      troopTier: explorer.troopTier as TroopTier,
      isDaydreamsAgent: explorer.isDaydreamsAgent,
    };
  }

  private resolvePendingRemovedArmyTileSignal(input: {
    currentState?: ReturnType<typeof tileOptToTile>;
    prevState?: ReturnType<typeof tileOptToTile>;
    previousExplorer?: ReturnType<typeof getExplorerInfoFromTileOccupier>;
    update: any;
  }): PendingArmyTileRemovedSignal | undefined {
    const { currentState, prevState, previousExplorer, update } = input;
    if (!previousExplorer || !prevState) {
      return undefined;
    }

    try {
      const explorerTroops = getComponentValue(
        this.setup.components.ExplorerTroops,
        getEntityIdFromKeys([BigInt(prevState.occupier_id)]),
      );

      if (explorerTroops && explorerTroops.troops.count > 0n) {
        return undefined;
      }
    } catch (_error) {
      // Fall through and treat the army as removed when the live component snapshot is unavailable.
    }

    const removedEntityId = prevState.occupier_id;
    if (removedEntityId === undefined || removedEntityId === null) {
      this.logMissingEntityId("Army.onTileUpdate.removed", {
        update,
        currentState,
        prevState,
      });
      return undefined;
    }

    const coordsSource = currentState ?? prevState;
    return {
      kind: "removed",
      entityId: removedEntityId,
      hexCoords: { col: coordsSource.col, row: coordsSource.row },
      troopType: previousExplorer.troopType as TroopType,
      troopTier: previousExplorer.troopTier as TroopTier,
      isDaydreamsAgent: previousExplorer.isDaydreamsAgent,
    };
  }

  private buildRemovedArmyTileUpdate(signal: PendingArmyTileRemovedSignal): ExplorerTroopsTileSystemUpdate {
    return {
      entityId: signal.entityId,
      hexCoords: signal.hexCoords,
      troopType: signal.troopType,
      troopTier: signal.troopTier,
      isDaydreamsAgent: signal.isDaydreamsAgent,
      troopCount: 0,
      ownerName: "",
      guildName: "",
      ownerAddress: 0n,
      ownerStructureId: null,
      removed: true,
    };
  }

  private async resolveLiveArmyTileUpdate(
    signal: PendingArmyTileLiveSignal,
  ): Promise<ExplorerTroopsTileSystemUpdate | undefined> {
    const { currentArmiesTick } = getBlockTimestamp();

    const result = await this.processSequentialUpdate(signal.entityId, async () => {
      let structureOwnerId: ID | undefined;
      try {
        const explorerTroops = getComponentValue(
          this.setup.components.ExplorerTroops,
          getEntityIdFromKeys([BigInt(signal.entityId)]),
        );
        structureOwnerId = explorerTroops?.owner;
      } catch (error) {
        console.warn(`[DEBUG] Could not get structure owner for army ${signal.entityId}:`, error);
      }

      const normalizedStructureOwnerId = structureOwnerId && structureOwnerId !== 0 ? structureOwnerId : undefined;
      const enhancedData = await this.dataEnhancer.enhanceArmyData(
        signal.entityId,
        {
          troopType: signal.troopType,
          troopTier: signal.troopTier,
        },
        currentArmiesTick,
        normalizedStructureOwnerId,
      );
      const liveArmySnapshot = this.resolveLiveArmySnapshot(signal.entityId, currentArmiesTick);
      const freshestArmyStaminaSource = resolveFreshestArmyStaminaSource({
        liveSnapshot: liveArmySnapshot,
        enhancedSnapshot: enhancedData,
      });
      const freshestArmyStaminaSnapshot = freshestArmyStaminaSource === "live" ? liveArmySnapshot : enhancedData;
      const maxStamina = StaminaManager.getMaxStamina(signal.troopType, signal.troopTier);

      return {
        entityId: signal.entityId,
        hexCoords: signal.hexCoords,
        ownerAddress: enhancedData.owner.address ? BigInt(enhancedData.owner.address) : 0n,
        ownerName: enhancedData.owner.ownerName || "",
        guildName: enhancedData.owner.guildName || "",
        troopType: signal.troopType,
        troopTier: signal.troopTier,
        isDaydreamsAgent: signal.isDaydreamsAgent,
        ownerStructureId:
          liveArmySnapshot?.ownerStructureId ?? normalizedStructureOwnerId ?? enhancedData.ownerStructureId ?? null,
        troopCount: liveArmySnapshot?.troopCount ?? enhancedData.troopCount,
        currentStamina: freshestArmyStaminaSnapshot?.currentStamina ?? enhancedData.currentStamina,
        onChainStamina: freshestArmyStaminaSnapshot?.onChainStamina ?? enhancedData.onChainStamina,
        battleData: enhancedData.battleData,
        maxStamina,
      };
    });

    if (result) {
      recordArmyMovementLatencyPhase({
        phase: "tileopt_component_ready",
        source: "world_update_listener",
        entityId: signal.entityId,
        details: {
          col: result.hexCoords.col,
          row: result.hexCoords.row,
        },
      });
    }

    return result || undefined;
  }

  private async resolveArmyTileBatchUpdate(
    entries: Iterable<PendingArmyTileBatchEntry>,
  ): Promise<ExplorerTroopsTileBatchSystemUpdate> {
    const liveSignals: PendingArmyTileLiveSignal[] = [];
    const removalUpdates: ExplorerTroopsTileBatchSystemUpdate["removals"] = [];

    for (const entry of entries) {
      if (entry.latestLiveSignal) {
        liveSignals.push(entry.latestLiveSignal);
        continue;
      }

      if (entry.latestRemovedSignal) {
        removalUpdates.push({
          entityId: entry.latestRemovedSignal.entityId,
          update: this.buildRemovedArmyTileUpdate(entry.latestRemovedSignal),
        });
      }
    }

    const liveUpdates = (await Promise.all(liveSignals.map((signal) => this.resolveLiveArmyTileUpdate(signal))))
      .filter((update): update is ExplorerTroopsTileSystemUpdate => update !== undefined)
      .map((update) => ({
        entityId: update.entityId,
        update,
      }));

    liveUpdates.sort((left, right) => Number(left.entityId) - Number(right.entityId));
    removalUpdates.sort((left, right) => Number(left.entityId) - Number(right.entityId));

    return {
      liveUpdates,
      removals: removalUpdates,
      hasWork: liveUpdates.length > 0 || removalUpdates.length > 0,
    };
  }

  public get Army() {
    return {
      onTileUpdate: (callback: (value: ExplorerTroopsTileSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.TileOpt,
          callback,
          async (update: any): Promise<ExplorerTroopsTileSystemUpdate | undefined> => {
            const signal = this.resolvePendingArmyTileSignal(update);
            if (!signal) {
              return undefined;
            }

            if (signal.kind === "removed") {
              return this.buildRemovedArmyTileUpdate(signal);
            }

            return this.resolveLiveArmyTileUpdate(signal);
          },
          true,
        );
      },
      onTileBatchUpdate: (
        callback: (value: ExplorerTroopsTileBatchSystemUpdate) => void | Promise<void>,
      ): (() => void) => {
        let active = true;
        let pendingArmyTileBatchFlushTimeout: ReturnType<typeof setTimeout> | null = null;
        let isArmyTileBatchFlushing = false;
        const pendingArmyTileBatchByEntity: Map<ID, PendingArmyTileBatchEntry> = new Map();

        const flushPendingArmyTileBatch = async () => {
          if (isArmyTileBatchFlushing || !active) {
            return;
          }

          isArmyTileBatchFlushing = true;
          try {
            while (pendingArmyTileBatchByEntity.size > 0 && active) {
              const pendingEntries = Array.from(pendingArmyTileBatchByEntity.values());
              pendingArmyTileBatchByEntity.clear();

              const batch = await this.resolveArmyTileBatchUpdate(pendingEntries);
              if (!batch.hasWork || !active) {
                continue;
              }

              await callback(batch);
            }
          } finally {
            isArmyTileBatchFlushing = false;
          }
        };

        const schedulePendingArmyTileBatchFlush = () => {
          if (pendingArmyTileBatchFlushTimeout) {
            clearTimeout(pendingArmyTileBatchFlushTimeout);
          }

          pendingArmyTileBatchFlushTimeout = setTimeout(() => {
            pendingArmyTileBatchFlushTimeout = null;
            void flushPendingArmyTileBatch();
          }, ARMY_TILE_BATCH_SETTLE_MS);
        };

        defineComponentSystem(
          this.setup.network.world,
          this.setup.components.TileOpt,
          (update: any) => {
            if (!active) {
              return;
            }

            const signal = this.resolvePendingArmyTileSignal(update);
            if (!signal) {
              return;
            }

            queuePendingArmyTileBatchSignal(pendingArmyTileBatchByEntity, signal);
            schedulePendingArmyTileBatchFlush();
          },
          {
            runOnInit: true,
          },
        );

        return () => {
          active = false;
          if (pendingArmyTileBatchFlushTimeout) {
            clearTimeout(pendingArmyTileBatchFlushTimeout);
          }
          pendingArmyTileBatchByEntity.clear();
        };
      },
      onExplorerTroopsUpdate: (callback: (value: ExplorerTroopsSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.ExplorerTroops,
          callback,
          async (update: any): Promise<ExplorerTroopsSystemUpdate | undefined> => {
            if (isComponentUpdate(update, this.setup.components.ExplorerTroops)) {
              const [currentState, _prevState] = update.value;

              if (!currentState) return;

              // maybe don't use mapdatastore here since these are all available from the tile listener
              const owner = await this.dataEnhancer.getStructureOwner(currentState.owner);
              const normalizedOwnerStructureId =
                currentState.owner && currentState.owner !== 0 ? currentState.owner : null;

              const entityId = this.resolveEntityId(currentState.explorer_id as ID | undefined, update.entity, () => {
                const componentState = getComponentValue(this.setup.components.ExplorerTroops, update.entity) as
                  | { explorer_id?: ID }
                  | undefined;
                return componentState?.explorer_id;
              });

              if (!entityId) {
                this.logMissingEntityId("onExplorerTroopsUpdate", { update });
                return;
              }

              return {
                entityId,
                troopCount: divideByPrecision(Number(currentState.troops.count)),
                onChainStamina: {
                  amount: BigInt(currentState.troops.stamina.amount),
                  updatedTick: Number(currentState.troops.stamina.updated_tick),
                },
                ownerStructureId: normalizedOwnerStructureId,
                hexCoords: { col: currentState.coord.x, row: currentState.coord.y },
                ownerAddress: owner?.address || 0n,
                ownerName: owner?.ownerName || "",
                battleCooldownEnd: currentState.troops.battle_cooldown_end,
              };
            }
          },
          true,
        );
      },
      onDeadArmy: (callback: (value: ID) => void) => {
        // console.debug(`[WorldUpdateListener] Subscribing to dead army updates`);
        this.setupSystem(
          this.setup.components.ExplorerTroops,
          callback,
          async (update: any): Promise<ID | undefined> => {
            if (isComponentUpdate(update, this.setup.components.ExplorerTroops)) {
              const [currentState, prevState] = update.value;
              // console.debug(`[WorldUpdateListener] ExplorerTroops component update received`, {
              //   entity: update.entity,
              //   hasCurrentState: currentState !== undefined,
              //   hasPrevState: prevState !== undefined,
              // });
              const explorer = getComponentValue(this.setup.components.ExplorerTroops, update.entity);
              if (!explorer && !prevState) return;
              if (!explorer && undefined === currentState && prevState) {
                const deadArmyEntityId = prevState?.explorer_id;

                if (deadArmyEntityId === undefined || deadArmyEntityId === null) {
                  this.logMissingEntityId("Army.onDeadArmy", { update, prevState });
                  return;
                }

                // console.debug(`[WorldUpdateListener] ExplorerTroops removed for entity ${deadArmyEntityId}`);
                return deadArmyEntityId;
              }
            }
          },
          false,
        );
      },
    };
  }

  public get Structure() {
    return {
      onTileUpdate: (callback: (value: StructureTileSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.TileOpt,
          callback,
          async (update: any) => {
            if (isComponentUpdate(update, this.setup.components.TileOpt)) {
              const [currentStateOpt, _prevStateOpt] = update.value;
              const currentState = currentStateOpt ? tileOptToTile(currentStateOpt) : undefined;
              // const _prevState = _prevStateOpt ? tileOptToTile(_prevStateOpt) : undefined;

              const structureInfo = currentState && getStructureInfoFromTileOccupier(currentState?.occupier_type);

              if (!structureInfo) return;

              const hyperstructure = getComponentValue(
                this.setup.components.Hyperstructure,
                getEntityIdFromKeys([BigInt(currentState.occupier_id)]),
              );

              const initialized = hyperstructure?.initialized || false;

              const rawOccupierId = currentState?.occupier_id;

              if (rawOccupierId === undefined || rawOccupierId === null) {
                this.logMissingEntityId("Structure.onTileUpdate", {
                  update,
                  currentState,
                  structureInfo,
                });
                return;
              }

              let hyperstructureRealmCount: number | undefined;

              if (structureInfo.type === StructureType.Hyperstructure) {
                hyperstructureRealmCount = this.dataEnhancer.getHyperstructureRealmCount(rawOccupierId);
              }

              // Use sequential update processing to prevent race conditions
              const result = await this.processSequentialUpdate(rawOccupierId, async () => {
                // Use DataEnhancer to fetch all enhanced data
                const enhancedData = await this.dataEnhancer.enhanceStructureData(rawOccupierId);

                const structureComponent = getComponentValue(
                  this.setup.components.Structure,
                  getEntityIdFromKeys([BigInt(rawOccupierId)]),
                );
                const troopGuards = structureComponent?.troop_guards ?? null;
                const guardArmies = troopGuards ? this.buildGuardArmies(troopGuards) : enhancedData.guardArmies;
                const battleCooldownEnd = troopGuards
                  ? this.getBattleCooldownEnd(troopGuards)
                  : enhancedData.battleData?.battleCooldownEnd;

                if (troopGuards) {
                  this.mapDataStore.updateStructureGuards(rawOccupierId, guardArmies, battleCooldownEnd);
                }

                const ownerAddress = structureComponent?.owner ?? enhancedData.owner.address ?? 0n;
                const ownerName = this.resolveOwnerNameFromAddress(ownerAddress, enhancedData.owner.ownerName);

                this.dataEnhancer.updateStructureOwner(rawOccupierId, ownerAddress, ownerName);

                const isBlitz = getIsBlitz();
                const fallbackTypeName = getStructureTypeName(structureInfo.type, isBlitz) || "Structure";
                const enhancedStructureName = enhancedData.structureName?.trim();
                const structureName = structureComponent
                  ? getStructureName(structureComponent, isBlitz).name
                  : enhancedStructureName || `${fallbackTypeName} ${rawOccupierId}`;

                const battleData = enhancedData.battleData
                  ? {
                      ...enhancedData.battleData,
                      battleCooldownEnd: battleCooldownEnd ?? enhancedData.battleData.battleCooldownEnd,
                    }
                  : undefined;

                return {
                  entityId: rawOccupierId,
                  structureName,
                  hexCoords: {
                    col: currentState.col,
                    row: currentState.row,
                  },
                  structureType: structureInfo.type,
                  initialized,
                  stage: structureInfo.stage,
                  level: structureInfo.level,
                  owner: {
                    address: ownerAddress,
                    ownerName,
                    guildName: enhancedData.owner.guildName,
                  },
                  hasWonder: structureInfo.hasWonder,
                  isAlly: false,
                  // Enhanced data from DataEnhancer
                  guardArmies,
                  activeProductions: enhancedData.activeProductions,
                  hyperstructureRealmCount,
                  battleData,
                };
              });

              // Return undefined if update was cancelled due to being outdated
              return result || undefined;
            }
          },
          false,
        );
      },
      onStructureUpdate: (callback: (value: StructureSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.Structure,
          callback,
          async (update: any): Promise<StructureSystemUpdate | undefined> => {
            // console.log("[onStructureUpdate] raw update:", update);

            if (isComponentUpdate(update, this.setup.components.Structure)) {
              const [currentState, _prevState] = update.value;

              if (!currentState) return;

              // Extract guard armies data from the structure (guard object may be undefined on fresh structures)
              const troopGuards = currentState.troop_guards ?? null;
              const guardArmies = this.buildGuardArmies(troopGuards);

              // Use DataEnhancer to fetch player name
              const ownerValue = currentState.owner ?? 0n;
              const ownerString =
                typeof ownerValue === "bigint" || typeof ownerValue === "number" || typeof ownerValue === "string"
                  ? ownerValue.toString()
                  : (ownerValue ?? "0");

              const entityId = this.resolveEntityId(currentState.entity_id as ID | undefined, update.entity, () => {
                const componentState = getComponentValue(this.setup.components.Structure, update.entity) as
                  | { entity_id?: ID }
                  | undefined;
                return componentState?.entity_id;
              });

              if (!entityId) {
                this.logMissingEntityId("onStructureUpdate", { update });
                return;
              }

              return (
                (await this.processSequentialUpdate(entityId, async () => {
                  const playerName = this.resolveOwnerNameFromAddress(
                    ownerValue,
                    await this.dataEnhancer.getPlayerName(ownerString),
                  );

                  this.dataEnhancer.updateStructureOwner(entityId, ownerValue, playerName);

                  const baseCoords = currentState.base ?? { coord_x: 0, coord_y: 0 };
                  let col = baseCoords.coord_x ?? 0;
                  let row = baseCoords.coord_y ?? 0;

                  // Fall back to mapDataStore if coords are 0,0 (partial update, e.g. ownership change)
                  if (col === 0 && row === 0) {
                    const existing = this.mapDataStore.getStructureById(entityId);
                    if (existing) {
                      col = existing.coordX;
                      row = existing.coordY;
                    }
                  }

                  const battleCooldownEnd = this.getBattleCooldownEnd(troopGuards);

                  this.mapDataStore.updateStructureGuards(entityId, guardArmies, battleCooldownEnd);

                  const structureSystemUpdate: StructureSystemUpdate = {
                    entityId,
                    guardArmies,
                    owner: {
                      address: currentState.owner,
                      ownerName: playerName,
                      guildName: "",
                    },
                    hexCoords: { col, row },
                    battleCooldownEnd,
                  };

                  return structureSystemUpdate;
                })) ?? undefined
              );
            }
          },
          false,
        );
      },
      onStructureBuildingsUpdate: (callback: (value: any) => void) => {
        this.setupSystem(
          this.setup.components.StructureBuildings,
          callback,
          (update: any) => {
            if (isComponentUpdate(update, this.setup.components.StructureBuildings)) {
              const [currentState, _prevState] = update.value;

              if (!currentState) {
                return;
              }

              const entityId = currentState?.entity_id;

              if (entityId === undefined || entityId === null) {
                this.logMissingEntityId("Structure.onStructureBuildingsUpdate", {
                  update,
                  currentState,
                });
                return;
              }

              // Convert hex strings to bigints
              const packedValues: bigint[] = [
                currentState.packed_counts_1 ? BigInt(currentState.packed_counts_1) : 0n,
                currentState.packed_counts_2 ? BigInt(currentState.packed_counts_2) : 0n,
                currentState.packed_counts_3 ? BigInt(currentState.packed_counts_3) : 0n,
              ];

              // Unpack the building counts
              const buildingCounts = unpackBuildingCounts(packedValues);

              const activeProductions: ActiveProduction[] = [];

              // Iterate through all building types and create productions for non-zero counts
              for (let buildingType = 1; buildingType <= buildingCounts.length; buildingType++) {
                const count = buildingCounts[buildingType - 1]; // buildingCounts is 0-indexed, buildingType is 1-indexed
                if (count > 0) {
                  const prod = {
                    buildingCount: count,
                    buildingType: buildingType as BuildingType,
                  };
                  activeProductions.push(prod);
                }
              }

              this.mapDataStore.updateStructureBuildings(entityId, activeProductions);

              return {
                entityId,
                activeProductions,
              };
            }
          },
          false,
        );
      },
    };
  }

  public get Tile() {
    return {
      onTileUpdate: (callback: (value: TileSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.TileOpt,
          callback,
          async (update: any) => {
            const newStateOpt = update.value[0];
            const prevStateOpt = update.value[1];
            const newState = tileOptToTile(newStateOpt);
            const prevState = tileOptToTile(prevStateOpt);

            const newStateBiomeType = BiomeIdToType[newState?.biome];
            const { col, row } = prevState || newState;
            const result = {
              hexCoords: { col, row },
              removeExplored: !newState,
              biome:
                newStateBiomeType === BiomeType.None ? BiomeType.Grassland : newStateBiomeType || BiomeType.Grassland,
            };

            // Log the update value
            // console.log("[onTileUpdate] TileSystemUpdate:", result);
            return result;
          },
          false,
        );
      },
    };
  }

  public get Buildings() {
    return {
      onBuildingUpdate: (hexCoords: HexPosition, callback: (value: BuildingSystemUpdate) => void): (() => void) => {
        return this.setupSystem(
          this.setup.components.Building,
          callback,
          async (update: any) => {
            if (isComponentUpdate(update, this.setup.components.Building)) {
              const [currentState, prevState] = update.value;

              // Handle deletion - current state is null/undefined but we have previous state
              if (!currentState && prevState) {
                if (prevState.outer_col !== hexCoords.col || prevState.outer_row !== hexCoords.row) {
                  return;
                }

                const result = {
                  buildingType: BuildingType.None,
                  innerCol: prevState.inner_col,
                  innerRow: prevState.inner_row,
                  paused: false,
                };

                return result;
              }

              // Handle building set to None category (another way deletion can happen)
              if (currentState && currentState.category === BuildingType.None) {
                if (currentState.outer_col !== hexCoords.col || currentState.outer_row !== hexCoords.row) return;

                const result = {
                  buildingType: BuildingType.None,
                  innerCol: currentState.inner_col,
                  innerRow: currentState.inner_row,
                  paused: false,
                };

                return result;
              }

              // Normal update case
              if (!currentState) {
                return;
              }

              if (currentState.outer_col !== hexCoords.col || currentState.outer_row !== hexCoords.row) {
                return;
              }

              const result = {
                buildingType: currentState.category,
                innerCol: currentState.inner_col,
                innerRow: currentState.inner_row,
                paused: currentState.paused,
              };

              return result;
            }
          },
          false,
        );
      },
    };
  }

  public get Quest() {
    return {
      onTileUpdate: (callback: (value: any) => void) => {
        this.setupSystem(
          this.setup.components.TileOpt,
          callback,
          (update: any) => {
            if (isComponentUpdate(update, this.setup.components.TileOpt)) {
              const [currentStateOpt, _prevStateOpt] = update.value;
              const currentState = currentStateOpt ? tileOptToTile(currentStateOpt) : undefined;
              // const _prevState = _prevStateOpt ? tileOptToTile(_prevStateOpt) : undefined;

              if (!currentState) return;

              const quest = currentState.occupier_type === TileOccupier.Quest;

              if (!quest) return;

              const questEntityId = update?.entity;

              if (questEntityId === undefined || questEntityId === null) {
                this.logMissingEntityId("Quest.onTileUpdate", { update, currentState });
                return;
              }

              const val = {
                entityId: questEntityId,
                occupierId: currentState?.occupier_id,
                hexCoords: { col: currentState.col, row: currentState.row },
              };
              return val;
            }
          },
          false,
        );
      },
    };
  }

  public get ExplorerReward() {
    return {
      onExplorerRewardEventUpdate: (callback: (value: ExplorerRewardSystemUpdate) => void) => {
        if (!this.setup.components.events?.ExplorerRewardEvent) {
          console.warn("ExplorerRewardEvent component is not registered on setup.components.events");
          return;
        }

        this.setupSystem(
          this.setup.components.events.ExplorerRewardEvent,
          callback,
          async (update: any): Promise<ExplorerRewardSystemUpdate | undefined> => {
            if (isComponentUpdate(update, this.setup.components.events.ExplorerRewardEvent)) {
              const [currentState] = update.value;
              if (!currentState) return undefined;

              return this.parseExplorerRewardEvent(currentState);
            }
          },
          false,
        );
      },
    };
  }

  public get Chest() {
    return {
      onTileUpdate: (callback: (value: any) => void) => {
        this.setupSystem(
          this.setup.components.TileOpt,
          callback,
          (update: any) => {
            if (isComponentUpdate(update, this.setup.components.TileOpt)) {
              const [currentStateOpt, _prevStateOpt] = update.value;
              const currentState = currentStateOpt ? tileOptToTile(currentStateOpt) : undefined;
              // const _prevState = _prevStateOpt ? tileOptToTile(_prevStateOpt) : undefined;

              if (!currentState) return;

              const chest = currentState.occupier_type === TileOccupier.Chest;

              if (!chest) return;

              const chestEntityId = update?.entity;

              if (chestEntityId === undefined || chestEntityId === null) {
                this.logMissingEntityId("Chest.onTileUpdate", { update, currentState });
                return;
              }

              const result = {
                entityId: chestEntityId,
                occupierId: currentState?.occupier_id,
                hexCoords: { col: currentState.col, row: currentState.row },
              };
              return result;
            }
          },
          false,
        );
      },
      onDeadChest: (callback: (value: ID) => void) => {
        this.setupSystem(
          this.setup.components.TileOpt,
          callback,
          async (update: any): Promise<ID | undefined> => {
            if (isComponentUpdate(update, this.setup.components.TileOpt)) {
              const [currentStateOpt, prevStateOpt] = update.value;
              const currentState = currentStateOpt ? tileOptToTile(currentStateOpt) : undefined;
              const prevState = prevStateOpt ? tileOptToTile(prevStateOpt) : undefined;

              // Check if the previous state was a chest and current state is not
              if (
                prevState &&
                prevState.occupier_type === TileOccupier.Chest &&
                (!currentState || currentState.occupier_type !== TileOccupier.Chest)
              ) {
                const deadChestEntityId = prevState?.occupier_id;

                if (deadChestEntityId === undefined || deadChestEntityId === null) {
                  this.logMissingEntityId("Chest.onDeadChest", { update, currentState, prevState });
                  return;
                }

                return deadChestEntityId;
              }
            }
          },
          false,
        );
      },
    };
  }

  public get StructureEntityListener() {
    return {
      onLevelUpdate: (entityId: ID, callback: (update: { entityId: ID; level: number }) => any) => {
        // Create a query for the Structure component
        const query = defineQuery([HasValue(this.setup.components.Structure, { entity_id: entityId })], {
          runOnInit: false,
        });

        // Subscribe to the query updates
        const subscription = query.update$.subscribe((update) => {
          if (isComponentUpdate(update, this.setup.components.Structure)) {
            const [currentState, _prevState] = update.value;
            if (!currentState) return;
            const val = {
              entityId,
              level: currentState.base.level,
            };
            callback(val);
          }
        });

        // Return the subscription so it can be cleaned up later
        return subscription as any;
      },
    };
  }

  public get BattleEvent() {
    return {
      onBattleUpdate: (callback: (value: BattleEventSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.events.BattleEvent,
          callback,
          async (update: any): Promise<BattleEventSystemUpdate | undefined> => {
            if (isComponentUpdate(update, this.setup.components.events.BattleEvent)) {
              const [currentState, _prevState] = update.value;

              if (!currentState) {
                return;
              }

              // Parse max_reward from the event
              const maxReward: Array<{ resourceType: number; amount: number }> = [];
              if (currentState.max_reward && Array.isArray(currentState.max_reward)) {
                for (const reward of currentState.max_reward) {
                  if (Array.isArray(reward) && reward.length === 2) {
                    maxReward.push({
                      resourceType: Number(reward[0]),
                      amount: divideByPrecision(Number(reward[1])),
                    });
                  }
                }
              }

              // Determine the entityId based on winner
              // If attacker won, use attacker_id; if defender won, use defender_id
              const entityId =
                currentState.winner_id === currentState.attacker_owner
                  ? currentState.attacker_id
                  : currentState.defender_id;

              if (entityId === undefined || entityId === null) {
                this.logMissingEntityId("BattleEvent.onBattleUpdate", { update, currentState });
                return;
              }

              const result = {
                entityId,
                battleData: {
                  attackerId: currentState.attacker_id,
                  defenderId: currentState.defender_id,
                  attackerOwner: currentState.attacker_owner,
                  defenderOwner: currentState.defender_owner,
                  winnerId: currentState.winner_id,
                  maxReward,
                  timestamp: currentState.timestamp,
                },
              };

              return result;
            }
          },
          false,
        );
      },
    };
  }

  private parseExplorerRewardEvent(currentState: any): ExplorerRewardSystemUpdate | undefined {
    const explorerId = this.toNumber(currentState?.explorer_id);
    if (explorerId === null) {
      return undefined;
    }

    const explorerStructureId = this.toNumber(currentState?.explorer_structure_id) ?? 0;
    const ownerAddress = this.toContractAddress(currentState?.explorer_owner_address);
    const resourceId = (this.toNumber(currentState?.reward_resource_id) ?? 0) as ResourcesIds | 0;
    const rawAmount = currentState?.reward_resource_amount ?? null;
    const normalizedAmount = this.toNumber(rawAmount);
    const amount = normalizedAmount !== null ? divideByPrecision(normalizedAmount) : 0;
    const timestamp = this.toNumber(currentState?.timestamp) ?? 0;

    const val = {
      explorerId,
      explorerStructureId,
      explorerOwnerAddress: ownerAddress,
      resourceId,
      amount,
      rawAmount,
      timestamp,
    };
    // console.log("[parseExplorerRewardEvent] update:", val);
    return val;
  }

  private toNumber(value: unknown): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === "bigint") {
      const asNumber = Number(value);
      return Number.isFinite(asNumber) ? asNumber : null;
    }

    if (typeof value === "string") {
      if (value.startsWith("0x")) {
        try {
          return Number(BigInt(value));
        } catch (error) {
          return null;
        }
      }
      const parsed = Number(value);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  private toContractAddress(value: unknown): ContractAddress | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === "bigint") {
      return value;
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value) || value === 0) {
        return null;
      }
      try {
        return BigInt(Math.trunc(value));
      } catch (error) {
        return null;
      }
    }

    if (typeof value === "string") {
      if (value === "0x0" || value === "0" || value.trim() === "") {
        return null;
      }
      try {
        return BigInt(value);
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  private normalizeSchemaValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeSchemaValue(item));
    }

    if (typeof value === "object") {
      const record = value as Record<string, unknown>;

      if (record.__kind && record.value !== undefined) {
        return {
          __kind: record.__kind,
          value: this.normalizeSchemaValue(record.value),
        };
      }

      if (record.values && Array.isArray(record.values)) {
        return record.values.map((item) => this.normalizeSchemaValue(item));
      }

      const normalizedEntries: Record<string, unknown> = {};
      for (const [key, entryValue] of Object.entries(record)) {
        normalizedEntries[key] = this.normalizeSchemaValue(entryValue);
      }
      return normalizedEntries;
    }

    return value;
  }

  /**
   * Ensures async updates are processed in the correct order
   * Prevents race conditions where newer updates get overwritten by older ones
   */
  private async processSequentialUpdate<T>(entityId: ID, updateFunction: () => Promise<T>): Promise<T | null> {
    // Generate a sequence number for this update
    const currentSequence = (this.updateSequenceMap.get(entityId) || 0) + 1;
    this.updateSequenceMap.set(entityId, currentSequence);

    // Wait for any pending update for this entity to complete first
    if (this.pendingUpdates.has(entityId)) {
      try {
        await this.pendingUpdates.get(entityId);
      } catch (error) {
        console.warn(`Previous update for entity ${entityId} failed:`, error);
      }
    }

    // Create and execute the update promise
    const updatePromise = (async () => {
      try {
        // Check if this update is still the latest before processing
        if (this.updateSequenceMap.get(entityId) !== currentSequence) {
          return null;
        }

        const result = await updateFunction();

        // Double-check sequence number before returning result
        if (this.updateSequenceMap.get(entityId) !== currentSequence) {
          return null;
        }

        // Add a log for every sequential update before returning result
        if (result !== null && result !== undefined) {
          // console.log(`[processSequentialUpdate] update:`, result);
        }

        return result;
      } catch (error) {
        console.error(`Sequential update failed for entity ${entityId}:`, error);
        throw error;
      }
    })();

    // Track this update as pending
    this.pendingUpdates.set(entityId, updatePromise);

    // Clean up when the promise completes
    updatePromise.finally(() => {
      // Only clean up if this is still the current promise for this entity
      if (this.pendingUpdates.get(entityId) === updatePromise) {
        this.pendingUpdates.delete(entityId);
      }
    });

    return updatePromise;
  }

  /**
   * Clean up resources and stop timers
   */
  public destroy(): void {
    // Clear any pending updates
    this.pendingUpdates.clear();
    this.updateSequenceMap.clear();

    this.mapDataStore.destroy();
  }
}
