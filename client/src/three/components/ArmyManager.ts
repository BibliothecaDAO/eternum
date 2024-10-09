import { Position } from "@/types/Position";
import { calculateOffset, getWorldPositionForHex } from "@/ui/utils/utils";
import { ID, orders } from "@bibliothecadao/eternum";
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
  private armies: Map<ID, { entityId: ID; matrixIndex: number; hexCoords: Position; isMine: boolean; color: string }> =
    new Map();
  private scale: THREE.Vector3;
  private movingArmies: Map<ID, { startPos: THREE.Vector3; endPos: THREE.Vector3; progress: number }> = new Map();
  private labelManager: LabelManager;
  private labels: Map<number, THREE.Points> = new Map();
  private movingLabels: Map<number, { startPos: THREE.Vector3; endPos: THREE.Vector3; progress: number }> = new Map();
  private cachedChunks: Map<string, { matrices: THREE.InstancedBufferAttribute; count: number }> = new Map();
  private currentChunkKey: string | null = "190,170";
  private chunkSize: number;
  private renderChunkSize: { width: number; height: number };

  constructor(scene: THREE.Scene, chunkSize: number, renderChunkSize: { width: number; height: number }) {
    this.scene = scene;
    this.armyModel = new ArmyModel(scene);
    this.scale = new THREE.Vector3(0.3, 0.3, 0.3);
    this.labelManager = new LabelManager("textures/army_label.png", 1.5);
    this.chunkSize = chunkSize;
    this.renderChunkSize = renderChunkSize;

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
              1,
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

      // don't return if the army is not mine
      if (entityId && this.armies.get(entityId)?.isMine) {
        return entityId;
      }
    }
  }

  async onUpdate(update: ArmySystemUpdate) {
    console.debug("onUpdate called with update:", update);
    await this.armyModel.loadPromise;
    const { entityId, hexCoords, isMine, battleId, currentHealth, order } = update;
    console.log({ entityId, hexCoords, isMine, battleId, currentHealth, order });

    if (currentHealth <= 0) {
      console.debug(`Army with entityId ${entityId} has currentHealth <= 0`);
      if (this.armies.has(entityId)) {
        console.debug(`Removing army with entityId ${entityId}`);
        this.removeArmy(entityId);
        return;
      } else {
        console.debug(`Army with entityId ${entityId} not found`);
        return;
      }
    }

    if (battleId !== 0) {
      console.debug(`Army with entityId ${entityId} is in battle with battleId ${battleId}`);
      if (this.armies.has(entityId)) {
        console.debug(`Removing army with entityId ${entityId} due to battle`);
        this.removeArmy(entityId);
        return;
      } else {
        console.debug(`Army with entityId ${entityId} not found`);
        return;
      }
    }

    const position = new Position({ x: hexCoords.col, y: hexCoords.row });
    console.debug(`Computed position for army with entityId ${entityId}:`, position);

    if (this.armies.has(entityId)) {
      console.debug(`Moving army with entityId ${entityId} to new position`);
      this.moveArmy(entityId, position);
    } else {
      console.debug(`Adding new army with entityId ${entityId} at position`, position);
      this.addArmy(entityId, position, isMine, order);
    }
  }
  async updateChunk(chunkKey: string) {
    await this.armyModel.loadPromise;
    console.debug(`updateChunk called with chunkKey: ${chunkKey}`);
    if (this.currentChunkKey === chunkKey) {
      console.debug(`Chunk key ${chunkKey} is the same as the current chunk key. No update needed.`);
      return;
    }

    this.currentChunkKey = chunkKey;
    if (this.cachedChunks.has(chunkKey)) {
      console.debug(`Chunk key ${chunkKey} found in cache. Applying cached chunk.`);
      this.computeAndCacheChunk(chunkKey);
    } else {
      console.debug(`Chunk key ${chunkKey} not found in cache. Computing and caching chunk.`);
      this.computeAndCacheChunk(chunkKey);
    }
  }

  private applyCachedChunk(chunkKey: string) {
    console.debug(`applyCachedChunk called with chunkKey: ${chunkKey}`);
    const cachedData = this.cachedChunks.get(chunkKey);
    if (!cachedData) {
      console.debug(`No cached data found for chunkKey: ${chunkKey}`);
      return;
    }

    console.debug(`Applying cached data for chunkKey: ${chunkKey}`);
    this.armyModel.mesh.instanceMatrix.copy(cachedData.matrices);
    this.armyModel.mesh.count = cachedData.count;
    this.armyModel.mesh.instanceMatrix.needsUpdate = true;
    this.updateLabelsForChunk(chunkKey);
  }

  private computeAndCacheChunk(chunkKey: string) {
    console.debug(`computeAndCacheChunk called with chunkKey: ${chunkKey}`);
    const [startRow, startCol] = chunkKey.split(",").map(Number);
    console.debug(`Parsed chunkKey into startRow: ${startRow}, startCol: ${startCol}`);
    const visibleArmies = this.getVisibleArmiesForChunk(startRow, startCol);
    console.debug(`Found ${visibleArmies.length} visible armies for chunk`);
    let count = 0;
    if (!this.armyModel.mesh.userData.entityIdMap) {
      this.armyModel.mesh.userData.entityIdMap = new Map();
    }
    visibleArmies.forEach((army, index) => {
      console.debug(`Processing army with entityId: ${army.entityId} at index: ${index}`);
      const position = this.getArmyWorldPosition(army.entityId, army.hexCoords);
      this.armyModel.dummyObject.position.copy(position);
      this.armyModel.dummyObject.scale.copy(this.scale);
      console.debug(
        `Position: ${position.x}, ${position.y}, ${position.z}, Scale: ${this.armyModel.dummyObject.scale.x}, ${this.armyModel.dummyObject.scale.y}, ${this.armyModel.dummyObject.scale.z}`,
      );
      this.armyModel.dummyObject.updateMatrix();
      this.armyModel.mesh.setMatrixAt(index, this.armyModel.dummyObject.matrix);
      this.armyModel.mesh.setColorAt(index, new THREE.Color(army.color));
      count++;
      this.armyModel.mesh.userData.entityIdMap.set(index, army.entityId);
      this.armies.set(army.entityId, { ...army, matrixIndex: index });
    });

    console.debug(`Setting cached chunk with key: ${chunkKey} and count: ${count}`);
    this.cachedChunks.set(chunkKey, { matrices: this.armyModel.mesh.instanceMatrix.clone() as any, count });
    this.armyModel.mesh.count = count;
    console.debug(`Setting cached chunk with key: ${chunkKey} and count: ${count} and matrices:`);
    this.armyModel.mesh.instanceMatrix.needsUpdate = true;
    if (this.armyModel.mesh.instanceColor) {
      this.armyModel.mesh.instanceColor.needsUpdate = true;
    }
    this.armyModel.mesh.computeBoundingSphere();
    this.updateLabelsForChunk(chunkKey);
  }

  private getVisibleArmiesForChunk(
    startRow: number,
    startCol: number,
  ): Array<{ entityId: ID; hexCoords: Position; isMine: boolean; color: string }> {
    console.debug(`getVisibleArmiesForChunk called with startRow: ${startRow}, startCol: ${startCol}`);
    const visibleArmies = Array.from(this.armies.entries())
      .filter(([_, army]) => {
        const { x, y } = army.hexCoords.getNormalized();
        const isVisible =
          x >= startCol - this.renderChunkSize.width / 2 &&
          x <= startCol + this.renderChunkSize.width / 2 &&
          y >= startRow - this.renderChunkSize.height / 2 &&
          y <= startRow + this.renderChunkSize.height / 2;
        if (isVisible) {
          console.debug(`Army with entityId: ${army.entityId} at hexCoords: (${x}, ${y}) is visible`);
        }

        return isVisible;
      })
      .map(([entityId, army]) => ({ entityId, hexCoords: army.hexCoords, isMine: army.isMine, color: army.color }));
    console.debug(`Found ${visibleArmies.length} visible armies for chunk`);
    return visibleArmies;
  }

  private updateLabelsForChunk(chunkKey: string) {
    // Remove all existing labels
    this.labels.forEach((label) => this.scene.remove(label));
    this.labels.clear();

    const [startRow, startCol] = chunkKey.split(",").map(Number);
    const visibleArmies = this.getVisibleArmiesForChunk(startRow, startCol);

    visibleArmies.forEach((army) => {
      const position = this.getArmyWorldPosition(army.entityId, army.hexCoords);
      const label = this.labelManager.createLabel(position, army.isMine ? myColor : neutralColor);
      this.labels.set(army.entityId, label);
      this.scene.add(label);
    });
  }

  public addArmy(entityId: ID, hexCoords: Position, isMine: boolean, order: number) {
    if (this.armies.has(entityId)) return;
    const orderColor = orders.find((_order) => _order.orderId === order)?.color || "#000000";
    this.armies.set(entityId, { entityId, matrixIndex: this.armies.size - 1, hexCoords, isMine, color: orderColor });
    this.invalidateCache();
    this.computeAndCacheChunk(this.currentChunkKey!);
  }

  public moveArmy(entityId: ID, hexCoords: Position) {
    // @ts-ignore
    console.debug(`moveArmy called with entityId: ${entityId}, hexCoords: (${hexCoords.x}, ${hexCoords.y})`);
    const armyData = this.armies.get(entityId);
    if (!armyData) {
      console.debug(`No army found with entityId: ${entityId}`);
      return;
    }

    const { x, y } = hexCoords.getNormalized();
    const { x: armyDataX, y: armyDataY } = armyData.hexCoords.getNormalized();
    if (armyDataX === x && armyDataY === y) {
      console.debug(`Army with entityId: ${entityId} is already at the target position: (${x}, ${y})`);
      return;
    }

    this.armies.set(entityId, { ...armyData, hexCoords });
    this.invalidateCache();
    console.debug(
      `Army with entityId: ${entityId} moved to new hexCoords: (${x}, ${y}), matrixIndex: ${armyData.matrixIndex}`,
    );

    const newPosition = this.getArmyWorldPosition(entityId, hexCoords);
    const currentPosition = new THREE.Vector3();
    this.armyModel.mesh.getMatrixAt(armyData.matrixIndex, this.armyModel.dummyObject.matrix);
    currentPosition.setFromMatrixPosition(this.armyModel.dummyObject.matrix);
    this.armyModel.setAnimationState(armyData.matrixIndex, true);
    this.movingArmies.set(entityId, {
      startPos: currentPosition,
      endPos: newPosition,
      progress: 0,
    });
    console.debug(
      `Army with entityId: ${entityId} movement started from (${currentPosition.x}, ${currentPosition.y}, ${currentPosition.z}) to (${newPosition.x}, ${newPosition.y}, ${newPosition.z})`,
    );

    this.movingLabels.set(entityId, {
      startPos: currentPosition,
      endPos: newPosition,
      progress: 0,
    });
    console.debug(
      `Label for army with entityId: ${entityId} movement started from (${currentPosition.x}, ${currentPosition.y}, ${currentPosition.z}) to (${newPosition.x}, ${newPosition.y}, ${newPosition.z})`,
    );
  }

  public removeArmy(entityId: ID) {
    if (!this.armies.delete(entityId)) return;

    this.invalidateCache();
    this.computeAndCacheChunk(this.currentChunkKey!);

    const label = this.labels.get(entityId);
    if (label) {
      this.labelManager.removeLabel(label, this.scene);
      this.labels.delete(entityId);
    }
  }

  private invalidateCache() {
    this.cachedChunks.clear();
  }

  public getArmies() {
    return Array.from(this.armies.values());
  }

  update(deltaTime: number) {
    let needsBoundingUpdate = false;
    const movementSpeed = 1.25; // Constant movement speed

    this.movingArmies.forEach((movement, entityId) => {
      const armyData = this.armies.get(entityId);
      if (!armyData) return;

      const { matrixIndex } = armyData;
      let position: THREE.Vector3;

      const distance = movement.startPos.distanceTo(movement.endPos);
      const travelTime = distance / movementSpeed;
      movement.progress += deltaTime / travelTime;

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
      const label = this.labels.get(entityId);
      if (label) {
        const distance = movement.startPos.distanceTo(movement.endPos);
        const travelTime = distance / movementSpeed;
        movement.progress += deltaTime / travelTime;

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
