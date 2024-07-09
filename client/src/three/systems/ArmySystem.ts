import { defineComponentSystem, getComponentValue } from "@dojoengine/recs";
// import { ChunkManager, OFFSET } from "./ChunkManager";
import { shortString } from "starknet";
import * as THREE from "three";
import { SetupResult } from "@/dojo/setup";
import WorldmapScene from "../scenes/Worldmap";
import { Character } from "../components/Army";
import { getColRowFromUIPosition } from "@/ui/utils/utils";
import { FELT_CENTER } from "@/ui/config";

export class ArmySystem {
  private armies: Map<string, Character> = new Map();

  constructor(private dojo: SetupResult, private worldMapScene: WorldmapScene) {}

  setupSystem() {
    defineComponentSystem(this.dojo.network.world, this.dojo.components.Position, (update) => {
      const { value } = update;

      const army = getComponentValue(this.dojo.components.Army, update.entity);
      if (!army) return;

      this.updateArmies(update.entity, value[0]?.x || 0, value[0]?.y || 0);
    });
  }

  private updateArmies(entityId: string, x: number, y: number) {
    const normalizedCoord = { x: x - FELT_CENTER, y: y - FELT_CENTER };
    console.log({ normalizedCoord, type: "army" });

    const uiCoords = getColRowFromUIPosition(x, y);

    if (!this.armies.has(entityId)) {
      // Create a new Character if it doesn't exist
      this.armies.set(entityId, new Character(this.worldMapScene.scene, uiCoords));
    } else {
      // Update the existing Character's position
      const army = this.armies.get(entityId)!;
      army.moveToHex(uiCoords);
    }
  }
}
