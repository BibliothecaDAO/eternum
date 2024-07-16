import { SetupResult } from "@/dojo/setup";
import WorldmapScene from "../scenes/Worldmap";
import { ArmySystem } from "./ArmySystem";
import { StructureSystem } from "./StructureSystem";

export class SystemManager {
  public armySystem: ArmySystem;
  public structureSystem: StructureSystem;

  constructor(private dojo: SetupResult, private worldMapScene: WorldmapScene) {
    this.armySystem = new ArmySystem(this.dojo, this.worldMapScene);
    this.armySystem.setupSystem();
    this.structureSystem = new StructureSystem(this.dojo, this.worldMapScene);
    this.structureSystem.setupSystem();
  }

  update(deltaTime: number) {
    this.armySystem.update(deltaTime);
  }
}
