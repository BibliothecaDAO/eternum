import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import InstancedModel from "./InstancedModel";

export class ArmyManager {
  private instancedModel: InstancedModel | undefined;
  private characters: Character[] = [];
  private dummy: THREE.Object3D = new THREE.Object3D();
  private isLoaded: boolean = false;
  loadPromise: Promise<void>;
  private animationClip: THREE.AnimationClip | undefined;
  private interval: any;

  constructor(scene: THREE.Scene, modelPath: string, maxInstances: number) {
    this.loadPromise = new Promise<void>((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        modelPath,
        (gltf) => {
          this.instancedModel = new InstancedModel(gltf.scene, maxInstances);
          this.instancedModel.scaleModel(new THREE.Vector3(1, 1, 1));
          this.instancedModel.setCount(0);
          scene.add(this.instancedModel.group);
          this.isLoaded = true;

          // Log animations for debugging
          console.log("Loaded animations:", gltf.animations);

          // Store the animation clip instead of creating a mixer here
          const animations = gltf.animations;
          if (animations && animations.length > 0) {
            this.animationClip = animations[0];
          }

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

  printModel() {
    console.log({ instancedModel: this.instancedModel });
    this.instancedModel?.group.children.forEach((child) => {
      console.log({ name: child.name, child });
    });
  }

  addCharacter(position: { col: number; row: number }): number {
    if (!this.isLoaded) {
      throw new Error("Model not loaded yet");
    }
    const index = this.characters.length;
    const character = new Character(position, index, this.animationClip);
    this.characters.push(character);
    this.updateInstanceMatrix(character);

    this.interval = setInterval(() => {
      console.log("move character");
      this.moveCharacter(index, {
        col: this.characters[index].getPosition().col + 1,
        row: this.characters[index].getPosition().row,
      });
    }, 3000);

    return index;
  }

  update(deltaTime: number) {
    for (const character of this.characters) {
      character.update(deltaTime);
      this.updateInstanceMatrix(character);
    }
    this.instancedModel?.needsUpdate();
  }

  moveCharacter(index: number, newPosition: { col: number; row: number }) {
    const character = this.characters[index];
    character.moveToHex(newPosition);
  }

  private updateInstanceMatrix(character: Character) {
    const position = this.calculateWorldPosition(character.getPosition());
    this.dummy.position.copy(position);
    this.dummy.rotation.y = character.getRotation();
    this.dummy.updateMatrix();
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
    const y = 0.2; // Adjust this value to place the character on top of the hexagons

    return new THREE.Vector3(x, y, z);
  }
}

class Character {
  private currentHexPosition: { col: number; row: number };
  public index: number;
  private animationObject: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private walkAction: THREE.AnimationAction | undefined;
  private targetPosition: { col: number; row: number } | null = null;
  private rotation: number = 0;
  private isMoving: boolean = false;
  private moveSpeed: number = 2;

  constructor(initialPosition: { col: number; row: number }, index: number, animationClip?: THREE.AnimationClip) {
    this.currentHexPosition = initialPosition;
    this.index = index;
    this.animationObject = new THREE.Object3D();
    this.mixer = new THREE.AnimationMixer(this.animationObject);
    if (animationClip) {
      this.walkAction = this.mixer.clipAction(animationClip);
      this.walkAction.play();
      this.walkAction.paused = true;
    }
  }

  moveToHex(newPosition: { col: number; row: number }) {
    console.log("moveToHex", { newPosition });
    this.targetPosition = newPosition;
    this.rotateTowardsTarget(newPosition);
    this.isMoving = true;
    if (this.walkAction) {
      console.log("play walk action");
      // this.walkAction.reset().play();
      this.walkAction.paused = false;
    }
  }

  getPosition(): { col: number; row: number } {
    return this.currentHexPosition;
  }

  update(deltaTime: number) {
    this.mixer.update(deltaTime);
    if (this.isMoving && this.targetPosition) {
      const currentPos = new THREE.Vector3(this.currentHexPosition.col, 0, this.currentHexPosition.row);
      const targetPos = new THREE.Vector3(this.targetPosition.col, 0, this.targetPosition.row);

      const t = Math.min(1, this.moveSpeed * deltaTime);
      currentPos.lerp(targetPos, t);

      this.currentHexPosition = { col: currentPos.x, row: currentPos.z };

      // update the animation object
      this.animationObject.position.set(currentPos.x, 0, currentPos.z);
      this.animationObject.rotation.y = this.rotation;

      if (currentPos.distanceTo(targetPos) < 0.01) {
        this.isMoving = false;
        this.currentHexPosition = this.targetPosition;
        this.targetPosition = null;
        if (this.walkAction) {
          // this.walkAction.stop();
          this.walkAction.paused = true;
        }
      }
    }
  }

  private rotateTowardsTarget(newPosition: { col: number; row: number }) {
    const dx = newPosition.col - this.currentHexPosition.col;
    const dz = newPosition.row - this.currentHexPosition.row;
    this.rotation = Math.atan2(dz, dx) + Math.PI / 2; // Store rotation instead of setting index
  }

  getRotation(): number {
    return this.rotation;
  }
}
