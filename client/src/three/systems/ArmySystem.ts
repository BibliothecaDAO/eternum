import { defineComponentSystem, getComponentValue } from "@dojoengine/recs";
import { SetupResult } from "@/dojo/setup";
import WorldmapScene from "../scenes/Worldmap";
import { getColRowFromUIPosition, getUIPositionFromColRow } from "@/ui/utils/utils";
import { FELT_CENTER } from "@/ui/config";
import { ArmyManager } from "../components/ArmyManager";
import { Scene } from "three";

export class ArmySystem {
  private armyManager: ArmyManager;
  private armyIndices: Map<string, number> = new Map();
  private modelPrinted: boolean = false;

  constructor(private dojo: SetupResult, private worldMapScene: WorldmapScene) {
    // this.armyManager = new ArmyManager(this.worldMapScene, "models/dark_knight.glb", 1000);
    this.armyManager = new ArmyManager(this.worldMapScene, "models/biomes/Horse.glb", 1000);
  }

  setupSystem() {
    defineComponentSystem(this.dojo.network.world, this.dojo.components.Position, (update) => {
      const { value } = update;

      const army = getComponentValue(this.dojo.components.Army, update.entity);
      if (!army) return;

      this.updateArmies(Number(army.entity_id), value[0]?.x || 0, value[0]?.y || 0);
    });

    console.log("Army system setup complete");
  }

  private async updateArmies(entityId: number, col: number, row: number) {
    console.log({ entityId });
    const normalizedCoord = { col: col - FELT_CENTER, row: row - FELT_CENTER };
    await this.armyManager.loadPromise;
    if (!this.modelPrinted) {
      this.armyManager.printModel();
      console.log("print army");
      this.modelPrinted = true;
    }

    try {
      this.armyManager.updateArmy(entityId, normalizedCoord);
    } catch (error) {
      console.error("Error updating army:", error);
    }

    // // Move army once after 5 seconds
    // // testing
    // if (entityId === 41) {
    //   console.log("adding timeout ");
    //   setTimeout(() => {
    //     this.armyManager.moveArmy(entityId, { col: normalizedCoord.col + 1, row: normalizedCoord.row + 1 });
    //   }, 15000);
    // }
  }

  update(deltaTime: number) {
    this.armyManager.update(deltaTime);
  }
}
