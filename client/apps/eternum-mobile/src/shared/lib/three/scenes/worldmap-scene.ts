import { DojoResult } from "@bibliothecadao/react";
import * as THREE from "three";
import { SystemManager } from "../system/system-manager";
import { BaseScene } from "./base-scene";
import { HexagonMap } from "./hexagon-map";

export class WorldmapScene implements BaseScene {
  private scene: THREE.Scene;
  private hexagonMap!: HexagonMap;
  private systemManager!: SystemManager;
  private dojo: DojoResult;

  constructor(dojo: DojoResult) {
    this.dojo = dojo;
    this.scene = new THREE.Scene();
    this.systemManager = new SystemManager(this.dojo.setup);
    this.createScene();
  }

  private createScene(): void {
    this.addLighting();
    this.createHexagonMap();
  }

  private createHexagonMap(): void {
    this.hexagonMap = new HexagonMap(this.scene, this.dojo, this.systemManager);
  }

  private addLighting(): void {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Directional light for shadows and depth
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getHexagonMap(): HexagonMap {
    return this.hexagonMap;
  }

  public getDojo(): DojoResult {
    return this.dojo;
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

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
}
