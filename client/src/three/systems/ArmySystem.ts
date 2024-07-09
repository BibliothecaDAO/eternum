import { defineComponentSystem, getComponentValue } from "@dojoengine/recs";
import { SetupResult } from "@/dojo/setup";
import WorldmapScene from "../scenes/Worldmap";
import { getColRowFromUIPosition, getUIPositionFromColRow } from "@/ui/utils/utils";
import { FELT_CENTER } from "@/ui/config";
import { ArmyManager } from "../components/Armies";

export class ArmySystem {
  private armyManager: ArmyManager;
  private armyIndices: Map<string, number> = new Map();

  constructor(private dojo: SetupResult, private worldMapScene: WorldmapScene) {
    this.armyManager = new ArmyManager(this.worldMapScene.scene, "models/dark_knight.glb", 1000);
  }

  setupSystem() {
    defineComponentSystem(this.dojo.network.world, this.dojo.components.Position, (update) => {
      const { value } = update;

      const army = getComponentValue(this.dojo.components.Army, update.entity);
      if (!army) return;

      this.updateArmies(update.entity, value[0]?.x || 0, value[0]?.y || 0);
    });

    console.log("Army system setup complete");
  }

  private async updateArmies(entityId: string, x: number, y: number) {
    const normalizedCoord = { x: x - FELT_CENTER, y: y - FELT_CENTER };
    console.log({ normalizedCoord, type: "army" });

    const uiCoords = getUIPositionFromColRow(x, y);

    try {
      if (!this.armyIndices.has(entityId)) {
        // Create a new army instance if it doesn't exist
        const index = await this.armyManager.addCharacter(uiCoords);
        this.armyIndices.set(entityId, index);
      } else {
        // Update the existing army's position
        const index = this.armyIndices.get(entityId)!;
        this.armyManager.moveCharacter(index, uiCoords);
      }
    } catch (error) {
      console.error("Error updating army:", error);
    }
  }
}
