import { defineComponentSystem, getComponentValue } from "@dojoengine/recs";
// import { ChunkManager, OFFSET } from "./ChunkManager";
import * as THREE from "three";
import { SetupResult } from "@/dojo/setup";
import { StructureType } from "@bibliothecadao/eternum";
import { StructureManager } from "../components/StructureManager";
import { FELT_CENTER } from "@/ui/config";
import WorldmapScene from "../scenes/Worldmap";

export class StructureSystem {
  structureManager: StructureManager;
  constructor(private dojo: SetupResult, private worldMapScene: WorldmapScene) {
    this.structureManager = new StructureManager(worldMapScene, "models/buildings/castle.glb", 1000);
  }

  setupSystem() {
    defineComponentSystem(this.dojo.network.world, this.dojo.components.Position, (update) => {
      const { value } = update;

      const structure = getComponentValue(this.dojo.components.Structure, update.entity);
      if (!structure) return;

      const categoryKey = structure.category as keyof typeof StructureType;
      this.updateStructures(update.entity, value[0]?.x || 0, value[0]?.y || 0, StructureType[categoryKey]);
    });
  }

  private async updateStructures(entityId: string, col: number, row: number, structureType: StructureType) {
    await this.structureManager.loadPromise;
    const normalizedCoord = { col: col - FELT_CENTER, row: row - FELT_CENTER };
    this.structureManager.updateInstanceMatrix(entityId, normalizedCoord);
  }
}
