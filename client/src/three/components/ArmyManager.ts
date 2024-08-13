import { HexPosition } from "@/types";
import { FELT_CENTER } from "@/ui/config";
import { calculateOffset, getWorldPositionForHex } from "@/ui/utils/utils";
import { ID } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { ArmySystemUpdate } from "../systems/types";
import { LabelManager } from "./LabelManager";

const myColor = new THREE.Color(0, 1.5, 0);
const neutralColor = new THREE.Color(0xffffff);
const MAX_INSTANCES = 1000;
const RADIUS_OFFSET = 0.09;

export class ArmyManager {
  private scene: THREE.Scene;
  private dummy: THREE.Mesh;
  loadPromise: Promise<void>;
  private mesh: THREE.InstancedMesh;
  private armies: Map<number, { index: number; hexCoords: HexPosition; isMine: boolean }> = new Map();
  private scale: THREE.Vector3;
  private movingArmies: Map<number, { startPos: THREE.Vector3; endPos: THREE.Vector3; progress: number }> = new Map();
  private labelManager: LabelManager;
  private labels: Map<number, THREE.Points> = new Map();
  private movingLabels: Map<number, { startPos: THREE.Vector3; endPos: THREE.Vector3; progress: number }> = new Map();

  private getArmyWorldPosition = (armyEntityId: ID, hexCoords: HexPosition) => {
    const totalOnSameHex = Array.from(this.armies.values()).filter((army) => {
      return army.hexCoords.col === hexCoords.col && army.hexCoords.row === hexCoords.row;
    }).length;
    const basePosition = getWorldPositionForHex(hexCoords);
    if (totalOnSameHex === 1) return basePosition;
    const { x, z } = calculateOffset(armyEntityId, totalOnSameHex, RADIUS_OFFSET);
    const offset = new THREE.Vector3(x, 0, z);
    return basePosition.add(offset);
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.dummy = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.5, 32));
    this.mesh = new THREE.InstancedMesh(this.dummy.geometry, this.dummy.material, MAX_INSTANCES);
    this.scale = new THREE.Vector3(1, 1, 1);
    this.labelManager = new LabelManager("textures/army_label.png", 1.5);

    this.onMouseMove = this.onMouseMove.bind(this);
    this.onRightClick = this.onRightClick.bind(this);

    this.loadPromise = Promise.resolve();

    this.mesh.castShadow = true;

    this.mesh.morphTargetInfluences?.fill(0);
    this.mesh.morphTargetDictionary = {};
    this.mesh.geometry.morphTargetsRelative = false;

    this.dummy.position.set(0, 0, 0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(0, this.dummy.matrix);

    this.mesh.count = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  public onMouseMove(raycaster: THREE.Raycaster) {
    if (!this.mesh) return;
    const intersects = raycaster.intersectObject(this.mesh);
    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;
      if (instanceId !== undefined) {
        const entityId = this.mesh.userData.entityIdMap[instanceId];
        return entityId;
      }
    }
  }

  public onRightClick(raycaster: THREE.Raycaster) {
    if (!this.mesh) return;

    const intersects = raycaster.intersectObject(this.mesh);
    if (intersects.length === 0) {
      return;
    }

    const clickedObject = intersects[0].object;
    if (!(clickedObject instanceof THREE.InstancedMesh)) return;

    const instanceId = intersects[0].instanceId;
    if (instanceId === undefined) return;

    const entityIdMap = clickedObject.userData.entityIdMap;
    if (entityIdMap) {
      const entityId = entityIdMap[instanceId];
      // don't return if the army is not mine
      if (entityId && this.armies.get(entityId)?.isMine) return entityId;
    }
  }

  async onUpdate(update: ArmySystemUpdate) {
    await this.loadPromise;

    const { entityId, hexCoords, isMine } = update;

    const normalizedCoord = { col: hexCoords.col - FELT_CENTER, row: hexCoords.row - FELT_CENTER };

    if (this.armies.has(entityId)) {
      this.moveArmy(entityId, normalizedCoord);
    } else {
      this.addArmy(entityId, normalizedCoord, isMine);
    }
  }

  addArmy(entityId: ID, hexCoords: HexPosition, isMine: boolean) {
    const index = this.mesh.count;
    this.mesh.count++;
    this.armies.set(entityId, { index, hexCoords, isMine });
    const position = this.getArmyWorldPosition(entityId, hexCoords);
    this.dummy.position.copy(position);
    this.dummy.scale.copy(this.scale);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;

    if (!this.mesh.userData.entityIdMap) {
      this.mesh.userData.entityIdMap = {};
    }
    this.mesh.userData.entityIdMap[index] = entityId;

    const label = this.labelManager.createLabel(position as any, isMine ? myColor : neutralColor);
    this.labels.set(entityId, label);
    this.scene.add(label);

    if (this.mesh.count === 1) {
      this.scene.add(this.mesh);
    }
  }

  moveArmy(entityId: ID, hexCoords: HexPosition) {
    const armyData = this.armies.get(entityId);
    if (!armyData) {
      console.error(`No army found with entityId: ${entityId}`);
      return;
    }
    if (armyData.hexCoords.col === hexCoords.col && armyData.hexCoords.row === hexCoords.row) {
      return;
    }
    console.log("move army", entityId, hexCoords);

    const { index, isMine } = armyData;
    this.armies.set(entityId, { index, hexCoords, isMine });
    const newPosition = this.getArmyWorldPosition(entityId, hexCoords);
    const currentPosition = new THREE.Vector3();
    this.mesh.getMatrixAt(index, this.dummy.matrix);
    currentPosition.setFromMatrixPosition(this.dummy.matrix);

    const direction = new THREE.Vector3().subVectors(newPosition, currentPosition).normalize();
    const angle = Math.atan2(direction.x, direction.z);
    this.dummy.rotation.set(0, angle, 0);

    this.movingArmies.set(index, {
      startPos: currentPosition,
      endPos: newPosition as any,
      progress: 0,
    });

    this.movingLabels.set(entityId, {
      startPos: currentPosition,
      endPos: newPosition as any,
      progress: 0,
    });
  }

  update(deltaTime: number) {
    this.movingArmies.forEach((movement, index) => {
      movement.progress += deltaTime * 0.5;
      if (movement.progress >= 1) {
        this.dummy.position.copy(movement.endPos);
        this.movingArmies.delete(index);
      } else {
        this.dummy.position.copy(movement.startPos).lerp(movement.endPos, movement.progress);
      }
      this.dummy.scale.copy(this.scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(index, this.dummy.matrix);

      const entityId = this.mesh.userData.entityIdMap[index];
    });
    if (this.movingArmies.size > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }

    this.movingLabels.forEach((movement, entityId) => {
      movement.progress += deltaTime * 0.5;
      const label = this.labels.get(entityId);
      if (label) {
        if (movement.progress >= 1) {
          this.labelManager.updateLabelPosition(label, movement.endPos);
          this.movingLabels.delete(entityId);
        } else {
          const newPosition = this.dummy.position.copy(movement.startPos).lerp(movement.endPos, movement.progress);
          this.labelManager.updateLabelPosition(label, newPosition);
        }
      }
    });
  }
}
