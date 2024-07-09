import { defineComponentSystem, getComponentValue } from "@dojoengine/recs";
// import { ChunkManager, OFFSET } from "./ChunkManager";
import { shortString } from "starknet";
import * as THREE from "three";
import { SetupResult } from "@/dojo/setup";
import WorldmapScene from "../scenes/Worldmap";

export class ArmySystem {
  constructor(private dojo: SetupResult, private worldMapScene: WorldmapScene) {}

  setupSystem() {
    defineComponentSystem(this.dojo.network.world, this.dojo.components.Position, (update) => {
      const { value } = update;

      const army = getComponentValue(this.dojo.components.Army, update.entity);
      if (!army) return;

      this.updateArmies(value[0]?.x || 0, value[0]?.y || 0);
    });
  }

  private updateArmies(x: number, y: number) {
    console.log({ x, y, type: "army" });
    // const chunkX = Math.floor((x - OFFSET) / this.chunkManager.chunkSize);
    // const chunkZ = Math.floor((y - OFFSET) / this.chunkManager.chunkSize);
    // const chunkKey = `${chunkX},${chunkZ}`;
    // if (this.chunkManager.loadedChunks.has(chunkKey)) {
    //   const chunk = this.chunkManager.loadedChunks.get(chunkKey)!;
    //   let localX = (x - OFFSET) % this.chunkManager.chunkSize;
    //   let localZ = (y - OFFSET) % this.chunkManager.chunkSize;
    //   // Ensure localX and localZ are always positive
    //   if (localX < 0) localX += this.chunkManager.chunkSize;
    //   if (localZ < 0) localZ += this.chunkManager.chunkSize;
    //   // Swap X and Z when calculating the index
    //   const tileIndex = localZ + localX * this.chunkManager.chunkSize;
    //   // console.log(`World coordinates: (${x}, ${y})`);
    //   // console.log(`Chunk coordinates: (${chunkX}, ${chunkZ})`);
    //   // console.log(`Local coordinates: (${localX}, ${localZ})`);
    //   // console.log(`Updating tile at index ${tileIndex}`);
    //   const tile = chunk.children[tileIndex] as THREE.Mesh;
    //   if (tile instanceof THREE.Mesh) {
    //     const material = tile.material as THREE.MeshBasicMaterial;
    //     material.color.setHex(parseInt(shortString.decodeShortString(value)));
    //     material.opacity = 0.5;
    //   } else {
    //     console.log(`Tile not found at index ${tileIndex}`);
    //   }
    // } else {
    //   console.log(`Chunk not loaded for tile at (${x}, ${y})`);
    // }
  }
}
