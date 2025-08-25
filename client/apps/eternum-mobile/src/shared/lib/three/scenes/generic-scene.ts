import { DojoResult } from "@bibliothecadao/react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SCENE_COLORS } from "../constants/constants";
import { BaseScene } from "./base-scene";

export class GenericScene extends BaseScene {
  constructor(sceneId: string, dojo: DojoResult, controls?: OrbitControls) {
    super(dojo, sceneId, controls);
    this.createScene();
  }

  private createScene(): void {
    this.addDummyObjects();
  }

  private addDummyObjects(): void {
    const colors = SCENE_COLORS[this.sceneId as keyof typeof SCENE_COLORS] || SCENE_COLORS.worldmap;

    // Create ground plane
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshLambertMaterial({ color: colors.plane });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    this.scene.add(plane);

    // Create box
    const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
    const boxMaterial = new THREE.MeshLambertMaterial({ color: colors.box });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.set(0, 1, 0);
    box.castShadow = true;
    this.scene.add(box);
  }

  public update(camera: THREE.Camera): void {
    // Generic scenes don't need updates by default
  }

  public handleClick(mouse: THREE.Vector2, camera: THREE.Camera): void {
    console.log(`Click on ${this.sceneId} scene`);
  }
}
