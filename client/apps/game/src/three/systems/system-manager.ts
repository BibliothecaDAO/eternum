import { usePlayerStore } from "@/hooks/store/use-player-store";
import { PROGRESS_FINAL_THRESHOLD, PROGRESS_HALF_THRESHOLD } from "@/three/constants";
import { MapDataStore } from "@/three/managers/map-data-store";
import { getBlockTimestamp } from "@/utils/timestamp";
import { MAP_DATA_REFRESH_INTERVAL } from "@/three/constants/map-data";
import { type SetupResult } from "@bibliothecadao/dojo";
import {
  divideByPrecision,
  getArmyRelicEffects,
  getHyperstructureProgress,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  StaminaManager,
} from "@bibliothecadao/eternum";
import {
  BiomeIdToType,
  BiomeType,
  type HexPosition,
  type ID,
  RealmLevels,
  StructureType,
  TileOccupier,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";
import { type Component, defineComponentSystem, getComponentValue, isComponentUpdate } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import {
  type ArmySystemUpdate,
  type BuildingSystemUpdate,
  ExplorerMoveSystemUpdate,
  type RelicEffectSystemUpdate,
  StructureProgress,
  type StructureSystemUpdate,
  type TileSystemUpdate,
} from "../types";
import { loggedInAccount } from "../utils/utils";

export const getExplorerInfoFromTileOccupier = (
  occupierType: number,
): { troopType: TroopType; troopTier: TroopTier; isDaydreamsAgent: boolean } | undefined => {
  switch (occupierType) {
    case TileOccupier.ExplorerKnightT1Regular:
      return { troopType: "Knight" as TroopType, troopTier: "T1" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerKnightT1Daydreams:
      return { troopType: "Knight" as TroopType, troopTier: "T1" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerKnightT2Regular:
      return { troopType: "Knight" as TroopType, troopTier: "T2" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerKnightT2Daydreams:
      return { troopType: "Knight" as TroopType, troopTier: "T2" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerKnightT3Regular:
      return { troopType: "Knight" as TroopType, troopTier: "T3" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerKnightT3Daydreams:
      return { troopType: "Knight" as TroopType, troopTier: "T3" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerPaladinT1Regular:
      return { troopType: "Paladin" as TroopType, troopTier: "T1" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerPaladinT1Daydreams:
      return { troopType: "Paladin" as TroopType, troopTier: "T1" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerPaladinT2Regular:
      return { troopType: "Paladin" as TroopType, troopTier: "T2" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerPaladinT2Daydreams:
      return { troopType: "Paladin" as TroopType, troopTier: "T2" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerPaladinT3Regular:
      return { troopType: "Paladin" as TroopType, troopTier: "T3" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerPaladinT3Daydreams:
      return { troopType: "Paladin" as TroopType, troopTier: "T3" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerCrossbowmanT1Regular:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T1" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerCrossbowmanT1Daydreams:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T1" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerCrossbowmanT2Regular:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T2" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerCrossbowmanT2Daydreams:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T2" as TroopTier, isDaydreamsAgent: true };

    case TileOccupier.ExplorerCrossbowmanT3Regular:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T3" as TroopTier, isDaydreamsAgent: false };
    case TileOccupier.ExplorerCrossbowmanT3Daydreams:
      return { troopType: "Crossbowman" as TroopType, troopTier: "T3" as TroopTier, isDaydreamsAgent: true };

    default:
      return undefined;
  }
};

export const getStructureInfoFromTileOccupier = (
  occupierType: number,
): { type: StructureType; stage: StructureProgress; level: number; hasWonder: boolean } | undefined => {
  switch (occupierType) {
    case TileOccupier.RealmRegularLevel1:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Settlement,
        hasWonder: false,
      };
    case TileOccupier.RealmRegularLevel2:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: RealmLevels.City, hasWonder: false };
    case TileOccupier.RealmRegularLevel3:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Kingdom,
        hasWonder: false,
      };
    case TileOccupier.RealmRegularLevel4:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Empire,
        hasWonder: false,
      };

    case TileOccupier.RealmRegularLevel1WonderBonus:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Settlement,
        hasWonder: true,
      };
    case TileOccupier.RealmRegularLevel2WonderBonus:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: RealmLevels.City, hasWonder: true };
    case TileOccupier.RealmRegularLevel3WonderBonus:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Kingdom,
        hasWonder: true,
      };
    case TileOccupier.RealmRegularLevel4WonderBonus:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Empire,
        hasWonder: true,
      };

    case TileOccupier.RealmWonderLevel1:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Settlement,
        hasWonder: true,
      };
    case TileOccupier.RealmWonderLevel2:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: RealmLevels.City, hasWonder: true };
    case TileOccupier.RealmWonderLevel3:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Kingdom,
        hasWonder: true,
      };
    case TileOccupier.RealmWonderLevel4:
      return {
        type: StructureType.Realm,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Empire,
        hasWonder: true,
      };

    case TileOccupier.HyperstructureLevel1:
      return { type: StructureType.Hyperstructure, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };
    case TileOccupier.HyperstructureLevel2:
      return { type: StructureType.Hyperstructure, stage: StructureProgress.STAGE_2, level: 1, hasWonder: false };
    case TileOccupier.HyperstructureLevel3:
      return { type: StructureType.Hyperstructure, stage: StructureProgress.STAGE_3, level: 1, hasWonder: false };

    case TileOccupier.FragmentMine:
      return { type: StructureType.FragmentMine, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };

    case TileOccupier.Village:
      return {
        type: StructureType.Village,
        stage: StructureProgress.STAGE_1,
        level: RealmLevels.Settlement,
        hasWonder: false,
      };

    case TileOccupier.VillageWonderBonus:
      return { type: StructureType.Village, stage: StructureProgress.STAGE_1, level: 1, hasWonder: true };

    case TileOccupier.Bank:
      return { type: StructureType.Bank, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };

    default:
      return undefined;
  }
};
// The SystemManager class is responsible for updating the Three.js models when there are changes in the game state.
// It listens for updates from torii and translates them into a format that can be consumed by the Three.js model managers.
export class SystemManager {
  private mapDataStore: MapDataStore;
  private onMapDataRefresh = this.handleMapDataRefresh.bind(this);

  constructor(private setup: SetupResult) {
    // Initialize MapDataStore with centralized refresh interval
    this.mapDataStore = MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL);

    // Register callback to update labels when map data refreshes
    this.mapDataStore.onRefresh(this.onMapDataRefresh);

    // Start initial data fetch
    this.mapDataStore.refresh().catch((error) => {
      console.warn("Initial MapDataStore refresh failed:", error);
    });

    // Start automatic refresh timer
    this.mapDataStore.startAutoRefresh();
  }

  /**
   * Handle map data refresh by updating all visible labels
   */
  private handleMapDataRefresh(): void {
    console.log("SystemManager: Handling map data refresh, updating labels");

    // Trigger label updates by calling the onUpdate methods for all visible entities
    // This will fetch fresh data from the MapDataStore and update the labels
    this.refreshAllVisibleLabels();
  }

  /**
   * Refresh all visible army and structure labels with updated data
   */
  private refreshAllVisibleLabels(): void {
    // Note: We would need access to the HexagonScene managers here
    // This will be implemented once we have access to army and structure managers
    console.log("SystemManager: Refreshing all visible labels (placeholder)");
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
      onUpdate: (callback: (value: ArmySystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.Tile,
          callback,
          async (update: any): Promise<ArmySystemUpdate | undefined> => {
            if (isComponentUpdate(update, this.setup.components.Tile)) {
              const [currentState, _prevState] = update.value;
              const explorer = currentState && getExplorerInfoFromTileOccupier(currentState?.occupier_type);

              if (!explorer) return;

              // Use the global player store instead of local instance
              const playerStore = usePlayerStore.getState();

              let explorerOwnerAddress = await playerStore.getExplorerOwnerAddress(currentState.occupier_id.toString());
              if (!Boolean(explorerOwnerAddress) && !explorer.isDaydreamsAgent) {
                // Attempt to get explorer owner structure id from RECS
                let explorerTroops = null;
                // todo: find a better way to get the explorer owner address
                let retries = 5;
                while (retries > 0) {
                  explorerTroops = getComponentValue(
                    this.setup.components.ExplorerTroops,
                    getEntityIdFromKeys([BigInt(currentState.occupier_id)]),
                  );

                  if (explorerTroops) break;
                  await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 100ms between retries
                  retries--;
                }
                if (explorerTroops?.owner) {
                  playerStore.updateExplorerStructure(
                    currentState.occupier_id.toString(),
                    explorerTroops.owner.toString(),
                  );
                  explorerOwnerAddress = await playerStore.getExplorerOwnerAddress(currentState.occupier_id.toString());
                }
              }

              let explorerPlayerData = null;
              let loggedInAccountPlayerData = null;
              if (explorerOwnerAddress) {
                explorerPlayerData = await playerStore.getPlayerDataByExplorerId(currentState.occupier_id.toString());
                loggedInAccountPlayerData = await playerStore.getPlayerDataByAddress(
                  BigInt(loggedInAccount()).toString(),
                );
              }

              const isAlly =
                Boolean(loggedInAccountPlayerData?.guildId) &&
                loggedInAccountPlayerData?.guildId === explorerPlayerData?.guildId;

              // Get enhanced army data from MapDataStore
              const armyMapData = this.mapDataStore.getArmyById(currentState.occupier_id);

              if (!armyMapData) return;

              const { currentArmiesTick } = getBlockTimestamp();

              return {
                entityId: currentState.occupier_id,
                hexCoords: { col: currentState.col, row: currentState.row },
                order: 1,
                owner: {
                  address: BigInt(explorerOwnerAddress),
                  ownerName: explorerPlayerData?.ownerName || "",
                  guildName: explorerPlayerData?.guildName || "",
                },
                troopType: explorer.troopType as TroopType,
                troopTier: explorer.troopTier as TroopTier,
                isDaydreamsAgent: explorer.isDaydreamsAgent,
                isAlly,
                // Enhanced data from MapDataStore
                troopCount: armyMapData.count,
                currentStamina: Number(
                  StaminaManager.getStamina(
                    {
                      category: explorer.troopType,
                      tier: explorer.troopTier,
                      count: BigInt(armyMapData.count),
                      stamina: {
                        amount: BigInt(armyMapData.stamina.amount),
                        updated_tick: BigInt(armyMapData.stamina.updated_tick),
                      },
                      boosts: {
                        incr_stamina_regen_percent_num: 0,
                        incr_stamina_regen_tick_count: 0,
                        incr_explore_reward_percent_num: 0,
                        incr_explore_reward_end_tick: 0,
                        incr_damage_dealt_percent_num: 0,
                        incr_damage_dealt_end_tick: 0,
                        decr_damage_gotten_percent_num: 0,
                        decr_damage_gotten_end_tick: 0,
                      },
                    },
                    currentArmiesTick,
                  ).amount,
                ),
                maxStamina: StaminaManager.getMaxStamina(explorer.troopType, explorer.troopTier),
              };
            }
          },
          true,
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
          true,
        );
      },
    };
  }

  public get Structure() {
    return {
      onContribution: (callback: (value: { entityId: ID; structureType: StructureType; stage: number }) => void) => {
        this.setupSystem(this.setup.components.HyperstructureRequirements, callback, async (update: any) => {
          const structure = getComponentValue(
            this.setup.components.Structure,
            getEntityIdFromKeys([BigInt(update.value[0].hyperstructure_id)]),
          );

          if (!structure) return;

          const category = structure.base.category as StructureType;

          const stage = this.getStructureStage(category, structure.entity_id);

          return {
            entityId: structure.entity_id,
            structureType: category,
            stage,
          };
        });
      },
      onUpdate: (callback: (value: StructureSystemUpdate) => void) => {
        this.setupSystem(this.setup.components.Tile, callback, async (update: any) => {
          if (isComponentUpdate(update, this.setup.components.Tile)) {
            const [currentState, _prevState] = update.value;

            const structureInfo = currentState && getStructureInfoFromTileOccupier(currentState?.occupier_type);

            if (!structureInfo) return;

            const structureSynced = getComponentValue(
              this.setup.components.Structure,
              getEntityIdFromKeys([BigInt(currentState.occupier_id)]),
            );

            const hyperstructure = getComponentValue(
              this.setup.components.Hyperstructure,
              getEntityIdFromKeys([BigInt(currentState.occupier_id)]),
            );

            const initialized = hyperstructure?.initialized || false;

            // Use the global player store instead of local instance
            const playerStore = usePlayerStore.getState();

            let structureOwnerDataQueried = await playerStore.getPlayerDataByStructureId(
              currentState.occupier_id.toString(),
            );
            const structureQueriedOwner = BigInt(structureOwnerDataQueried?.ownerAddress || 0n);
            const structureSyncedOwner = BigInt(structureSynced?.owner.toString() || 0n);
            if (structureSyncedOwner !== 0n && structureQueriedOwner !== structureSyncedOwner) {
              playerStore.updateStructureOwnerAddress(
                currentState.occupier_id.toString(),
                structureSyncedOwner.toString(),
              );
              structureOwnerDataQueried = await playerStore.getPlayerDataByStructureId(
                currentState.occupier_id.toString(),
              );
              if (!structureOwnerDataQueried) {
                // it is a new player
                await playerStore.refreshPlayerData();
                structureOwnerDataQueried = await playerStore.getPlayerDataByStructureId(
                  currentState.occupier_id.toString(),
                );
              }
            }

            const structureOwnerAddress = structureOwnerDataQueried?.ownerAddress;

            let loggedInAccountPlayerData = null;
            if (structureOwnerAddress) {
              loggedInAccountPlayerData = await playerStore.getPlayerDataByAddress(
                BigInt(loggedInAccount()).toString(),
              );
            }

            const isAlly =
              Boolean(loggedInAccountPlayerData?.guildId) &&
              loggedInAccountPlayerData?.guildId === structureOwnerDataQueried?.guildId;

            // Get enhanced structure data from MapDataStore
            const structureMapData = this.mapDataStore.getStructureById(currentState.occupier_id);

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
              owner: {
                address: BigInt(structureOwnerAddress || "") || 0n,
                ownerName: structureOwnerDataQueried?.ownerName || "",
                guildName: structureOwnerDataQueried?.guildName || "",
              },
              hasWonder: structureInfo.hasWonder,
              isAlly,
              // Enhanced data from MapDataStore
              guardArmies: structureMapData?.guardArmies || [],
              activeProductions: structureMapData?.activeProductions || [],
            };
          }
        });
      },
    };
  }

  public get Tile() {
    return {
      onUpdate: (callback: (value: TileSystemUpdate) => void) => {
        this.setupSystem(this.setup.components.Tile, callback, async (update: any) => {
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
        });
      },
    };
  }

  public get Buildings() {
    return {
      onUpdate: (hexCoords: HexPosition, callback: (value: BuildingSystemUpdate) => void) => {
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
          true,
        );
      },
    };
  }

  public get Quest() {
    return {
      onUpdate: (callback: (value: any) => void) => {
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
          true,
        );
      },
    };
  }

  public get ExplorerMove() {
    return {
      onUpdate: (callback: (value: ExplorerMoveSystemUpdate) => void) => {
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
          true,
        );
      },
    };
  }

  public get Chest() {
    return {
      onUpdate: (callback: (value: any) => void) => {
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
          true,
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

  public getStructureStage(structureType: StructureType, entityId: ID): number {
    if (structureType === StructureType.Hyperstructure) {
      const { initialized, percentage } = getHyperstructureProgress(entityId, this.setup.components);

      if (!initialized) {
        return StructureProgress.STAGE_1;
      }

      if (percentage < PROGRESS_HALF_THRESHOLD) {
        return StructureProgress.STAGE_1;
      }
      if (percentage < PROGRESS_FINAL_THRESHOLD && percentage >= PROGRESS_HALF_THRESHOLD) {
        return StructureProgress.STAGE_2;
      }
      return StructureProgress.STAGE_3;
    }

    return StructureProgress.STAGE_1;
  }

  public get RelicEffect() {
    return {
      onArmyUpdate: (callback: (value: RelicEffectSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.ExplorerTroops,
          callback,
          async (update: any): Promise<RelicEffectSystemUpdate | undefined> => {
            if (isComponentUpdate(update, this.setup.components.ExplorerTroops)) {
              const [currentState, prevState] = update.value;

              console.log("RelicEffectSystemManager: update received", { currentState, prevState });

              // at least one of the states must have an entity id
              const entityId = currentState?.explorer_id || prevState?.explorer_id || 0;

              // Check if we have a current state
              if (currentState) {
                const { currentArmiesTick } = getBlockTimestamp();
                const relicEffects = getArmyRelicEffects(currentState.troops, currentArmiesTick);

                console.log("RelicEffectSystemManager: currentState exists, isActive", {
                  currentArmiesTick,
                  relicEffects,
                });

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
          true,
        );
      },
      onStructureGuardUpdate: (callback: (value: RelicEffectSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.Structure,
          callback,
          async (update: any): Promise<RelicEffectSystemUpdate | undefined> => {
            if (isComponentUpdate(update, this.setup.components.Structure)) {
              const [currentState, prevState] = update.value;

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
          true,
        );
      },
      onStructureProductionUpdate: (callback: (value: RelicEffectSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.ProductionBoostBonus,
          callback,
          async (update: any): Promise<RelicEffectSystemUpdate | undefined> => {
            if (isComponentUpdate(update, this.setup.components.ProductionBoostBonus)) {
              const [currentState, prevState] = update.value;

              const { currentArmiesTick } = getBlockTimestamp();

              if (!currentState) return;

              const relicEffects = getStructureRelicEffects(currentState, currentArmiesTick);

              if (relicEffects.length === 0) {
                return;
              }

              console.log("RelicEffectSystemManager: onStructureProductionUpdate", {
                currentState,
                relicEffects,
              });

              return {
                entityId: currentState.structure_id,
                relicEffects,
              };
            }
          },
        );
      },
    };
  }

  /**
   * Clean up resources and stop timers
   */
  public destroy(): void {
    this.mapDataStore.destroy();
    console.log("SystemManager: Destroyed and cleaned up");
  }
}
