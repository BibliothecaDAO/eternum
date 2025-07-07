import { DojoResult } from "@bibliothecadao/react";
import * as THREE from "three";
import { BaseScene } from "./base-scene";
import { HexagonMap } from "./hexagon-map";

export class WorldmapScene extends BaseScene {
  private hexagonMap!: HexagonMap;

  constructor(dojo: DojoResult) {
    super(dojo, "WorldMap");
    this.createScene();
  }

  private createScene(): void {
    this.createHexagonMap();
  }

  private createHexagonMap(): void {
    this.hexagonMap = new HexagonMap(this.scene, this.dojo, this.systemManager);
  }

  public getHexagonMap(): HexagonMap {
    return this.hexagonMap;
  }

  public update(camera: THREE.Camera): void {
    // Update chunk loading based on camera position
    this.hexagonMap.updateChunkLoading(camera.position);
  }

  public handleClick(mouse: THREE.Vector2, camera: THREE.Camera): void {
    this.hexagonMap.handleClick(mouse, camera);
  }

  public dispose(): void {
    this.hexagonMap.dispose();
    super.dispose();
  }
}
