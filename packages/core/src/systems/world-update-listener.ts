import { type SetupResult } from "@bibliothecadao/dojo";
import { SqlApi } from "@bibliothecadao/torii";
import {
  BiomeIdToType,
  BiomeType,
  BuildingType,
  type HexPosition,
  type ID,
  StructureType,
  TileOccupier,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";
import {
  type Component,
  defineComponentSystem,
  defineQuery,
  getComponentValue,
  HasValue,
  isComponentUpdate,
} from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { StaminaManager } from "../managers";
import { ActiveProduction, GuardArmy, MapDataStore, TROOP_TIERS } from "../stores/map-data-store";
import {
  divideByPrecision,
  getArmyRelicEffects,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  unpackBuildingCounts,
} from "../utils";
import { MAP_DATA_REFRESH_INTERVAL } from "../utils/constants";
import { getBlockTimestamp } from "../utils/timestamp";
import { DataEnhancer } from "./data-enhancer";
import {
  type BattleEventSystemUpdate,
  type BuildingSystemUpdate,
  ExplorerMoveSystemUpdate,
  ExplorerTroopsSystemUpdate,
  type ExplorerTroopsTileSystemUpdate,
  type RelicEffectSystemUpdate,
  StructureSystemUpdate,
  type StructureTileSystemUpdate,
  type TileSystemUpdate,
} from "./types";
import { getExplorerInfoFromTileOccupier, getStructureInfoFromTileOccupier, getStructureStage } from "./utils";

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

  private setupSystem<T>(
    component: Component,
    callback: (value: T) => void,
    getUpdate: (update: any) => T | Promise<T | undefined>,
    runOnInit = true,
  ) {
    const handleUpdate = async (update: any) => {
      const value = await getUpdate(update);
      if (value) {
        callback(value);
      }
    };

    defineComponentSystem(this.setup.network.world, component, handleUpdate, {
      runOnInit,
    });
  }

  public get Army() {
    return {
      onTileUpdate: (callback: (value: ExplorerTroopsTileSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.Tile,
          callback,
          async (update: any): Promise<ExplorerTroopsTileSystemUpdate | undefined> => {
            if (isComponentUpdate(update, this.setup.components.Tile)) {
              const [currentState, _prevState] = update.value;

              const explorer = currentState && getExplorerInfoFromTileOccupier(currentState?.occupier_type);

              if (!explorer) return;

              const { currentArmiesTick } = getBlockTimestamp();

              // Use sequential update processing to prevent race conditions
              const result = await this.processSequentialUpdate(currentState.occupier_id, async () => {
                // Try to get the structure owner ID from ExplorerTroops component
                let structureOwnerId: ID | undefined;
                try {
                  const explorerTroops = getComponentValue(
                    this.setup.components.ExplorerTroops,
                    getEntityIdFromKeys([BigInt(currentState.occupier_id)]),
                  );
                  structureOwnerId = explorerTroops?.owner;
                } catch (error) {
                  console.warn(`[DEBUG] Could not get structure owner for army ${currentState.occupier_id}:`, error);
                }

                // Use DataEnhancer to fetch all enhanced data
                const enhancedData = await this.dataEnhancer.enhanceArmyData(
                  currentState.occupier_id,
                  explorer,
                  currentArmiesTick,
                  structureOwnerId,
                );

                const maxStamina = StaminaManager.getMaxStamina(explorer.troopType, explorer.troopTier);

                return {
                  entityId: currentState.occupier_id,
                  hexCoords: { col: currentState.col, row: currentState.row },
                  // need to set it to 0n if no owner address because else it won't be registered on the worldmap
                  ownerAddress: enhancedData?.owner.address ? BigInt(enhancedData.owner.address) : 0n,
                  ownerName: enhancedData?.owner.ownerName || "",
                  guildName: enhancedData?.owner.guildName || "",
                  troopType: explorer.troopType as TroopType,
                  troopTier: explorer.troopTier as TroopTier,
                  isDaydreamsAgent: explorer.isDaydreamsAgent,
                  // Enhanced data from DataEnhancer
                  troopCount: enhancedData.troopCount,
                  currentStamina: enhancedData.currentStamina,
                  onChainStamina: enhancedData.onChainStamina,
                  battleData: enhancedData.battleData,
                  maxStamina,
                };
              });

              // Return undefined if update was cancelled due to being outdated
              return result || undefined;
            }
          },
          false,
        );
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

              return {
                entityId: currentState.explorer_id,
                troopCount: divideByPrecision(Number(currentState.troops.count)),
                onChainStamina: {
                  amount: BigInt(currentState.troops.stamina.amount),
                  updatedTick: Number(currentState.troops.stamina.updated_tick),
                },
                hexCoords: { col: currentState.coord.x, row: currentState.coord.y },
                ownerAddress: owner?.address || 0n,
                ownerName: owner?.ownerName || "",
                battleCooldownEnd: currentState.troops.battle_cooldown_end,
              };
            }
          },
          false,
        );
      },
      onDeadArmy: (callback: (value: ID) => void) => {
        this.setupSystem(
          this.setup.components.ExplorerTroops,
          callback,
          async (update: any): Promise<ID | undefined> => {
            if (isComponentUpdate(update, this.setup.components.ExplorerTroops)) {
              const [currentState, prevState] = update.value;
              const explorer = getComponentValue(this.setup.components.ExplorerTroops, update.entity);
              if (!explorer && !prevState) return;
              if (!explorer && undefined === currentState && prevState) {
                return prevState.explorer_id;
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
      onContribution: (callback: (value: { entityId: ID; structureType: StructureType; stage: number }) => void) => {
        this.setupSystem(
          this.setup.components.HyperstructureRequirements,
          callback,
          async (update: any) => {
            const structure = getComponentValue(
              this.setup.components.Structure,
              getEntityIdFromKeys([BigInt(update.value[0].hyperstructure_id)]),
            );

            if (!structure) return;

            const category = structure.base.category as StructureType;

            const stage = getStructureStage(category, structure.entity_id, this.setup.components);

            return {
              entityId: structure.entity_id,
              structureType: category,
              stage,
            };
          },
          false,
        );
      },
      onTileUpdate: (callback: (value: StructureTileSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.Tile,
          callback,
          async (update: any) => {
            if (isComponentUpdate(update, this.setup.components.Tile)) {
              const [currentState, _prevState] = update.value;

              const structureInfo = currentState && getStructureInfoFromTileOccupier(currentState?.occupier_type);

              if (!structureInfo) return;

              const hyperstructure = getComponentValue(
                this.setup.components.Hyperstructure,
                getEntityIdFromKeys([BigInt(currentState.occupier_id)]),
              );

              const initialized = hyperstructure?.initialized || false;

              let hyperstructureRealmCount: number | undefined;

              if (structureInfo.type === StructureType.Hyperstructure) {
                hyperstructureRealmCount = this.dataEnhancer.getHyperstructureRealmCount(currentState.occupier_id);
              }

              // Use sequential update processing to prevent race conditions
              const result = await this.processSequentialUpdate(currentState.occupier_id, async () => {
                // Use DataEnhancer to fetch all enhanced data
                const enhancedData = await this.dataEnhancer.enhanceStructureData(currentState.occupier_id);

                return {
                  entityId: currentState.occupier_id,
                  hexCoords: {
                    col: currentState.col,
                    row: currentState.row,
                  },
                  structureType: structureInfo.type,
                  initialized,
                  stage: structureInfo.stage,
                  level: structureInfo.level,
                  owner: enhancedData.owner,
                  hasWonder: structureInfo.hasWonder,
                  isAlly: false,
                  // Enhanced data from DataEnhancer
                  guardArmies: enhancedData.guardArmies,
                  activeProductions: enhancedData.activeProductions,
                  hyperstructureRealmCount,
                  battleData: enhancedData.battleData,
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
            if (isComponentUpdate(update, this.setup.components.Structure)) {
              const [currentState, _prevState] = update.value;

              if (!currentState) return;

              // Extract guard armies data from the structure
              const guardArmies: GuardArmy[] = [];
              if (currentState.troop_guards.delta) {
                guardArmies.push({
                  slot: 0,
                  category: currentState.troop_guards.delta.category,
                  tier: TROOP_TIERS[currentState.troop_guards.delta.tier],
                  count: divideByPrecision(Number(currentState.troop_guards.delta.count)),
                  stamina: Number(currentState.troop_guards.delta.stamina.amount),
                });
              }
              if (currentState.troop_guards.charlie) {
                guardArmies.push({
                  slot: 1,
                  category: currentState.troop_guards.charlie.category,
                  tier: TROOP_TIERS[currentState.troop_guards.charlie.tier],
                  count: divideByPrecision(Number(currentState.troop_guards.charlie.count)),
                  stamina: Number(currentState.troop_guards.charlie.stamina.amount),
                });
              }
              if (currentState.troop_guards.bravo) {
                guardArmies.push({
                  slot: 2,
                  category: currentState.troop_guards.bravo.category,
                  tier: TROOP_TIERS[currentState.troop_guards.bravo.tier],
                  count: divideByPrecision(Number(currentState.troop_guards.bravo.count)),
                  stamina: Number(currentState.troop_guards.bravo.stamina.amount),
                });
              }
              if (currentState.troop_guards.alpha) {
                guardArmies.push({
                  slot: 3,
                  category: currentState.troop_guards.alpha.category,
                  tier: TROOP_TIERS[currentState.troop_guards.alpha.tier],
                  count: divideByPrecision(Number(currentState.troop_guards.alpha.count)),
                  stamina: Number(currentState.troop_guards.alpha.stamina.amount),
                });
              }

              // Use DataEnhancer to fetch player name
              const playerName = await this.dataEnhancer.getPlayerName(currentState.owner.toString());

              return {
                entityId: currentState.entity_id,
                guardArmies,
                owner: {
                  address: currentState.owner,
                  ownerName: playerName,
                  guildName: "",
                },
                hexCoords: { col: currentState.base.coord_x, row: currentState.base.coord_y },
                battleCooldownEnd: Math.max(
                  currentState.troop_guards.alpha.battle_cooldown_end,
                  currentState.troop_guards.bravo.battle_cooldown_end,
                  currentState.troop_guards.charlie.battle_cooldown_end,
                  currentState.troop_guards.delta.battle_cooldown_end,
                ),
              };
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

              if (!currentState) return;

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
                  activeProductions.push({
                    buildingCount: count,
                    buildingType: buildingType as BuildingType,
                  });
                }
              }

              return {
                entityId: currentState.entity_id,
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
          this.setup.components.Tile,
          callback,
          async (update: any) => {
            const newState = update.value[0];
            const prevState = update.value[1];

            const newStateBiomeType = BiomeIdToType[newState?.biome];
            const { col, row } = prevState || newState;
            return {
              hexCoords: { col, row },
              removeExplored: !newState,
              biome:
                newStateBiomeType === BiomeType.None ? BiomeType.Grassland : newStateBiomeType || BiomeType.Grassland,
            };
          },
          false,
        );
      },
    };
  }

  public get Buildings() {
    return {
      onBuildingUpdate: (hexCoords: HexPosition, callback: (value: BuildingSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.Building,
          callback,
          async (update: any) => {
            if (isComponentUpdate(update, this.setup.components.Building)) {
              const building = getComponentValue(this.setup.components.Building, update.entity);
              if (!building) return;

              if (building.outer_col !== hexCoords.col || building.outer_row !== hexCoords.row) return;

              const innerCol = building.inner_col;
              const innerRow = building.inner_row;
              const buildingType = building.category;
              const paused = building.paused;

              return {
                buildingType,
                innerCol,
                innerRow,
                paused,
              };
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
          this.setup.components.Tile,
          callback,
          (update: any) => {
            if (isComponentUpdate(update, this.setup.components.Tile)) {
              const [currentState, _prevState] = update.value;

              if (!currentState) return;

              const quest = currentState.occupier_type === TileOccupier.Quest;

              if (!quest) return;

              return {
                entityId: update.entity,
                occupierId: currentState?.occupier_id,
                hexCoords: { col: currentState.col, row: currentState.row },
              };
            }
          },
          false,
        );
      },
    };
  }

  public get ExplorerMove() {
    return {
      onExplorerMoveEventUpdate: (callback: (value: ExplorerMoveSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.events.ExplorerMoveEvent,
          callback,
          async (update: any) => {
            if (isComponentUpdate(update, this.setup.components.events.ExplorerMoveEvent)) {
              const [currentState, _prevState] = update.value;
              if (!currentState) return undefined;

              const result: ExplorerMoveSystemUpdate = {
                explorerId: currentState.explorer_id,
                resourceId: currentState.reward_resource_type,
                amount: divideByPrecision(Number(currentState.reward_resource_amount)),
              };
              return result;
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
          this.setup.components.Tile,
          callback,
          (update: any) => {
            if (isComponentUpdate(update, this.setup.components.Tile)) {
              const [currentState, _prevState] = update.value;

              if (!currentState) return;

              const chest = currentState.occupier_type === TileOccupier.Chest;

              if (!chest) return;

              return {
                entityId: update.entity,
                occupierId: currentState?.occupier_id,
                hexCoords: { col: currentState.col, row: currentState.row },
              };
            }
          },
          false,
        );
      },
      onDeadChest: (callback: (value: ID) => void) => {
        this.setupSystem(
          this.setup.components.Tile,
          callback,
          async (update: any): Promise<ID | undefined> => {
            if (isComponentUpdate(update, this.setup.components.Tile)) {
              const [currentState, prevState] = update.value;

              // Check if the previous state was a chest and current state is not
              if (
                prevState &&
                prevState.occupier_type === TileOccupier.Chest &&
                (!currentState || currentState.occupier_type !== TileOccupier.Chest)
              ) {
                return prevState.occupier_id;
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
            callback({
              entityId,
              level: currentState.base.level,
            });
          }
        });

        // Return the subscription so it can be cleaned up later
        return subscription as any;
      },
    };
  }

  public get RelicEffect() {
    return {
      onExplorerTroopsUpdate: (callback: (value: RelicEffectSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.ExplorerTroops,
          callback,
          async (update: any): Promise<RelicEffectSystemUpdate | undefined> => {
            if (isComponentUpdate(update, this.setup.components.ExplorerTroops)) {
              const [currentState, prevState] = update.value;

              // at least one of the states must have an entity id
              const entityId = currentState?.explorer_id || prevState?.explorer_id || 0;

              // Check if we have a current state
              if (currentState) {
                const { currentArmiesTick } = getBlockTimestamp();
                const relicEffects = getArmyRelicEffects(currentState.troops, currentArmiesTick);

                if (relicEffects.length === 0) {
                  return;
                }

                return {
                  entityId,
                  relicEffects,
                };
              }
            }
          },
          false,
        );
      },
      onStructureGuardUpdate: (callback: (value: RelicEffectSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.Structure,
          callback,
          async (update: any): Promise<RelicEffectSystemUpdate | undefined> => {
            if (isComponentUpdate(update, this.setup.components.Structure)) {
              const [currentState, _prevState] = update.value;

              if (!currentState) return;

              const { currentArmiesTick } = getBlockTimestamp();
              const relicEffects = getStructureArmyRelicEffects(currentState, currentArmiesTick);

              if (relicEffects.length === 0) {
                return;
              }

              return {
                entityId: currentState.entity_id,
                relicEffects,
              };
            }
          },
          false,
        );
      },
      onStructureProductionUpdate: (callback: (value: RelicEffectSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.ProductionBoostBonus,
          callback,
          async (update: any): Promise<RelicEffectSystemUpdate | undefined> => {
            if (isComponentUpdate(update, this.setup.components.ProductionBoostBonus)) {
              const [currentState, _prevState] = update.value;

              const { currentArmiesTick } = getBlockTimestamp();

              if (!currentState) return;

              const relicEffects = getStructureRelicEffects(currentState, currentArmiesTick);

              if (relicEffects.length === 0) {
                return;
              }

              return {
                entityId: currentState.structure_id,
                relicEffects,
              };
            }
          },
          false,
        );
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
              
              if (!currentState) return;

              // Parse max_reward from the event
              const maxReward: Array<{ resourceType: number; amount: number }> = [];
              if (currentState.max_reward && Array.isArray(currentState.max_reward)) {
                for (const reward of currentState.max_reward) {
                  // Assuming reward is [resourceType, amount] tuple
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
              const entityId = currentState.winner_id === currentState.attacker_owner 
                ? currentState.attacker_id 
                : currentState.defender_id;

              return {
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
            }
          },
          false,
        );
      },
    };
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
