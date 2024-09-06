import { Position } from "@/types/Position";
import { calculateOffset, getWorldPositionForHex } from "@/ui/utils/utils";
import { ID } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { GUIManager } from "../helpers/GUIManager";
import { ArmySystemUpdate } from "../systems/types";
import { ArmyModel } from "./ArmyModel";
import { LabelManager } from "./LabelManager";

const myColor = new THREE.Color(0, 1.5, 0);
const neutralColor = new THREE.Color(0xffffff);
const RADIUS_OFFSET = 0.09;

export class ArmyManager {
  private scene: THREE.Scene;
  private armyModel: ArmyModel;
  private armies: Map<ID, { matrixIndex: number; hexCoords: Position; isMine: boolean }> = new Map();
  private scale: THREE.Vector3;
  private movingArmies: Map<ID, { startPos: THREE.Vector3; endPos: THREE.Vector3; progress: number }> = new Map();
  private labelManager: LabelManager;
  private labels: Map<number, THREE.Points> = new Map();
  private movingLabels: Map<number, { startPos: THREE.Vector3; endPos: THREE.Vector3; progress: number }> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.armyModel = new ArmyModel(scene);
    this.scale = new THREE.Vector3(0.4, 0.4, 0.4);
    this.labelManager = new LabelManager("textures/army_label.png", 1.5);

    this.onMouseMove = this.onMouseMove.bind(this);
    this.onRightClick = this.onRightClick.bind(this);

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
    if (!this.armyModel.mesh) return;

    const intersects = raycaster.intersectObject(this.armyModel.mesh);
    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;
      if (instanceId !== undefined) {
        const entityId = this.armyModel.mesh.userData.entityIdMap.get(instanceId);
        return entityId;
      }
    }
  }

  public onRightClick(raycaster: THREE.Raycaster) {
    if (!this.armyModel.mesh) {
      console.log("Mesh not found.");
      return;
    }

    const intersects = raycaster.intersectObject(this.armyModel.mesh);
    if (intersects.length === 0) {
      console.log("No intersections found.");
      return;
    }

    const clickedObject = intersects[0].object;
    if (!(clickedObject instanceof THREE.InstancedMesh)) {
      console.log("Clicked object is not an instance of THREE.InstancedMesh.");
      return;
    }

    const instanceId = intersects[0].instanceId;
    if (instanceId === undefined) {
      console.log("Instance ID is undefined.");
      return;
    }

    const entityIdMap = clickedObject.userData.entityIdMap;
    if (entityIdMap) {
      const entityId = entityIdMap.get(instanceId);
      console.log(`Entity ID: ${entityId}`);

      // don't return if the army is not mine
      if (entityId && this.armies.get(entityId)?.isMine) {
        console.log(`Returning entity ID: ${entityId}`);
        return entityId;
      }
    }
  }

  async onUpdate(update: ArmySystemUpdate) {
    await this.armyModel.loadPromise;
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
    this.armyModel.loadPromise.then(() => {
      const index = this.armyModel.mesh.count;
      this.armyModel.mesh.count++;
      this.armies.set(entityId, { matrixIndex: index, hexCoords, isMine });
      const position = this.getArmyWorldPosition(entityId, hexCoords);
      this.armyModel.updateInstance(index, position, this.scale);
      this.armyModel.updateInstanceMatrix();
      if (!this.armyModel.mesh.userData.entityIdMap) {
        this.armyModel.mesh.userData.entityIdMap = new Map();
      }
      this.armyModel.mesh.userData.entityIdMap.set(index, entityId);
      this.armyModel.mesh.frustumCulled = false;
      this.armyModel.computeBoundingSphere();
      const label = this.labelManager.createLabel(position as any, isMine ? myColor : neutralColor);
      this.labels.set(entityId, label);
      this.scene.add(label);
    });
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

    this.armyModel.mesh.getMatrixAt(matrixIndex, this.armyModel.dummyObject.matrix);
    currentPosition.setFromMatrixPosition(this.armyModel.dummyObject.matrix);

    const direction = new THREE.Vector3().subVectors(newPosition, currentPosition).normalize();
    const angle = Math.atan2(direction.x, direction.z);
    this.armyModel.setAnimationState(matrixIndex, true); // Set to walking animation

    this.movingArmies.set(entityId, {
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
    this.movingArmies.forEach((movement, entityId) => {
      movement.progress += deltaTime * 0.5;
      const armyData = this.armies.get(entityId);
      if (!armyData) return;

      const { matrixIndex } = armyData;
      let position: THREE.Vector3;

      if (movement.progress >= 1) {
        position = movement.endPos;
        this.movingArmies.delete(entityId);
        this.armyModel.setAnimationState(matrixIndex, false); // Set back to idle animation
      } else {
        position = new THREE.Vector3().copy(movement.startPos).lerp(movement.endPos, movement.progress);
      }

      const direction = new THREE.Vector3().subVectors(movement.endPos, movement.startPos).normalize();
      const angle = Math.atan2(direction.x, direction.z);
      this.armyModel.dummyObject.rotation.set(0, angle + (Math.PI * 3) / 6, 0);

      this.armyModel.updateInstance(matrixIndex, position, this.scale);
    });

    if (this.movingArmies.size > 0) {
      this.armyModel.updateInstanceMatrix();
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
          const newPosition = this.armyModel.dummyObject.position
            .copy(movement.startPos)
            .lerp(movement.endPos, movement.progress);
          this.labelManager.updateLabelPosition(label, newPosition);
        }
      }
    });

    if (needsBoundingUpdate) {
      this.armyModel.computeBoundingSphere();
    }

    this.armyModel.updateAnimations(deltaTime);
  }

  removeArmy(entityId: ID) {
    const armyData = this.armies.get(entityId);
    if (!armyData) return;

    const matrixIndex = armyData.matrixIndex;

    const newMatrix = new THREE.Matrix4().scale(new THREE.Vector3(0, 0, 0));
    this.armyModel.mesh.setMatrixAt(matrixIndex, newMatrix);

    if (!this.armies.delete(entityId)) {
      throw new Error(`Couldn't delete army ${entityId}`);
    }
    this.armyModel.updateInstanceMatrix();

    this.armyModel.mesh.frustumCulled = false;
    this.armyModel.computeBoundingSphere();

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
