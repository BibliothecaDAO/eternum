import { defineComponentSystem, getComponentValue } from "@dojoengine/recs";
import { SetupResult } from "@/dojo/setup";
import { StructureType } from "@bibliothecadao/eternum";
import { ArmySystemUpdate, StructureSystemUpdate, TileSystemUpdate } from "./types";

export class SystemManager {
  constructor(private dojo: SetupResult) {}

  private setupArmySystem(callback: (value: ArmySystemUpdate) => void) {
    defineComponentSystem(this.dojo.network.world, this.dojo.components.Position, (update) => {
      const { value } = update;

      const army = getComponentValue(this.dojo.components.Army, update.entity);
      if (!army) return;

      const owner = getComponentValue(this.dojo.components.Owner, update.entity);
      const isMine = owner?.address === BigInt(this.dojo.network.burnerManager.account?.address || 0);

      callback({
        entityId: Number(army.entity_id),
        hexCoords: { col: value[0]?.x || 0, row: value[0]?.y || 0 },
        isMine,
      });
    });
  }

  private setupStructureSystem(callback: (value: StructureSystemUpdate) => void) {
    defineComponentSystem(this.dojo.network.world, this.dojo.components.Position, (update) => {
      const { value } = update;

      const structure = getComponentValue(this.dojo.components.Structure, update.entity);
      if (!structure) return;

      const owner = getComponentValue(this.dojo.components.Owner, update.entity);
      const isMine = owner?.address === BigInt(this.dojo.network.burnerManager.account?.address || 0);

      const categoryKey = structure.category as keyof typeof StructureType;

      callback({
        entityId: Number(structure.entity_id),
        hexCoords: { col: value[0]?.x || 0, row: value[0]?.y || 0 },
        structureType: StructureType[categoryKey],
        isMine,
      });
    });
  }

  private setupTileSystem(callback: (value: TileSystemUpdate) => void) {
    defineComponentSystem(this.dojo.network.world, this.dojo.components.Tile, (update) => {
      const { value } = update;

      if (!value[0]) return;

      callback({ hexCoords: { col: Number(value[0].col), row: Number(value[0].row) } });
    });
  }

  public get Army() {
    return {
      onUpdate: (callback: (value: ArmySystemUpdate) => void) => {
        this.setupArmySystem(callback);
      },
    };
  }

  public get Structure() {
    return {
      onUpdate: (callback: (value: StructureSystemUpdate) => void) => {
        this.setupStructureSystem(callback);
      },
    };
  }

  public get Tile() {
    return {
      onUpdate: (callback: (value: TileSystemUpdate) => void) => {
        this.setupTileSystem(callback);
      },
    };
  }
}
