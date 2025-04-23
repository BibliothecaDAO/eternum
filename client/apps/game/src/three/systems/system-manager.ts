import {
  BiomeIdToType,
  BiomeType,
  type HexPosition,
  type ID,
  RealmLevels,
  StructureType,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";
import { getHyperstructureProgress } from "@bibliothecadao/eternum"
import { type SetupResult } from "@bibliothecadao/dojo";
import {
  type Component,
  defineComponentSystem,
  getComponentValue,
  isComponentUpdate,
} from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import {
  PROGRESS_FINAL_THRESHOLD,
  PROGRESS_HALF_THRESHOLD,
} from "../scenes/constants";
import {
  type ArmySystemUpdate,
  type BuildingSystemUpdate,
  StructureProgress,
  type StructureSystemUpdate,
  type TileSystemUpdate,
} from "../types";

// The SystemManager class is responsible for updating the Three.js models when there are changes in the game state.
// It listens for updates from torii and translates them into a format that can be consumed by the Three.js model managers.
export class SystemManager {
  constructor(private setup: SetupResult) { }

  private setupSystem<T>(
    component: Component,
    callback: (value: T) => void,
    getUpdate: (update: any) => T | undefined,
    runOnInit = true,
    maxRetries = 10,
    retryDelay = 500,
  ) {
    const handleUpdate = (update: any) => {
      const value = getUpdate(update);
      if (value) {
        callback(value);
        return;
      }

      let retries = 0;
      const tryGetUpdate = () => {
        const value = getUpdate(update);
        if (value) {
          callback(value);
          return;
        }

        retries++;
        if (retries < maxRetries) {
          setTimeout(tryGetUpdate, retryDelay);
        }
      };

      setTimeout(tryGetUpdate, retryDelay);
    };

    defineComponentSystem(this.setup.network.world, component, handleUpdate, {
      runOnInit,
    });
  }

  public get Army() {
    return {
      onUpdate: (callback: (value: ArmySystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.ExplorerTroops,
          callback,
          (update: any): ArmySystemUpdate | undefined => {
            if (
              isComponentUpdate(update, this.setup.components.ExplorerTroops)
            ) {
              const [currentState, prevState] = update.value;
              const explorer = getComponentValue(
                this.setup.components.ExplorerTroops,
                update.entity,
              );
              if (!explorer && !prevState) return;
              if (!explorer && undefined === currentState && prevState) {
                // when explorer_troop is removed, torii streams an empty object which is removed from components in setEntities.
                // we need to catch that update update.value[currentState, prevState];
                // if explorer is undefined && prevState has values, that means component has been removed
                return {
                  entityId: prevState.explorer_id,
                  hexCoords: { col: prevState.coord.x, row: prevState.coord.y },
                  order: 0,
                  owner: {
                    address: BigInt(prevState.owner) || 0n,
                    ownerName: "",
                    guildName: "",
                  },
                  troopType: prevState.troops.category as TroopType,
                  troopTier: prevState.troops.tier as TroopTier,
                  deleted: true,
                };
              }
              // leaving this condition here so that typescript is happy.
              if (!explorer) return;

              const structure = getComponentValue(
                this.setup.components.Structure,
                getEntityIdFromKeys([BigInt(explorer.owner)]),
              );

              const owner = BigInt(structure?.owner || explorer.owner);

              const addressName = getComponentValue(
                this.setup.components.AddressName,
                getEntityIdFromKeys([
                  structure?.owner || BigInt(explorer.explorer_id) || 0n,
                ]),
              );

              const ownerName = addressName
                ? shortString.decodeShortString(addressName.name.toString())
                : "";

              const guild = owner
                ? getComponentValue(
                  this.setup.components.GuildMember,
                  getEntityIdFromKeys([owner || 0n]),
                )
                : undefined;

              let guildName = "";
              if (guild?.guild_id) {
                const guildEntityName = getComponentValue(
                  this.setup.components.AddressName,
                  getEntityIdFromKeys([BigInt(guild.guild_id)]),
                );
                guildName = guildEntityName?.name
                  ? shortString.decodeShortString(
                    guildEntityName.name.toString(),
                  )
                  : "";
              }

              const order =
                structure?.metadata.order ||
                getComponentValue(
                  this.setup.components.Structure,
                  getEntityIdFromKeys([
                    BigInt(structure?.metadata.village_realm || 0),
                  ]),
                )?.metadata.order ||
                0;

              return {
                entityId: explorer.explorer_id,
                hexCoords: { col: explorer.coord.x, row: explorer.coord.y },
                order,
                owner: { address: owner || 0n, ownerName, guildName },
                troopType: explorer.troops.category as TroopType,
                troopTier: explorer.troops.tier as TroopTier,
                deleted: explorer.troops.count === 0n,
              };
            }
          },
          true,
        );
      },
    };
  }

  public get Structure() {
    return {
      onContribution: (
        callback: (value: {
          entityId: ID;
          structureType: StructureType;
          stage: number;
        }) => void,
      ) => {
        this.setupSystem(
          this.setup.components.HyperstructureRequirements,
          callback,
          (update: any) => {
            const structure = getComponentValue(
              this.setup.components.Structure,
              getEntityIdFromKeys([
                BigInt(update.value[0].hyperstructure_entity_id),
              ]),
            );

            if (!structure) return;

            const category = structure.base.category as StructureType;

            const stage = this.getStructureStage(category, structure.entity_id);

            return {
              entityId: structure.entity_id,
              structureType: category,
              stage,
            };
          },
        );
      },
      onUpdate: (callback: (value: StructureSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.Structure,
          callback,
          (update: any) => {
            const structure = getComponentValue(
              this.setup.components.Structure,
              update.entity,
            );
            if (!structure) return;

            const stage = this.getStructureStage(
              structure.base.category as StructureType,
              structure.entity_id,
            );

            let level = 0;
            let hasWonder = false;
            if (structure.base.category === StructureType.Realm) {
              level = structure.base.level || RealmLevels.Settlement;
              hasWonder = structure.metadata.has_wonder || false;
            }

            const addressName = getComponentValue(
              this.setup.components.AddressName,
              getEntityIdFromKeys([BigInt(structure.owner)]),
            );

            const ownerName = addressName
              ? shortString.decodeShortString(addressName.name.toString())
              : "";

            const guild = structure.owner
              ? getComponentValue(
                this.setup.components.GuildMember,
                getEntityIdFromKeys([BigInt(structure.owner)]),
              )
              : undefined;

            let guildName = "";
            if (guild?.guild_id) {
              const guildEntityName = getComponentValue(
                this.setup.components.AddressName,
                getEntityIdFromKeys([BigInt(guild.guild_id)]),
              );
              guildName = guildEntityName?.name
                ? shortString.decodeShortString(guildEntityName.name.toString())
                : "";
            }

            const hyperstructure = getComponentValue(
              this.setup.components.Hyperstructure,
              getEntityIdFromKeys([BigInt(structure.entity_id)]),
            );

            const initialized = hyperstructure?.initialized || false;

            return {
              entityId: structure.entity_id,
              hexCoords: {
                col: structure.base.coord_x,
                row: structure.base.coord_y,
              },
              structureType: structure.base.category as StructureType,
              initialized,
              stage,
              level,
              owner: { address: structure.owner, ownerName, guildName },
              hasWonder,
            };
          },
        );
      },
    };
  }

  public get Tile() {
    return {
      onUpdate: (callback: (value: TileSystemUpdate) => void) => {
        this.setupSystem(
          this.setup.components.Tile,
          callback,
          (update: any) => {
            const newState = update.value[0];
            const prevState = update.value[1];

            const newStateBiomeType = BiomeIdToType[newState?.biome];
            const { col, row } = prevState || newState;
            return {
              hexCoords: { col, row },
              removeExplored: !newState,
              biome:
                newStateBiomeType === BiomeType.None
                  ? BiomeType.Grassland
                  : newStateBiomeType || BiomeType.Grassland,
            };
          },
        );
      },
    };
  }

  public get Buildings() {
    return {
      onUpdate: (
        hexCoords: HexPosition,
        callback: (value: BuildingSystemUpdate) => void,
      ) => {
        this.setupSystem(
          this.setup.components.Building,
          callback,
          (update: any) => {
            if (isComponentUpdate(update, this.setup.components.Building)) {
              const building = getComponentValue(
                this.setup.components.Building,
                update.entity,
              );
              if (!building) return;

              if (
                building.outer_col !== hexCoords.col ||
                building.outer_row !== hexCoords.row
              )
                return;

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

  public getStructureStage(structureType: StructureType, entityId: ID): number {
    if (structureType === StructureType.Hyperstructure) {
      const { initialized, percentage } = getHyperstructureProgress(
        entityId,
        this.setup.components,
      );

      if (!initialized) {
        return StructureProgress.STAGE_1;
      }

      if (percentage < PROGRESS_HALF_THRESHOLD) {
        return StructureProgress.STAGE_1;
      }
      if (
        percentage < PROGRESS_FINAL_THRESHOLD &&
        percentage >= PROGRESS_HALF_THRESHOLD
      ) {
        return StructureProgress.STAGE_2;
      }
      return StructureProgress.STAGE_3;
    }

    return StructureProgress.STAGE_1;
  }
}
