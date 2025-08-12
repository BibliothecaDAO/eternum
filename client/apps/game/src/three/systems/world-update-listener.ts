import { MAP_DATA_REFRESH_INTERVAL } from "@/three/constants/map-data";
import { ActiveProduction, GuardArmy, MapDataStore, TROOP_TIERS } from "@/three/managers/map-data-store";
import { getBlockTimestamp } from "@/utils/timestamp";
import { type SetupResult } from "@bibliothecadao/dojo";
import {
  divideByPrecision,
  getArmyRelicEffects,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  StaminaManager,
  unpackBuildingCounts,
} from "@bibliothecadao/eternum";
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
import {
  type ArmySystemUpdate,
  type BuildingSystemUpdate,
  ExplorerMoveSystemUpdate,
  ExplorerTroopsSystemUpdate,
  type RelicEffectSystemUpdate,
  type StructureSystemUpdate,
  type TileSystemUpdate,
} from "../types";
import { DataEnhancer } from "./data-enhancer";
import { getExplorerInfoFromTileOccupier, getStructureInfoFromTileOccupier, getStructureStage } from "./utils";

// The WorldUpdateListener class is responsible for updating the Three.js models when there are changes in the game state.
// It listens for updates from torii and translates them into a format that can be consumed by the Three.js model managers.
export class WorldUpdateListener {
  private mapDataStore: MapDataStore;
  private dataEnhancer: DataEnhancer;

  constructor(private setup: SetupResult) {
    // Initialize MapDataStore with centralized refresh interval
    this.mapDataStore = MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL);

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
      onTileUpdate: (callback: (value: ArmySystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.Tile,
          callback,
          async (update: any): Promise<ArmySystemUpdate | undefined> => {
            if (isComponentUpdate(update, this.setup.components.Tile)) {
              const [currentState, _prevState] = update.value;

              console.log("Army: onTileUpdate", { currentState });

              const explorer = currentState && getExplorerInfoFromTileOccupier(currentState?.occupier_type);

              if (!explorer) return;

              const { currentArmiesTick } = getBlockTimestamp();

              // Use DataEnhancer to fetch all enhanced data
              const enhancedData = await this.dataEnhancer.enhanceArmyData(
                currentState.occupier_id,
                explorer,
                currentArmiesTick,
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
                maxStamina,
              };
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

              console.log("Army: onExplorerTroopsUpdate", { currentState });
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
      onTileUpdate: (callback: (value: StructureSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.Tile,
          callback,
          async (update: any) => {
            if (isComponentUpdate(update, this.setup.components.Tile)) {
              const [currentState, _prevState] = update.value;

              const structureInfo = currentState && getStructureInfoFromTileOccupier(currentState?.occupier_type);

              if (!structureInfo) return;

              console.log("[STRUCTURE UPDATE]", currentState);

              const hyperstructure = getComponentValue(
                this.setup.components.Hyperstructure,
                getEntityIdFromKeys([BigInt(currentState.occupier_id)]),
              );

              const initialized = hyperstructure?.initialized || false;

              let hyperstructureRealmCount: number | undefined;

              if (structureInfo.type === StructureType.Hyperstructure) {
                hyperstructureRealmCount = this.dataEnhancer.getHyperstructureRealmCount(currentState.occupier_id);
              }

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
              };
            }
          },
          false,
        );
      },
      onStructureUpdate: (
        callback: (value: {
          entityId: ID;
          guardArmies: GuardArmy[];
          owner: { address: bigint; ownerName: string; guildName: string };
          hexCoords: HexPosition;
        }) => void,
      ) => {
        this.setupSystem(
          this.setup.components.Structure,
          callback,
          async (
            update: any,
          ): Promise<
            | {
                entityId: ID;
                guardArmies: GuardArmy[];
                owner: { address: bigint; ownerName: string; guildName: string };
                hexCoords: HexPosition;
              }
            | undefined
          > => {
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
      onLevelUpdate: (entityId: ID, callback: (update: { entityId: ID; level: number }) => void) => {
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
        return subscription;
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

              console.log("RelicEffect: onExplorerTroopsUpdate update received", { currentState, prevState });

              // at least one of the states must have an entity id
              const entityId = currentState?.explorer_id || prevState?.explorer_id || 0;

              // Check if we have a current state
              if (currentState) {
                const { currentArmiesTick } = getBlockTimestamp();
                const relicEffects = getArmyRelicEffects(currentState.troops, currentArmiesTick);

                console.log("RelicEffect: onExplorerTroopsUpdate currentState exists, isActive", {
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

              console.log(": onStructureProductionUpdate", {
                currentState,
                relicEffects,
              });

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

  /**
   * Clean up resources and stop timers
   */
  public destroy(): void {
    this.mapDataStore.destroy();
    console.log("WorldUpdateListener: Destroyed and cleaned up");
  }
}
