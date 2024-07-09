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

  private updateArmies(entityId: string, col: number, row: number) {
    const normalizedCoord = { col: col - FELT_CENTER, row: row - FELT_CENTER };
    console.log({ normalizedCoord, type: "army" });

    // const uiCoords2 = this.worldMapScene.getWorldPositionForHex({ col: x, row: y });

    try {
      if (!this.armyIndices.has(entityId)) {
        // Create a new army instance if it doesn't exist
        const index = this.armyManager.addCharacter(normalizedCoord);
        this.armyIndices.set(entityId, index);
      } else {
        // Update the existing army's position
        const index = this.armyIndices.get(entityId)!;
        this.armyManager.moveCharacter(index, { col, row });
      }
    } catch (error) {
      console.error("Error updating army:", error);
    }
  }
}
