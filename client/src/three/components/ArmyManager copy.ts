import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import WorldmapScene from "../scenes/Worldmap";

export class ArmyManager {
  private dummy: THREE.Mesh;
  private isLoaded: boolean = false;
  loadPromise: Promise<void>;
  private animationClip: THREE.AnimationClip | undefined;
  private mesh: THREE.InstancedMesh;
  private armies: Map<string, number> = new Map<string, number>();
  private scale: THREE.Vector3;
  private movingArmies: Map<number, { startPos: THREE.Vector3; endPos: THREE.Vector3; progress: number }> = new Map();
  private mixer: THREE.AnimationMixer | undefined;
  private animationAction: THREE.AnimationAction | undefined;
  private animationTime: number = 0;
  private animationOffsets: Map<number, number> = new Map();

  constructor(private worldMapScene: WorldmapScene, modelPath: string, maxInstances: number) {
    this.dummy = new THREE.Mesh();
    this.mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 0);
    this.scale = new THREE.Vector3(0.005, 0.005, 0.005);
    this.loadPromise = new Promise<void>((resolve, reject) => {
      this.worldMapScene = worldMapScene;
      const loader = new GLTFLoader();
      loader.load(
        modelPath,
        (gltf) => {
          this.dummy = gltf.scene.children[0] as THREE.Mesh;
          this.mesh = new THREE.InstancedMesh(this.dummy.geometry, this.dummy.material, maxInstances);
          this.mesh.castShadow = true;
          // this.mesh.scale.set(0.005, 0.005, 0.005);

          this.dummy.position.set(0, 0, 0);
          this.dummy.updateMatrix();
          this.mesh.setMatrixAt(0, this.dummy.matrix);

          this.mesh.count = 0;
          this.mesh.instanceMatrix.needsUpdate = true;

          worldMapScene.scene.add(this.mesh);

          this.animationClip = gltf.animations[0];
          this.mixer = new THREE.AnimationMixer(this.mesh);
          if (this.animationClip) {
            this.animationAction = this.mixer.clipAction(this.animationClip);
            this.animationAction.play();
          }

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

  updateArmy(entityId: string, hexCoords: { col: number; row: number }) {
    console.log("updating armies");
    if (!this.isLoaded) {
      return;
    }
    if (this.armies.has(entityId)) {
      this.moveArmy(entityId, hexCoords);
    } else {
      this.addArmy(entityId, hexCoords);
    }
  }

  addArmy(entityId: string, hexCoords: { col: number; row: number }) {
    console.log("add army: ", entityId, hexCoords);
    const index = this.mesh.count;
    this.mesh.count++;
    this.armies.set(entityId, index);
    const position = this.worldMapScene.getWorldPositionForHex(hexCoords);
    this.dummy.position.copy(position);
    this.dummy.scale.copy(this.scale);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;

    if (this.animationAction) {
      const randomOffset = Math.random() * this.animationAction.getClip().duration;
      this.animationOffsets.set(index, randomOffset);
    }
  }

  moveArmy(entityId: string, hexCoords: { col: number; row: number }) {
    console.log("move army: ", entityId);
    const index = this.armies.get(entityId);
    if (index === undefined) {
      console.error(`No army found with entityId: ${entityId}`);
      return;
    }
    const newPosition = this.worldMapScene.getWorldPositionForHex(hexCoords);
    const currentPosition = new THREE.Vector3();
    this.mesh.getMatrixAt(index, this.dummy.matrix);
    currentPosition.setFromMatrixPosition(this.dummy.matrix);

    this.movingArmies.set(index, {
      startPos: currentPosition,
      endPos: newPosition,
      progress: 0,
    });
  }

  printModel() {}

  update(deltaTime: number) {
    this.animationTime += deltaTime;

    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    this.movingArmies.forEach((movement, index) => {
      movement.progress += deltaTime * 0.5; // Adjust this value to change movement speed
      if (movement.progress >= 1) {
        this.dummy.position.copy(movement.endPos);
        this.movingArmies.delete(index);
      } else {
        this.dummy.position.copy(movement.startPos).lerp(movement.endPos, movement.progress);
      }
      this.dummy.scale.copy(this.scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(index, this.dummy.matrix);

      // Animate only moving armies
      if (this.animationAction) {
        const offset = this.animationOffsets.get(index) || 0;
        const time = (this.animationTime + offset) % this.animationAction.getClip().duration;
        this.animationAction.time = time;
        this.animationAction.getMixer().update(0);
        this.mesh.setMorphAt(index, this.dummy);
      }
    });

    if (this.movingArmies.size > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.morphTexture) {
        this.mesh.morphTexture.needsUpdate = true;
      }
    }
  }
}
