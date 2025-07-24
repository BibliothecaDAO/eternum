import { DojoResult } from "@bibliothecadao/react";
import throttle from "lodash/throttle";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BaseScene } from "./base-scene";
import { HexagonMap } from "./hexagon-map";

export class WorldmapScene extends BaseScene {
  private hexagonMap!: HexagonMap;
  private throttledUpdateChunkLoading?: () => void;

  constructor(dojo: DojoResult, controls?: OrbitControls) {
    super(dojo, "WorldMap", controls);
    this.createScene();
    this.setupControlsListener();
  }

  private createScene(): void {
    this.createHexagonMap();
  }

  private createHexagonMap(): void {
    this.hexagonMap = new HexagonMap(this.scene, this.dojo, this.systemManager, this.fxManager);
  }

  private setupControlsListener(): void {
    if (!this.controls) return;

    this.throttledUpdateChunkLoading = throttle(() => {
      if (this.controls) {
        this.hexagonMap.updateChunkLoading(this.controls.target);
      }
    }, 30);

    this.controls.addEventListener("change", this.throttledUpdateChunkLoading);
  }

  public getHexagonMap(): HexagonMap {
    return this.hexagonMap;
  }

  public update(camera: THREE.Camera): void {
    // Chunk loading is now handled by controls listener
  }

  public handleClick(mouse: THREE.Vector2, camera: THREE.Camera): void {
    this.hexagonMap.handleClick(mouse, camera);
  }

  public dispose(): void {
    if (this.controls && this.throttledUpdateChunkLoading) {
      this.controls.removeEventListener("change", this.throttledUpdateChunkLoading);
    }
    this.hexagonMap.dispose();
    super.dispose();
  }
}
