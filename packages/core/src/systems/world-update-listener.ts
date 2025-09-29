import { type SetupResult } from "@bibliothecadao/dojo";
import { SqlApi } from "@bibliothecadao/torii";
import {
  BiomeIdToType,
  BiomeType,
  BuildingType,
  ContractAddress,
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
  getComponentValue,
  HasValue,
  isComponentUpdate,
} from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { StaminaManager } from "../managers";
import { ActiveProduction, GuardArmy, MapDataStore, TROOP_TIERS } from "../stores/map-data-store";
import { storyEventBus } from "../stores/story-event-bus";
import {
  divideByPrecision,
  getArmyRelicEffects,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  unpackBuildingCounts,
} from "../utils";
import { MAP_DATA_REFRESH_INTERVAL } from "../utils/constants";
import { getAddressName } from "../utils/entities";
import { getBlockTimestamp } from "../utils/timestamp";
import { DataEnhancer } from "./data-enhancer";
import {
  type BattleEventSystemUpdate,
  type BuildingSystemUpdate,
  ExplorerMoveSystemUpdate,
  ExplorerTroopsSystemUpdate,
  type ExplorerTroopsTileSystemUpdate,
  type RelicEffectSystemUpdate,
  type StoryEventSystemUpdate,
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
  private explorerMoveEventCache: Map<string, ExplorerMoveSystemUpdate> = new Map();
  private explorerMoveEventOrder: string[] = [];
  private readonly MAX_EXPLORER_MOVE_EVENT_CACHE_SIZE = 100;
  private static storyEventRegistered = false; // Prevent duplicate story event registrations

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

    this.registerExplorerMoveCache();

    // Only register story event stream once across all instances
    if (!WorldUpdateListener.storyEventRegistered) {
      this.registerStoryEventStream();
      WorldUpdateListener.storyEventRegistered = true;
    }
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
              const previousExplorer = _prevState && getExplorerInfoFromTileOccupier(_prevState.occupier_type);

              if (!explorer) {
                if (currentState) {
                  console.debug(`[WorldUpdateListener] Tile update without explorer`, {
                    entity: update.entity,
                    occupierType: currentState.occupier_type,
                    occupierId: currentState.occupier_id,
                    prevOccupierId: _prevState?.occupier_id,
                    prevOccupierType: _prevState?.occupier_type,
                  });
                }

                if (previousExplorer && _prevState) {
                  const coordsSource = currentState ?? _prevState;
                  return {
                    entityId: _prevState.occupier_id,
                    hexCoords: { col: coordsSource.col, row: coordsSource.row },
                    troopType: previousExplorer.troopType as TroopType,
                    troopTier: previousExplorer.troopTier as TroopTier,
                    isDaydreamsAgent: previousExplorer.isDaydreamsAgent,
                    troopCount: 0,
                    ownerName: "",
                    guildName: "",
                    ownerAddress: 0n,
                    ownerStructureId: null,
                    removed: true,
                  };
                }

                return;
              }

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

                const normalizedStructureOwnerId =
                  structureOwnerId && structureOwnerId !== 0 ? structureOwnerId : undefined;

                // Use DataEnhancer to fetch all enhanced data
                const enhancedData = await this.dataEnhancer.enhanceArmyData(
                  currentState.occupier_id,
                  explorer,
                  currentArmiesTick,
                  normalizedStructureOwnerId,
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
                  ownerStructureId: normalizedStructureOwnerId ?? enhancedData.ownerStructureId ?? null,
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
              const normalizedOwnerStructureId =
                currentState.owner && currentState.owner !== 0 ? currentState.owner : null;

              return {
                entityId: currentState.explorer_id,
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
          false,
        );
      },
      onDeadArmy: (callback: (value: ID) => void) => {
        console.debug(`[WorldUpdateListener] Subscribing to dead army updates`);
        this.setupSystem(
          this.setup.components.ExplorerTroops,
          callback,
          async (update: any): Promise<ID | undefined> => {
            if (isComponentUpdate(update, this.setup.components.ExplorerTroops)) {
              const [currentState, prevState] = update.value;
              console.debug(`[WorldUpdateListener] ExplorerTroops component update received`, {
                entity: update.entity,
                hasCurrentState: currentState !== undefined,
                hasPrevState: prevState !== undefined,
              });
              const explorer = getComponentValue(this.setup.components.ExplorerTroops, update.entity);
              if (!explorer && !prevState) return;
              if (!explorer && undefined === currentState && prevState) {
                console.debug(`[WorldUpdateListener] ExplorerTroops removed for entity ${prevState.explorer_id}`);
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

                const structureComponent = getComponentValue(
                  this.setup.components.Structure,
                  getEntityIdFromKeys([BigInt(currentState.occupier_id)]),
                );

                let ownerAddress = structureComponent?.owner ?? enhancedData.owner.address ?? 0n;
                let ownerName = enhancedData.owner.ownerName;

                if ((!ownerName || ownerName.length === 0) && ownerAddress && ownerAddress !== 0n) {
                  try {
                    const addressName = getComponentValue(
                      this.setup.components.AddressName,
                      getEntityIdFromKeys([ownerAddress]),
                    );

                    if (addressName?.name) {
                      ownerName = shortString.decodeShortString(addressName.name.toString());
                    }
                  } catch (error) {
                    console.warn(`Failed to decode address name for owner ${ownerAddress}:`, error);
                  }
                }

                ownerName = ownerName || "";

                this.dataEnhancer.updateStructureOwner(currentState.occupier_id, ownerAddress, ownerName);

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
                    address: ownerAddress,
                    ownerName,
                    guildName: enhancedData.owner.guildName,
                  },
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

              // Extract guard armies data from the structure (guard object may be undefined on fresh structures)
              const troopGuards = currentState.troop_guards ?? {};
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

              pushGuard(0, troopGuards?.delta);
              pushGuard(1, troopGuards?.charlie);
              pushGuard(2, troopGuards?.bravo);
              pushGuard(3, troopGuards?.alpha);

              // Use DataEnhancer to fetch player name
              const ownerValue = currentState.owner ?? 0n;
              const ownerString =
                typeof ownerValue === "bigint" || typeof ownerValue === "number" || typeof ownerValue === "string"
                  ? ownerValue.toString()
                  : (ownerValue ?? "0");

              const playerName = await this.dataEnhancer.getPlayerName(ownerString);

              this.dataEnhancer.updateStructureOwner(currentState.entity_id, ownerValue, playerName);

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
                  troopGuards?.alpha?.battle_cooldown_end ?? 0,
                  troopGuards?.bravo?.battle_cooldown_end ?? 0,
                  troopGuards?.charlie?.battle_cooldown_end ?? 0,
                  troopGuards?.delta?.battle_cooldown_end ?? 0,
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
          (value: ExplorerMoveSystemUpdate) => {
            this.storeExplorerMoveEvent(value);
            callback(value);
          },
          async (update: any) => {
            if (isComponentUpdate(update, this.setup.components.events.ExplorerMoveEvent)) {
              const [currentState, _prevState] = update.value;
              if (!currentState) return undefined;

              return this.parseExplorerMoveEvent(currentState);
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

  public get StoryEvent() {
    return {
      subscribe: (listener: (event: StoryEventSystemUpdate) => void) => storyEventBus.subscribe(listener),
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

              console.log("🛡️ BattleEvent received:", {
                currentState,
                prevState: _prevState,
                updateType: "BattleEvent",
              });

              if (!currentState) {
                console.log("❌ BattleEvent: No current state, returning undefined");
                return;
              }

              // Parse max_reward from the event
              const maxReward: Array<{ resourceType: number; amount: number }> = [];
              if (currentState.max_reward && Array.isArray(currentState.max_reward)) {
                console.log("💰 BattleEvent: Parsing max_reward:", currentState.max_reward);
                for (const reward of currentState.max_reward) {
                  // Assuming reward is [resourceType, amount] tuple
                  if (Array.isArray(reward) && reward.length === 2) {
                    const parsedReward = {
                      resourceType: Number(reward[0]),
                      amount: divideByPrecision(Number(reward[1])),
                    };
                    maxReward.push(parsedReward);
                    console.log("💰 BattleEvent: Added reward:", parsedReward);
                  }
                }
              }

              // Determine the entityId based on winner
              // If attacker won, use attacker_id; if defender won, use defender_id
              const entityId =
                currentState.winner_id === currentState.attacker_owner
                  ? currentState.attacker_id
                  : currentState.defender_id;

              console.log("🏆 BattleEvent: Winner determination:", {
                winnerId: currentState.winner_id,
                attackerOwner: currentState.attacker_owner,
                defenderOwner: currentState.defender_owner,
                attackerId: currentState.attacker_id,
                defenderId: currentState.defender_id,
                selectedEntityId: entityId,
                logic: currentState.winner_id === currentState.attacker_owner ? "attacker won" : "defender won",
              });

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

              console.log("✅ BattleEvent: Final result:", result);
              return result;
            }
          },
          false,
        );
      },
    };
  }

  private registerStoryEventStream() {
    if (!this.setup.components.events?.StoryEvent) {
      console.warn("StoryEvent component is not registered on setup.components.events");
      return;
    }

    this.setupSystem(
      this.setup.components.events.StoryEvent,
      (event: StoryEventSystemUpdate) => {
        console.debug("📖 StoryEvent received:", event);
        storyEventBus.publish(event);
      },
      async (update: any): Promise<StoryEventSystemUpdate | undefined> => {
        if (isComponentUpdate(update, this.setup.components.events.StoryEvent)) {
          const [currentState] = update.value;

          if (!currentState) {
            return undefined;
          }

          console.debug("📦 StoryEvent raw state:", currentState);
          return this.mapStoryEventPayload(currentState);
        }

        return undefined;
      },
      false,
    );
  }

  private registerExplorerMoveCache() {
    if (!this.setup.components.events?.ExplorerMoveEvent) {
      console.warn("ExplorerMoveEvent component is not registered on setup.components.events");
      return;
    }

    this.setupSystem(
      this.setup.components.events.ExplorerMoveEvent,
      (value: ExplorerMoveSystemUpdate) => {
        this.storeExplorerMoveEvent(value);
      },
      async (update: any): Promise<ExplorerMoveSystemUpdate | undefined> => {
        if (isComponentUpdate(update, this.setup.components.events.ExplorerMoveEvent)) {
          const [currentState] = update.value;
          if (!currentState) {
            return undefined;
          }
          return this.parseExplorerMoveEvent(currentState);
        }
        return undefined;
      },
      false,
    );
  }

  private parseExplorerMoveEvent(currentState: any): ExplorerMoveSystemUpdate | undefined {
    const explorerId = this.toNumber(currentState?.explorer_id);
    if (explorerId === null) {
      return undefined;
    }

    const resourceId = (this.toNumber(currentState?.reward_resource_type) ?? 0) as ResourcesIds | 0;
    const rawAmount = currentState?.reward_resource_amount ?? 0;
    const normalizedAmount = this.toNumber(rawAmount);
    const amount = normalizedAmount !== null ? divideByPrecision(normalizedAmount) : 0;
    const timestamp = this.toNumber(currentState?.timestamp) ?? 0;
    const exploreFindVariant = this.unwrapSchemaEnum(currentState?.explore_find);
    const exploreFind = exploreFindVariant?.name ?? null;

    return {
      explorerId,
      resourceId,
      amount,
      rawAmount,
      timestamp,
      exploreFind,
    };
  }

  private storeExplorerMoveEvent(event: ExplorerMoveSystemUpdate | undefined) {
    if (!event) {
      return;
    }

    const key = this.getExplorerMoveCacheKey(event.explorerId, event.timestamp);
    if (!key) {
      return;
    }

    this.explorerMoveEventCache.set(key, event);
    this.explorerMoveEventOrder.push(key);

    if (this.explorerMoveEventOrder.length > this.MAX_EXPLORER_MOVE_EVENT_CACHE_SIZE) {
      const oldestKey = this.explorerMoveEventOrder.shift();
      if (oldestKey) {
        this.explorerMoveEventCache.delete(oldestKey);
      }
    }
  }

  private getCachedExplorerMoveEvent(
    explorerId: ID | null,
    timestamp: number | null,
  ): ExplorerMoveSystemUpdate | undefined {
    const key = this.getExplorerMoveCacheKey(explorerId, timestamp);
    if (!key) {
      return undefined;
    }
    return this.explorerMoveEventCache.get(key);
  }

  private getExplorerMoveCacheKey(explorerId: ID | null, timestamp: number | null): string | null {
    if (explorerId === null || timestamp === null) {
      return null;
    }

    return `${explorerId}-${timestamp}`;
  }

  private mapStoryEventPayload(currentState: any): StoryEventSystemUpdate {
    const owner = this.normalizeOptionalValue<string | bigint | number>(currentState.owner);
    const entityId = this.normalizeOptionalValue<number | string>(currentState.entity_id);

    const ownerAddress = owner === null ? null : this.stringifyValue(owner);
    const numericEntityId = entityId === null ? null : Number(entityId);
    const safeEntityId = numericEntityId === null || Number.isNaN(numericEntityId) ? null : numericEntityId;

    const txHash = currentState.tx_hash ? this.stringifyValue(currentState.tx_hash) : "";
    const timestamp = this.toNumber(currentState?.timestamp) ?? 0;

    const storyVariant = this.extractStoryVariant(currentState.story);
    const storyType = storyVariant.storyType;
    let storyPayload = storyVariant.storyPayload;

    if ((!storyPayload || storyType === "Unknown") && currentState.story) {
      console.debug("ℹ️ StoryEvent: Unparsed payload", {
        story: currentState.story,
        storyType,
        storyPayload,
      });
    }

    if ((!storyPayload || Object.keys(storyPayload).length === 0) && storyType === "ExplorerMoveStory") {
      const fallback = this.getCachedExplorerMoveEvent(safeEntityId, timestamp);
      if (fallback) {
        storyPayload = {
          explorer_id: fallback.explorerId,
          reward_resource_type: fallback.resourceId,
          reward_resource_amount: fallback.rawAmount,
          explore_find: fallback.exploreFind ?? undefined,
        } as Record<string, unknown>;
      }
    }

    const ownerName = ownerAddress
      ? getAddressName(ownerAddress as unknown as ContractAddress, this.setup.components) || null
      : null;

    return {
      ownerAddress,
      ownerName,
      entityId: safeEntityId,
      txHash,
      timestamp,
      storyType,
      storyPayload,
      rawStory: currentState.story,
    };
  }

  private normalizeOptionalValue<T>(value: unknown): T | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === "object") {
      if ("Some" in (value as Record<string, unknown>)) {
        return this.normalizeOptionalValue<T>((value as Record<string, unknown>).Some);
      }

      if ("None" in (value as Record<string, unknown>)) {
        return null;
      }
    }

    if (typeof value === "string") {
      if (value === "0x0" || value === "0" || value.trim() === "") {
        return null;
      }

      return value as T;
    }

    if (typeof value === "number") {
      return value === 0 ? null : (value as T);
    }

    if (typeof value === "bigint") {
      return value === 0n ? null : (value as T);
    }

    return value as T;
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

  private stringifyValue(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "bigint") {
      return `0x${value.toString(16)}`;
    }

    if (typeof value === "number") {
      return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    }

    if (value && typeof value === "object" && "toString" in value) {
      return String(value as { toString: () => string });
    }

    return String(value ?? "");
  }

  private extractStoryVariant(story: unknown): { storyType: string; storyPayload: Record<string, unknown> | null } {
    const variant = this.unwrapSchemaEnum(story);
    if (!variant) {
      return { storyType: "Unknown", storyPayload: null };
    }

    const normalizedPayload = this.normalizeSchemaValue(variant.payload);

    return {
      storyType: variant.name,
      storyPayload:
        normalizedPayload && typeof normalizedPayload === "object"
          ? (normalizedPayload as Record<string, unknown>)
          : normalizedPayload !== undefined && normalizedPayload !== null
            ? { value: normalizedPayload }
            : null,
    };
  }

  private unwrapSchemaEnum(value: unknown): { name: string; payload: unknown } | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === "string") {
      return { name: value, payload: null };
    }

    if (Array.isArray(value)) {
      if (value.length === 2 && typeof value[0] === "string") {
        return { name: value[0], payload: value[1] };
      }
      return null;
    }

    if (typeof value !== "object") {
      return null;
    }

    const record = value as Record<string, unknown>;

    if (typeof record.__kind === "string") {
      const payload = record.value ?? record[record.__kind];
      return { name: record.__kind, payload };
    }

    if (typeof record.kind === "string") {
      const payload = record.value ?? record[record.kind];
      return { name: record.kind, payload };
    }

    const entries = Object.entries(record);
    if (entries.length === 1 && typeof entries[0][0] === "string") {
      return { name: entries[0][0], payload: entries[0][1] };
    }

    // Some schema values wrap the variant in a `value` property
    if ("value" in record) {
      return this.unwrapSchemaEnum(record.value);
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
