import { defineComponentSystem, getComponentValue } from "@dojoengine/recs";
// import { ChunkManager, OFFSET } from "./ChunkManager";
import * as THREE from "three";
import { SetupResult } from "@/dojo/setup";
import { StructureType } from "@bibliothecadao/eternum";
import { StructureManager } from "../components/StructureManager";
import { FELT_CENTER } from "@/ui/config";
import WorldmapScene from "../scenes/Worldmap";

const MODEL_PATH = "models/buildings/castle2.glb";
const LABEL_PATH = "textures/realm_label.png";

export class StructureSystem {
  structureManager: StructureManager;
  structuresList: { col: number; row: number }[] = [];

  constructor(private dojo: SetupResult, private worldMapScene: WorldmapScene) {
    this.structureManager = new StructureManager(worldMapScene, MODEL_PATH, LABEL_PATH, 1000);
  }

  setupSystem() {
    defineComponentSystem(this.dojo.network.world, this.dojo.components.Position, (update) => {
      const { value } = update;

      const structure = getComponentValue(this.dojo.components.Structure, update.entity);
      if (!structure) return;

      const owner = getComponentValue(this.dojo.components.Owner, update.entity);
      const isMine = owner?.address === BigInt(this.dojo.network.burnerManager.account?.address || 0);

      const categoryKey = structure.category as keyof typeof StructureType;
      this.updateStructures(
        Number(structure.entity_id),
        value[0]?.x || 0,
        value[0]?.y || 0,
        StructureType[categoryKey],
        isMine,
      );
    });
  }

  private async updateStructures(
    entityId: number,
    col: number,
    row: number,
    structureType: StructureType,
    isMine: boolean = false,
  ) {
    await this.structureManager.loadPromise;
    const normalizedCoord = { col: col - FELT_CENTER, row: row - FELT_CENTER };
    this.structuresList.push(normalizedCoord);

    this.structureManager.updateInstanceMatrix(entityId, normalizedCoord, isMine);
  }

  getStructures() {
    return this.structuresList;
  }
}
