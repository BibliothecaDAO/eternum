import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import InstancedModel from "./InstancedModel";

export class ArmyManager {
  private instancedModel: InstancedModel | undefined;
  private characters: Character[] = [];
  private dummy: THREE.Object3D = new THREE.Object3D();
  private isLoaded: boolean = false;
  private loadPromise: Promise<void>;

  constructor(scene: THREE.Scene, modelPath: string, maxInstances: number) {
    this.loadPromise = new Promise<void>((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        modelPath,
        (gltf) => {
          this.instancedModel = new InstancedModel(gltf.scene, maxInstances);
          scene.add(this.instancedModel.group);
          this.isLoaded = true;
          resolve();
        },
        undefined,
        (error) => {
          console.error("An error occurred while loading the model:", error);
          reject(error);
        },
      );
    });
  }

  async addCharacter(position: { x: number; y: number }): Promise<number> {
    await this.loadPromise;
    const index = this.characters.length;
    const character = new Character(position, index);
    this.characters.push(character);
    this.updateInstanceMatrix(character);
    return index;
  }

  moveCharacter(index: number, newPosition: { x: number; y: number }) {
    const character = this.characters[index];
    character.moveToHex(newPosition);
    this.updateInstanceMatrix(character);
  }

  private updateInstanceMatrix(character: Character) {
    const position = this.calculateWorldPosition(character.getPosition());
    this.dummy.position.copy(position);
    this.dummy.scale.set(0.005, 0.005, 0.005);
    this.dummy.updateMatrix();
    this.instancedModel?.setMatrixAt(character.index, this.dummy.matrix);
    this.instancedModel?.needsUpdate();
  }

  private calculateWorldPosition(hexPosition: { x: number; y: number }): THREE.Vector3 {
    const { x, y } = hexPosition;
    const hexSize = 1;
    const horizontalSpacing = hexSize * Math.sqrt(3);
    const verticalSpacing = (hexSize * 3) / 2;

    const worldX = x * horizontalSpacing + (y % 2) * (horizontalSpacing / 2);
    const z = -y * verticalSpacing;
    const worldY = 0.5;

    return new THREE.Vector3(worldX, worldY, z);
  }
}

class Character {
  private currentHexPosition: { x: number; y: number };
  public index: number;

  constructor(initialPosition: { x: number; y: number }, index: number) {
    this.currentHexPosition = initialPosition;
    this.index = index;
  }

  moveToHex(newPosition: { x: number; y: number }) {
    this.currentHexPosition = newPosition;
  }

  getPosition(): { x: number; y: number } {
    return this.currentHexPosition;
  }
}
