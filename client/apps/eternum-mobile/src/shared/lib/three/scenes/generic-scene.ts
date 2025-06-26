import { DojoResult } from "@bibliothecadao/react";
import * as THREE from "three";
import { SCENE_COLORS } from "../constants";
import { BaseScene } from "./base-scene";

export class GenericScene implements BaseScene {
  private scene: THREE.Scene;
  private sceneId: string;
  private dojo: DojoResult;

  constructor(sceneId: string, dojo: DojoResult) {
    this.sceneId = sceneId;
    this.dojo = dojo;
    this.scene = new THREE.Scene();
    this.createScene();
  }

  private createScene(): void {
    this.addDummyObjects();
    this.addLighting();
  }

  private addDummyObjects(): void {
    const colors = SCENE_COLORS[this.sceneId as keyof typeof SCENE_COLORS] || SCENE_COLORS.worldmap;

    // Create ground plane
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshLambertMaterial({ color: colors.plane });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
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

  public update(camera: THREE.Camera): void {
    // Generic scenes don't need updates by default
    // Can be overridden by specific scene implementations
  }

  public handleClick(mouse: THREE.Vector2, camera: THREE.Camera): void {
    // Generic click handling - can be overridden
    console.log(`Click on ${this.sceneId} scene`);
  }

  public dispose(): void {
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

  public getDojo(): DojoResult {
    return this.dojo;
  }
}
