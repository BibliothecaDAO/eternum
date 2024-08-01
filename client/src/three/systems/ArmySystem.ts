import { defineComponentSystem, getComponentValue } from "@dojoengine/recs";
import { SetupResult } from "@/dojo/setup";
import WorldmapScene from "../scenes/Worldmap";
import { getColRowFromUIPosition, getUIPositionFromColRow } from "@/ui/utils/utils";
import { FELT_CENTER } from "@/ui/config";
import { ArmyManager } from "../components/ArmyManager";
import { Scene } from "three";

export class ArmySystem {
  private armyManager: ArmyManager;

  constructor(private dojo: SetupResult, private worldMapScene: WorldmapScene, armyManager: ArmyManager) {
    // this.armyManager = new ArmyManager(this.worldMapScene, "models/biomes/Horse.glb", 1000);
    this.armyManager = armyManager;
  }

  setupSystem() {
    defineComponentSystem(this.dojo.network.world, this.dojo.components.Position, (update) => {
      const { value } = update;

      const army = getComponentValue(this.dojo.components.Army, update.entity);
      if (!army) return;

      const owner = getComponentValue(this.dojo.components.Owner, update.entity);
      const isMine = owner?.address === BigInt(this.dojo.network.burnerManager.account?.address || 0);

      this.armyManager.onUpdate(Number(army.entity_id), value[0]?.x || 0, value[0]?.y || 0, isMine);
    });

    console.log("Army system setup complete");
  }

  update(deltaTime: number) {
    this.armyManager.update(deltaTime);
  }
}
