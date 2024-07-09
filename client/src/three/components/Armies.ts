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
          this.instancedModel.setCount(0);
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

  addCharacter(position: { col: number; row: number }): number {
    if (!this.isLoaded) {
      throw new Error("Model not loaded yet");
    }
    const index = this.characters.length;
    const character = new Character(position, index);
    this.characters.push(character);
    this.updateInstanceMatrix(character);
    return index;
  }

  moveCharacter(index: number, newPosition: { col: number; row: number }) {
    const character = this.characters[index];
    character.moveToHex(newPosition);
    this.updateInstanceMatrix(character);
  }

  private updateInstanceMatrix(character: Character) {
    const position = this.calculateWorldPosition(character.getPosition());
    this.dummy.position.copy(position);
    // this.dummy.scale.set(0.005, 0.005, 0.005);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    console.log({ instancedModel: this.instancedModel });
    this.instancedModel?.setMatrixAt(character.index, this.dummy.matrix);
    this.instancedModel?.setCount(this.characters.length);
  }

  private calculateWorldPosition(hexCoords: { col: number; row: number }): THREE.Vector3 {
    const { row, col } = hexCoords;
    const hexSize = 1; // Make sure this matches the hexSize in HexagonMap
    const horizontalSpacing = hexSize * Math.sqrt(3);
    const verticalSpacing = (hexSize * 3) / 2;

    const x = col * horizontalSpacing + (row % 2) * (horizontalSpacing / 2);
    const z = -row * verticalSpacing;
    const y = 0; // Adjust this value to place the character on top of the hexagons

    // return new THREE.Vector3(x, y, z);
    return new THREE.Vector3(0, 5, 0);
  }
}

class Character {
  private currentHexPosition: { col: number; row: number };
  public index: number;

  constructor(initialPosition: { col: number; row: number }, index: number) {
    this.currentHexPosition = initialPosition;
    this.index = index;
  }

  moveToHex(newPosition: { col: number; row: number }) {
    this.currentHexPosition = newPosition;
  }

  getPosition(): { col: number; row: number } {
    return this.currentHexPosition;
  }
}
