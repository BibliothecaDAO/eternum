import {
  BiomeIdToType,
  BiomeType,
  ClientComponents,
  configManager,
  divideByPrecision,
  ID,
  RealmLevels,
  SetupResult,
  StructureType,
  type HexPosition,
} from "@bibliothecadao/eternum";
import {
  Component,
  ComponentValue,
  defineComponentSystem,
  defineQuery,
  getComponentValue,
  Has,
  HasValue,
  isComponentUpdate,
  runQuery,
} from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { PROGRESS_FINAL_THRESHOLD, PROGRESS_HALF_THRESHOLD } from "../scenes/constants";
import {
  ArmySystemUpdate,
  BuildingSystemUpdate,
  StructureProgress,
  StructureSystemUpdate,
  TileSystemUpdate
} from "../types";

// The SystemManager class is responsible for updating the Three.js models when there are changes in the game state.
// It listens for updates from torii and translates them into a format that can be consumed by the Three.js model managers.
export class SystemManager {
  constructor(private setup: SetupResult) {}

  private setupSystem<T>(
    component: Component,
    callback: (value: T) => void,
    getUpdate: (update: any) => T | undefined,
    runOnInit: boolean = true,
    maxRetries: number = 10,
    retryDelay: number = 500,
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

    defineComponentSystem(this.setup.network.world, component, handleUpdate, { runOnInit });
  }

  public get Army() {
    return {
      onUpdate: (callback: (value: ArmySystemUpdate) => void) => {
        const query = defineQuery([Has(this.setup.components.ExplorerTroops)], { runOnInit: true });

        return query.update$.subscribe((update) => {
          if (isComponentUpdate(update, this.setup.components.ExplorerTroops)) {
            const explorer = getComponentValue(this.setup.components.ExplorerTroops, update.entity);
            if (!explorer) return;

            const structure = getComponentValue(this.setup.components.Structure, getEntityIdFromKeys([BigInt(explorer.owner)]));
            if (!structure) return;

            const owner = structure.owner;

            const addressName = getComponentValue(
              this.setup.components.AddressName,
              getEntityIdFromKeys([BigInt(owner || 0)]),
            );

            const ownerName = addressName ? shortString.decodeShortString(addressName.name.toString()) : "";

            const guild = getComponentValue(this.setup.components.GuildMember, getEntityIdFromKeys([owner || 0n]));

            let guildName = "";
            if (guild?.guild_entity_id) {
              const guildEntityName = getComponentValue(
                this.setup.components.AddressName,
                getEntityIdFromKeys([BigInt(guild.guild_entity_id)]),
              );
              guildName = guildEntityName?.name ? shortString.decodeShortString(guildEntityName.name.toString()) : "";
            }

            callback({
              entityId: explorer.explorer_id,
              hexCoords: { col: explorer.coord.x, row: explorer.coord.y },
              // todo: fix this
              battleId: 0,
              defender: false,
              // todo: fix this
              currentHealth: 1n,
              order: structure.metadata.order,
              owner: { address: owner || 0n, ownerName, guildName },
            });
          }
        });
      },
    };
  }

  public get Structure() {
    return {
      onContribution: (callback: (value: { entityId: ID; structureType: StructureType; stage: number }) => void) => {
        this.setupSystem(this.setup.components.Progress, callback, (update: any) => {
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
        this.setupSystem(this.setup.components.Structure, callback, (update: any) => {
          const structure = getComponentValue(this.setup.components.Structure, update.entity);
          if (!structure) return;

          const stage = this.getStructureStage(structure.base.category as StructureType, structure.entity_id);

          let level = 0;
          let hasWonder = false;
          if (structure.base.category === StructureType.Realm) {
            level = structure.base.level || RealmLevels.Settlement;
            hasWonder = structure.metadata.has_wonder || false;
          }

          return {
            entityId: structure.entity_id,
            hexCoords: { col: structure.base.coord_x, row: structure.base.coord_y },
            structureType: structure.base.category as StructureType,
            stage,
            level,
            owner: { address: structure.owner },
            hasWonder,
          };
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
            biome: newStateBiomeType === BiomeType.None ? BiomeType.Grassland : newStateBiomeType || BiomeType.Grassland,
          };
        });
      },
    };
  }

  public get Buildings() {
    return {
      subscribeToHexUpdates: (hexCoords: HexPosition, callback: (value: BuildingSystemUpdate) => void) => {
        const query = defineQuery([
          HasValue(this.setup.components.Building, {
            outer_col: hexCoords.col,
            outer_row: hexCoords.row,
          }),
        ]);

        return query.update$.subscribe((update) => {
          if (isComponentUpdate(update, this.setup.components.Building)) {
            const building = getComponentValue(this.setup.components.Building, update.entity);
            if (!building) return;

            const innerCol = building.inner_col;
            const innerRow = building.inner_row;
            const buildingType = building.category;
            const paused = building.paused;

            callback({
              buildingType,
              innerCol,
              innerRow,
              paused,
            });
          }
        });
      },
    };
  }

  private getHexCoords(value: any): { col: number; row: number } {
    return { col: value[0]?.x || 0, row: value[0]?.y || 0 };
  }

  public getStructureStage(structureType: StructureType, entityId: ID): number {
    if (structureType === StructureType.Hyperstructure) {
      const progressQueryResult = Array.from(
        runQuery([
          Has(this.setup.components.Progress),
          HasValue(this.setup.components.Progress, { hyperstructure_entity_id: entityId }),
        ]),
      );

      const progresses = progressQueryResult.map((progressEntityId) => {
        return getComponentValue(this.setup.components.Progress, progressEntityId);
      });

      const { percentage } = this.getAllProgressesAndTotalPercentage(progresses, entityId);
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

  private getAllProgressesAndTotalPercentage = (
    progresses: (ComponentValue<ClientComponents["Progress"]["schema"]> | undefined)[],
    hyperstructureEntityId: ID,
  ) => {
    let percentage = 0;
    const allProgresses = configManager
      .getHyperstructureRequiredAmounts(hyperstructureEntityId)
      .map(({ resource, amount: resourceCost }) => {
        let foundProgress = progresses.find((progress) => progress!.resource_type === resource);
        const resourcePercentage = !foundProgress
          ? 0
          : Math.floor((divideByPrecision(Number(foundProgress.amount)) / resourceCost!) * 100);
        let progress = {
          hyperstructure_entity_id: hyperstructureEntityId,
          resource_type: resource,
          amount: !foundProgress ? 0 : divideByPrecision(Number(foundProgress.amount)),
          percentage: resourcePercentage,
          costNeeded: resourceCost,
        };
        percentage += resourcePercentage;
        return progress;
      });
    const totalPercentage = percentage / allProgresses.length;
    return { allProgresses, percentage: totalPercentage };
  };
}
