import { useAccountStore } from "@/hooks/context/accountStore";
import { ArmyData, MovingArmyData, MovingLabelData, RenderChunkSize } from "@/types";
import { Position } from "@/types/Position";
import { calculateOffset, getHexForWorldPosition, getWorldPositionForHex } from "@/ui/utils/utils";
import { BiomeType, ContractAddress, FELT_CENTER, ID, orders } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { GUIManager } from "../helpers/GUIManager";
import { isAddressEqualToAccount } from "../helpers/utils";
import { ArmySystemUpdate } from "../systems/types";
import { ArmyModel } from "./ArmyModel";
import { Biome } from "./Biome";
import { LabelManager } from "./LabelManager";

const myColor = new THREE.Color(0, 1.5, 0);
const neutralColor = new THREE.Color(0xffffff);
const RADIUS_OFFSET = 0.09;

export class ArmyManager {
  private scene: THREE.Scene;
  private armyModel: ArmyModel;
  private armies: Map<ID, ArmyData> = new Map();
  private scale: THREE.Vector3;
  private movingArmies: Map<ID, MovingArmyData> = new Map();
  private labelManager: LabelManager;
  private labels: Map<number, THREE.Points> = new Map();
  private movingLabels: Map<number, MovingLabelData> = new Map();
  private currentChunkKey: string | null = "190,170";
  private renderChunkSize: RenderChunkSize;
  private visibleArmies: ArmyData[] = [];
  private biome: Biome;

  constructor(scene: THREE.Scene, renderChunkSize: { width: number; height: number }) {
    this.scene = scene;
    this.armyModel = new ArmyModel(scene);
    this.scale = new THREE.Vector3(0.3, 0.3, 0.3);
    this.labelManager = new LabelManager("textures/army_label.png", 1.5);
    this.renderChunkSize = renderChunkSize;
    this.biome = new Biome();
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
              {
                address: createArmyParams.isMine
                  ? ContractAddress(useAccountStore.getState().account?.address || "0")
                  : 0n,
              },
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

    useAccountStore.subscribe(() => {
      this.recheckOwnership();
    });
  }

  public onMouseMove(raycaster: THREE.Raycaster) {
    const intersectResults = this.armyModel.raycastAll(raycaster);
    if (intersectResults.length > 0) {
      const { instanceId, mesh } = intersectResults[0];
      if (instanceId !== undefined && mesh.userData.entityIdMap) {
        return mesh.userData.entityIdMap.get(instanceId);
      }
    }
    return undefined;
  }

  public onRightClick(raycaster: THREE.Raycaster) {
    const intersectResults = this.armyModel.raycastAll(raycaster);
    if (intersectResults.length === 0) return;

    const { instanceId, mesh } = intersectResults[0];
    if (instanceId === undefined || !mesh.userData.entityIdMap) return;

    const entityId = mesh.userData.entityIdMap.get(instanceId);
    if (entityId && this.armies.get(entityId)?.isMine) {
      return entityId;
    }
  }

