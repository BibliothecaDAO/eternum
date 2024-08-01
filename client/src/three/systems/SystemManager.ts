import { defineComponentSystem, getComponentValue } from "@dojoengine/recs";
import { SetupResult } from "@/dojo/setup";
import WorldmapScene from "../scenes/Worldmap";

export class SystemManager {
  private armyCallbacks: ((value: any) => void)[] = [];
  private structureCallbacks: ((value: any) => void)[] = [];
  private tileCallbacks: ((value: any) => void)[] = [];

  constructor(private dojo: SetupResult) {
    this.setupArmySystem();
    this.setupStructureSystem();
    this.setupTileSystem();
  }

  private setupArmySystem() {
    defineComponentSystem(this.dojo.network.world, this.dojo.components.Position, (update) => {
      const { value } = update;
      console.log({ value });

      const army = getComponentValue(this.dojo.components.Army, update.entity);
      if (!army) return;

      this.armyCallbacks.forEach((callback) => {
        callback(value);
      });
    });
  }

  private setupStructureSystem() {
    defineComponentSystem(this.dojo.network.world, this.dojo.components.Position, (update) => {
      const { value } = update;

      const structure = getComponentValue(this.dojo.components.Structure, update.entity);
      if (!structure) return;

      this.structureCallbacks.forEach((callback) => {
        callback(value);
      });
    });
  }

  private setupTileSystem() {
    defineComponentSystem(this.dojo.network.world, this.dojo.components.Tile, (update) => {
      const { value } = update;

      if (!value[0]) return;

      this.tileCallbacks.forEach((callback) => {
        callback(value[0]);
      });
    });
  }

  public get Army() {
    return {
      onUpdate: (callback: (value: any) => void) => {
        this.armyCallbacks.push(callback);
      },
    };
  }

  public get Structure() {
    return {
      onUpdate: (callback: (value: any) => void) => {
        this.structureCallbacks.push(callback);
      },
    };
  }

  public get Tile() {
    return {
      onUpdate: (callback: (value: any) => void) => {
        this.tileCallbacks.push(callback);
      },
    };
  }
}
