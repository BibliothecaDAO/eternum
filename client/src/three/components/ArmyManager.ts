import { Position } from "@/types/Position";
import { calculateOffset, getWorldPositionForHex } from "@/ui/utils/utils";
import { ID } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { GUIManager } from "../helpers/GUIManager";
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
  private armies: Map<ID, { matrixIndex: number; hexCoords: Position; isMine: boolean }> = new Map();
  private scale: THREE.Vector3;
  private movingArmies: Map<ID, { startPos: THREE.Vector3; endPos: THREE.Vector3; progress: number }> = new Map();
  private labelManager: LabelManager;
  private labels: Map<number, THREE.Points> = new Map();
  private movingLabels: Map<number, { startPos: THREE.Vector3; endPos: THREE.Vector3; progress: number }> = new Map();

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

    this.scene.add(this.mesh);

    const createArmyFolder = GUIManager.addFolder("Create Army");
    const createArmyParams = { entityId: 0, col: 0, row: 0, isMine: false };

    createArmyFolder.add(createArmyParams, "entityId").name("Entity ID");
    createArmyFolder.add(createArmyParams, "col").name("Column");
    createArmyFolder.add(createArmyParams, "row").name("Row");
    createArmyFolder.add(createArmyParams, "isMine", [true, false]).name("Is Mine");
    createArmyFolder
      .add(
        {
          addArmy: () => {
            this.addArmy(
              createArmyParams.entityId,
              new Position({ x: createArmyParams.col, y: createArmyParams.row }),
              createArmyParams.isMine,
            );
          },
        },
        "addArmy",
      )
      .name("Add army");
    createArmyFolder.close();

    const deleteArmyFolder = GUIManager.addFolder("Delete Army");
    const deleteArmyParams = { entityId: 0 };

    deleteArmyFolder.add(deleteArmyParams, "entityId").name("Entity ID");
    deleteArmyFolder
      .add(
        {
          deleteArmy: () => {
            this.removeArmy(deleteArmyParams.entityId);
          },
        },
        "deleteArmy",
      )
      .name("Delete army");
    deleteArmyFolder.close();
  }

  public onMouseMove(raycaster: THREE.Raycaster) {
    if (!this.mesh) return;

    const intersects = raycaster.intersectObject(this.mesh);
    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;
      if (instanceId !== undefined) {
        const entityId = this.mesh.userData.entityIdMap.get(instanceId);
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
      const entityId = entityIdMap.get(instanceId);

      // don't return if the army is not mine
      if (entityId && this.armies.get(entityId)?.isMine) return entityId;
    }
  }

  async onUpdate(update: ArmySystemUpdate) {
    await this.loadPromise;
    const { entityId, hexCoords, isMine, battleId, currentHealth } = update;

    if (currentHealth <= 0) {
      if (this.armies.has(entityId)) {
        this.removeArmy(entityId);
        return;
      } else {
        return;
      }
    }

    if (battleId !== 0) {
      if (this.armies.has(entityId)) {
        this.removeArmy(entityId);
        return;
      } else return;
    }

    const position = new Position({ x: hexCoords.col, y: hexCoords.row });

    if (this.armies.has(entityId)) {
      this.moveArmy(entityId, position);
    } else {
      this.addArmy(entityId, position, isMine);
    }
  }

  addArmy(entityId: ID, hexCoords: Position, isMine: boolean) {
    const index = this.mesh.count;
    this.mesh.count++;
    this.armies.set(entityId, { matrixIndex: index, hexCoords, isMine });
    const position = this.getArmyWorldPosition(entityId, hexCoords);

    this.dummy.position.copy(position);
    this.dummy.scale.copy(this.scale);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    // Update the bounding sphere of the InstancedMesh
    this.mesh.computeBoundingSphere();

    if (!this.mesh.userData.entityIdMap) {
      this.mesh.userData.entityIdMap = new Map();
    }
    this.mesh.userData.entityIdMap.set(index, entityId);

    this.mesh.frustumCulled = false;
    this.mesh.computeBoundingSphere();

    const label = this.labelManager.createLabel(position as any, isMine ? myColor : neutralColor);
    this.labels.set(entityId, label);
    this.scene.add(label);
  }

  moveArmy(entityId: ID, hexCoords: Position) {
    const armyData = this.armies.get(entityId);
    if (!armyData) return;

    const { x, y } = hexCoords.getNormalized();
    const { x: armyDataX, y: armyDataY } = armyData.hexCoords.getNormalized();
    if (armyDataX === x && armyDataY === y) return;

    const { matrixIndex, isMine } = armyData;
    this.armies.set(entityId, { matrixIndex, hexCoords, isMine });

    const newPosition = this.getArmyWorldPosition(entityId, hexCoords);
    const currentPosition = new THREE.Vector3();

    this.mesh.getMatrixAt(matrixIndex, this.dummy.matrix);
    currentPosition.setFromMatrixPosition(this.dummy.matrix);

    const direction = new THREE.Vector3().subVectors(newPosition, currentPosition).normalize();
    const angle = Math.atan2(direction.x, direction.z);
    this.dummy.rotation.set(0, angle, 0);

    this.movingArmies.set(matrixIndex, {
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
    let needsBoundingUpdate = false;

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

      const entityId = this.mesh.userData.entityIdMap.get(index);
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
          needsBoundingUpdate = true;
        } else {
          const newPosition = this.dummy.position.copy(movement.startPos).lerp(movement.endPos, movement.progress);
          this.labelManager.updateLabelPosition(label, newPosition);
        }
      }
    });

    if (needsBoundingUpdate) {
      // Update the bounding sphere of the InstancedMesh only when an army has finished moving
      this.mesh.computeBoundingSphere();
    }
  }

  removeArmy(entityId: ID) {
    const armyData = this.armies.get(entityId);
    if (!armyData) return;

    const matrixIndex = armyData.matrixIndex;

    const newMatrix = new THREE.Matrix4().scale(new THREE.Vector3(0, 0, 0));
    this.mesh.setMatrixAt(matrixIndex, newMatrix);

    if (!this.armies.delete(entityId)) {
      throw new Error(`Couldn't delete army ${entityId}`);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    this.mesh.frustumCulled = false;
    this.mesh.computeBoundingSphere();

    const label = this.labels.get(entityId);

    this.labelManager.removeLabel(label!, this.scene);
    this.labels.delete(entityId);
  }

  private getArmyWorldPosition = (armyEntityId: ID, hexCoords: Position) => {
    const { x: hexCoordsX, y: hexCoordsY } = hexCoords.getNormalized();

    const totalOnSameHex = Array.from(this.armies.values()).filter((army) => {
      const { x, y } = army.hexCoords.getNormalized();
      return x === hexCoordsX && y === hexCoordsY;
    }).length;

    const basePosition = getWorldPositionForHex({ col: hexCoordsX, row: hexCoordsY });
    if (totalOnSameHex === 1) return basePosition;

    const { x, z } = calculateOffset(armyEntityId, totalOnSameHex, RADIUS_OFFSET);
    const offset = new THREE.Vector3(x, 0, z);

    return basePosition.add(offset);
  };
}