  async onUpdate(update: ArmySystemUpdate) {
    await this.armyModel.loadPromise;
    const { entityId, hexCoords, owner, battleId, currentHealth, order } = update;

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
      } else {
        return;
      }
    }

    const position = new Position({ x: hexCoords.col, y: hexCoords.row });

    if (this.armies.has(entityId)) {
      this.moveArmy(entityId, position);
    } else {
      this.addArmy(entityId, position, owner, order);
    }
  }

  async updateChunk(chunkKey: string) {
    await this.armyModel.loadPromise;

    if (this.currentChunkKey === chunkKey) {
      return;
    }

    this.currentChunkKey = chunkKey;
    this.renderVisibleArmies(chunkKey);
  }

  private renderVisibleArmies(chunkKey: string) {
    const [startRow, startCol] = chunkKey.split(",").map(Number);
    this.visibleArmies = this.getVisibleArmiesForChunk(startRow, startCol);

    // Reset all model instances
    this.armyModel.resetInstanceCounts();

    let currentCount = 0;
    this.visibleArmies.forEach((army) => {
      const position = this.getArmyWorldPosition(army.entityId, army.hexCoords);
      this.armyModel.dummyObject.position.copy(position);
      this.armyModel.dummyObject.scale.copy(this.scale);
      this.armyModel.dummyObject.updateMatrix();

      // Update the specific model instance for this entity
      this.armyModel.updateInstance(
        army.entityId,
        currentCount,
        position,
        this.scale,
        undefined,
        new THREE.Color(army.color),
      );

      this.armies.set(army.entityId, { ...army, matrixIndex: currentCount });

      // Increment count and update all meshes
      currentCount++;
      this.armyModel.setVisibleCount(currentCount);
    });

    // Update all model instances
    this.armyModel.updateAllInstances();
    this.updateLabelsForChunk(chunkKey);
  }

  private isArmyVisible(
    army: { entityId: ID; hexCoords: Position; isMine: boolean; color: string },
    startRow: number,
    startCol: number,
  ) {
    const { x, y } = army.hexCoords.getNormalized();
    const isVisible =
      x >= startCol - this.renderChunkSize.width / 2 &&
      x <= startCol + this.renderChunkSize.width / 2 &&
      y >= startRow - this.renderChunkSize.height / 2 &&
      y <= startRow + this.renderChunkSize.height / 2;
    return isVisible;
  }

  private getVisibleArmiesForChunk(startRow: number, startCol: number): Array<ArmyData> {
    const visibleArmies = Array.from(this.armies.entries())
      .filter(([_, army]) => {
        return this.isArmyVisible(army, startRow, startCol);
      })
      .map(([entityId, army], index) => ({
        entityId,
        hexCoords: army.hexCoords,
        isMine: army.isMine,
        color: army.color,
        matrixIndex: index,
        owner: army.owner,
      }));

    return visibleArmies;
  }

  private updateLabelsForChunk(chunkKey: string) {
    // Remove all existing labels
    this.labels.forEach((label) => this.scene.remove(label));
    this.labels.clear();

    this.visibleArmies.forEach((army) => {
      const position = this.getArmyWorldPosition(army.entityId, army.hexCoords);
      const label = this.labelManager.createLabel(position, army.isMine ? myColor : neutralColor);
      this.labels.set(army.entityId, label);
      this.scene.add(label);
    });
  }

  public addArmy(entityId: ID, hexCoords: Position, owner: { address: bigint }, order: number) {
    if (this.armies.has(entityId)) return;

    // Determine model type based on order or other criteria
    const modelType = "knight"; // This could be dynamic based on army type
    this.armyModel.assignModelToEntity(entityId, modelType);

    const orderColor = orders.find((_order) => _order.orderId === order)?.color || "#000000";
    this.armies.set(entityId, {
      entityId,
      matrixIndex: this.armies.size - 1,
      hexCoords,
      isMine: isAddressEqualToAccount(owner.address),
      owner,
      color: orderColor,
    });
    this.renderVisibleArmies(this.currentChunkKey!);
  }

  public moveArmy(entityId: ID, hexCoords: Position) {
    const armyData = this.armies.get(entityId);
    if (!armyData) {
      return;
    }

    const { x, y } = hexCoords.getNormalized();
    const { x: armyDataX, y: armyDataY } = armyData.hexCoords.getNormalized();
    if (armyDataX === x && armyDataY === y) {
      return;
    }

    this.armies.set(entityId, { ...armyData, hexCoords });

    if (!this.visibleArmies.some((army) => army.entityId === entityId)) {
      return;
    }

    const newPosition = this.getArmyWorldPosition(entityId, hexCoords);
    const currentPosition = new THREE.Vector3();
    const modelData = this.armyModel.getModelForEntity(entityId);
    if (modelData) {
      modelData.mesh.getMatrixAt(armyData.matrixIndex, this.armyModel.dummyObject.matrix);
      currentPosition.setFromMatrixPosition(this.armyModel.dummyObject.matrix);
      this.armyModel.setAnimationState(armyData.matrixIndex, true);
      this.movingArmies.set(entityId, {
        startPos: currentPosition,
        endPos: newPosition,
        progress: 0,
        matrixIndex: armyData.matrixIndex,
      });

      this.movingLabels.set(entityId, {
        startPos: currentPosition,
        endPos: newPosition,
        progress: 0,
      });
    }
  }

  public removeArmy(entityId: ID) {
    if (!this.armies.delete(entityId)) return;

    this.renderVisibleArmies(this.currentChunkKey!);

    const label = this.labels.get(entityId);
    if (label) {
      this.labelManager.removeLabel(label, this.scene);
      this.labels.delete(entityId);
    }
  }

  public getArmies() {
    return Array.from(this.armies.values());
  }

  update(deltaTime: number) {
    let needsBoundingUpdate = false;
    const movementSpeed = 1.25; // Constant movement speed

    this.movingArmies.forEach((movement, entityId) => {
      const armyData = this.visibleArmies.find((army) => army.entityId === entityId);
      if (!armyData) {
        // delete the movement from the map
        this.armyModel.setAnimationState(movement.matrixIndex, false); // Set back to idle animation
        this.movingArmies.delete(entityId);
        return;
      }

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
      const { col, row } = getHexForWorldPosition({ x: position.x, y: position.y, z: position.z });
      const biome = this.biome.getBiome(col + FELT_CENTER, row + FELT_CENTER);
      if (biome === BiomeType.Ocean || biome === BiomeType.DeepOcean) {
        this.armyModel.assignModelToEntity(entityId, "boat");
      } else {
        this.armyModel.assignModelToEntity(entityId, "knight");
      }

      const direction = new THREE.Vector3().subVectors(movement.endPos, movement.startPos).normalize();
      const angle = Math.atan2(direction.x, direction.z);
      this.armyModel.dummyObject.rotation.set(0, angle + (Math.PI * 3) / 6, 0);

      this.armyModel.updateInstance(entityId, matrixIndex, position, this.scale);
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

  recheckOwnership() {
    this.armies.forEach((army) => {
      army.isMine = isAddressEqualToAccount(army.owner.address);
    });
  }
}
