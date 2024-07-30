import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import InstancedModel from "./InstancedModel";
import WorldmapScene from "../scenes/Worldmap";
import { LabelManager } from "./LabelManager";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import { useThreeStore } from "@/hooks/store/useThreeStore";

const myColor = new THREE.Color(0, 1.5, 0);
const neutralColor = new THREE.Color(0xffffff);

export class ArmyManager {
  private instancedModel: InstancedModel | undefined;
  private dummy: THREE.Mesh;
  private isLoaded: boolean = false;
  loadPromise: Promise<void>;
  private animationClip: THREE.AnimationClip | undefined;
  private mixer: THREE.AnimationMixer | undefined;
  private interval: any;
  private mesh: THREE.InstancedMesh;
  private armies: Map<number, number> = new Map<number, number>();
  private scale: THREE.Vector3;
  private movingArmies: Map<number, { startPos: THREE.Vector3; endPos: THREE.Vector3; progress: number }> = new Map();
  private labelManager: LabelManager;
  private labels: Map<number, THREE.Points> = new Map<number, THREE.Points>();

  constructor(private worldMapScene: WorldmapScene, modelPath: string, maxInstances: number) {
    this.dummy = new THREE.Mesh();
    this.mesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 0);
    this.scale = new THREE.Vector3(0.005, 0.005, 0.005);
    this.labelManager = new LabelManager("textures/army_label.png", 1.5);
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
          this.isLoaded = true;

          this.mixer = new THREE.AnimationMixer(gltf.scene);
          const action = this.mixer.clipAction(gltf.animations[0]);
          // cannot play is count = 0
          // action.play();
          // action.paused = true;

          resolve();
        },
        undefined,
        (error) => {
          console.error("An error occurred while loading the model:", error);
          reject(error);
        },
      );
    });

    this.initMouseHoverEvent();
  }

  private initMouseHoverEvent() {
    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    window.addEventListener("mousemove", (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, this.worldMapScene.getCamera());

      const intersects = raycaster.intersectObject(this.mesh);
      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;
        if (instanceId !== undefined) {
          const entityId = this.mesh.userData.entityIdMap[instanceId];
          useThreeStore.getState().setHoveredArmyEntityId(entityId);
          return;
        }
      }
      useThreeStore.getState().setHoveredArmyEntityId(null);
    });
  }

  updateArmy(entityId: number, hexCoords: { col: number; row: number }, isMine: boolean) {
    console.log("updating armies");
    if (!this.isLoaded) {
      return;
    }
    if (this.armies.has(entityId)) {
      this.moveArmy(entityId, hexCoords);
    } else {
      this.addArmy(entityId, hexCoords, isMine);
    }
  }

  addArmy(entityId: number, hexCoords: { col: number; row: number }, isMine: boolean) {
    console.log("add army: ", entityId, hexCoords);
    const index = this.mesh.count;
    this.mesh.count++;
    this.armies.set(entityId, index);
    const position = getWorldPositionForHex(hexCoords);
    this.dummy.position.copy(position);
    this.dummy.scale.copy(this.scale);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;

    // Map the index to the entityId in the instancedMesh userData
    if (!this.mesh.userData.entityIdMap) {
      this.mesh.userData.entityIdMap = {};
    }
    this.mesh.userData.entityIdMap[index] = entityId;

    // Add label on top of the army
    const label = this.labelManager.createLabel(position as any, isMine ? myColor : neutralColor);
    this.labels.set(entityId, label);
    this.worldMapScene.scene.add(label);
  }

  moveArmy(entityId: number, hexCoords: { col: number; row: number }) {
    console.log("move army: ", entityId, hexCoords);
    const index = this.armies.get(entityId);
    if (index === undefined) {
      console.error(`No army found with entityId: ${entityId}`);
      return;
    }
    const newPosition = getWorldPositionForHex(hexCoords);
    const currentPosition = new THREE.Vector3();
    this.mesh.getMatrixAt(index, this.dummy.matrix);
    currentPosition.setFromMatrixPosition(this.dummy.matrix);

    // Calculate direction and set rotation
    const direction = new THREE.Vector3().subVectors(newPosition, currentPosition).normalize();
    const angle = Math.atan2(direction.x, direction.z);
    this.dummy.rotation.set(0, angle, 0);

    this.movingArmies.set(index, {
      startPos: currentPosition,
      endPos: newPosition as any,
      progress: 0,
    });
  }

  printModel() {
    console.log({ instancedModel: this.instancedModel });
  }

  update(deltaTime: number) {
    if (this.mixer) {
      this.mixer.update(deltaTime); // Slow down animation by reducing deltaTime
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

      // Update label position continuously during movement
      const entityId = this.mesh.userData.entityIdMap[index];
      const label = this.labels.get(entityId);
      if (label) {
        label.position.set(this.dummy.position.x, this.dummy.position.y + 1.5, this.dummy.position.z);
      }
    });

    if (this.movingArmies.size > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    for (let i = 0; i < this.mesh.count; i++) {
      this.mesh.setMorphAt(i, this.dummy);
    }
    if (this.mesh.morphTexture) {
      this.mesh.morphTexture.needsUpdate = true;
    }
  }
}
