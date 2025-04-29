import { type SetupResult } from "@bibliothecadao/dojo";
import { getAddressName, getHyperstructureProgress } from "@bibliothecadao/eternum";
import {
  BiomeIdToType,
  BiomeType,
  type HexPosition,
  type ID,
  StructureType,
  TileOccupier,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";
import { type Component, defineComponentSystem, getComponentValue, isComponentUpdate } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { PROGRESS_FINAL_THRESHOLD, PROGRESS_HALF_THRESHOLD } from "../scenes/constants";
import {
  type ArmySystemUpdate,
  type BuildingSystemUpdate,
  StructureProgress,
  type StructureSystemUpdate,
  type TileSystemUpdate,
} from "../types";

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
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };
    case TileOccupier.RealmRegularLevel2:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: 2, hasWonder: false };
    case TileOccupier.RealmRegularLevel3:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: 3, hasWonder: false };
    case TileOccupier.RealmRegularLevel4:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: 4, hasWonder: false };

    case TileOccupier.RealmRegularLevel1WonderBonus:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: 1, hasWonder: true };
    case TileOccupier.RealmRegularLevel2WonderBonus:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: 2, hasWonder: true };
    case TileOccupier.RealmRegularLevel3WonderBonus:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: 3, hasWonder: true };
    case TileOccupier.RealmRegularLevel4WonderBonus:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: 4, hasWonder: true };

    case TileOccupier.RealmWonderLevel1:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: 1, hasWonder: true };
    case TileOccupier.RealmWonderLevel2:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: 2, hasWonder: true };
    case TileOccupier.RealmWonderLevel3:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: 3, hasWonder: true };
    case TileOccupier.RealmWonderLevel4:
      return { type: StructureType.Realm, stage: StructureProgress.STAGE_1, level: 4, hasWonder: true };

    case TileOccupier.HyperstructureLevel1:
      return { type: StructureType.Hyperstructure, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };
    case TileOccupier.HyperstructureLevel2:
      return { type: StructureType.Hyperstructure, stage: StructureProgress.STAGE_2, level: 1, hasWonder: false };
    case TileOccupier.HyperstructureLevel3:
      return { type: StructureType.Hyperstructure, stage: StructureProgress.STAGE_3, level: 1, hasWonder: false };

    case TileOccupier.FragmentMine:
      return { type: StructureType.FragmentMine, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };

    case TileOccupier.Village:
      return { type: StructureType.Village, stage: StructureProgress.STAGE_1, level: 1, hasWonder: false };

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
  constructor(private setup: SetupResult) {}

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
          this.setup.components.Tile,
          callback,
          (update: any): ArmySystemUpdate | undefined => {
            if (isComponentUpdate(update, this.setup.components.Tile)) {
              const [currentState, _prevState] = update.value;
              const explorer = currentState && getExplorerInfoFromTileOccupier(currentState?.occupier_type);

              // leaving this condition here so that typescript is happy.
              if (!explorer) return;

              const owner = getComponentValue(
                this.setup.components.ExplorerTroops,
                getEntityIdFromKeys([BigInt(currentState.occupier_id)]),
              )?.owner;

              const structure = owner
                ? getComponentValue(this.setup.components.Structure, getEntityIdFromKeys([BigInt(owner)]))
                : undefined;

              return {
                entityId: currentState.occupier_id,
                hexCoords: { col: currentState.col, row: currentState.row },
                order: 1,
                owner: { address: structure?.owner || 0n, ownerName: "", guildName: "" },
                troopType: explorer.troopType as TroopType,
                troopTier: explorer.troopTier as TroopTier,
                isDaydreamsAgent: explorer.isDaydreamsAgent,
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
          (update: any): ID | undefined => {
            if (isComponentUpdate(update, this.setup.components.ExplorerTroops)) {
              const [currentState, prevState] = update.value;
              const explorer = getComponentValue(this.setup.components.ExplorerTroops, update.entity);
              if (!explorer && !prevState) return;
              if (!explorer && undefined === currentState && prevState) {
                // when explorer_troop is removed, torii streams an empty object which is removed from components in setEntities.
                // we need to catch that update update.value[currentState, prevState];
                // if explorer is undefined && prevState has values, that means component has been removed
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
        this.setupSystem(this.setup.components.HyperstructureRequirements, callback, (update: any) => {
          const structure = getComponentValue(
            this.setup.components.Structure,
            getEntityIdFromKeys([BigInt(update.value[0].hyperstructure_entity_id)]),
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
        this.setupSystem(this.setup.components.Tile, callback, (update: any) => {
          if (isComponentUpdate(update, this.setup.components.Tile)) {
            const [currentState, _prevState] = update.value;

            const structureInfo = currentState && getStructureInfoFromTileOccupier(currentState?.occupier_type);

            if (!structureInfo) return;

            const hyperstructure = getComponentValue(
              this.setup.components.Hyperstructure,
              getEntityIdFromKeys([BigInt(currentState.occupier_id)]),
            );

            const initialized = hyperstructure?.initialized || false;

            const owner = getComponentValue(
              this.setup.components.Structure,
              getEntityIdFromKeys([BigInt(currentState.occupier_id)]),
            )?.owner;

            const ownerName = owner ? getAddressName(owner, this.setup.components) : undefined;

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
              owner: { address: owner || 0n, ownerName: ownerName || "", guildName: "" },
              hasWonder: structureInfo.hasWonder,
            };
          }
        });
      },
    };
  }

  public get Tile() {
    return {
      onUpdate: (callback: (value: TileSystemUpdate) => void) => {
        this.setupSystem(this.setup.components.Tile, callback, (update: any) => {
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
          (update: any) => {
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

              const questTile = getComponentValue(
                this.setup.components.QuestTile,
                getEntityIdFromKeys([BigInt(currentState?.occupier_id)]),
              );

              if (!questTile) return;

              console.log("questTile", questTile);

              return {
                entityId: update.entity,
                id: questTile.id,
                gameAddress: questTile.game_address,
                hexCoords: { col: questTile.coord.x, row: questTile.coord.y },
                capacity: questTile.capacity,
                level: questTile.level,
                resourceType: questTile.resource_type,
                amount: questTile.amount,
                participantCount: questTile.participant_count,
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
}
