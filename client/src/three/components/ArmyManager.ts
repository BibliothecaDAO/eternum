import { useAccountStore } from "@/hooks/context/accountStore";
import { ArmyData, MovingArmyData, MovingLabelData, RenderChunkSize } from "@/types";
import { Position } from "@/types/Position";
import { calculateOffset, getHexForWorldPosition, getWorldPositionForHex } from "@/ui/utils/utils";
import { BiomeType, ContractAddress, FELT_CENTER, ID, orders } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { GUIManager } from "../helpers/GUIManager";
import { findShortestPath } from "../helpers/pathfinding";
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
  private armyPaths: Map<ID, Position[]> = new Map();
  private exploredTiles: Map<number, Set<number>>;
  private entityIdLabels: Map<ID, CSS2DObject> = new Map();

  constructor(
    scene: THREE.Scene,
    renderChunkSize: { width: number; height: number },
    exploredTiles: Map<number, Set<number>>,
  ) {
    this.scene = scene;
    this.armyModel = new ArmyModel(scene);
    this.scale = new THREE.Vector3(0.3, 0.3, 0.3);
    this.labelManager = new LabelManager("textures/army_label.png", 1.5);
    this.renderChunkSize = renderChunkSize;
    this.biome = new Biome();
    this.exploredTiles = exploredTiles;
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
                // TODO: Add owner name and guild name
                ownerName: "Neutral",
                guildName: "None",
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
        return true;
      } else {
        return false;
      }
    }

    if (battleId !== 0) {
      if (this.armies.has(entityId)) {
        this.removeArmy(entityId);
        return true;
      } else {
        return false;
      }
    }

    const position = new Position({ x: hexCoords.col, y: hexCoords.row });

    if (this.armies.has(entityId)) {
      this.moveArmy(entityId, position);
    } else {
      this.addArmy(entityId, position, owner, order);
    }
    return false;
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
      // this.armyModel.dummyObject.position.copy(position);
      // this.armyModel.dummyObject.scale.copy(this.scale);
      // this.armyModel.dummyObject.updateMatrix();
      // Determine model type based on order or other criteria
      const { x, y } = army.hexCoords.getContract();
      const biome = this.biome.getBiome(x, y);
      if (biome === BiomeType.Ocean || biome === BiomeType.DeepOcean) {
        this.armyModel.assignModelToEntity(army.entityId, "boat");
      } else {
        this.armyModel.assignModelToEntity(army.entityId, "knight");
      }

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

      // Add or update entity ID label
      if (this.entityIdLabels.has(army.entityId)) {
        const label = this.entityIdLabels.get(army.entityId)!;
        label.position.copy(position);
        label.position.y += 1.5;
      } else {
        this.addEntityIdLabel(army, position);
      }
    });

    // Remove labels for armies that are no longer visible
    this.entityIdLabels.forEach((label, entityId) => {
      if (!this.visibleArmies.find((army) => army.entityId === entityId)) {
        this.removeEntityIdLabel(entityId);
      }
    });

    // Update all model instances
    this.armyModel.updateAllInstances();
    this.updateLabelsForChunk(chunkKey);
    this.armyModel.computeBoundingSphere();
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
        order: army.order,
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
      //this.scene.add(label);
    });
  }

  public addArmy(
    entityId: ID,
    hexCoords: Position,
    owner: { address: bigint; ownerName: string; guildName: string },
    order: number,
  ) {
    if (this.armies.has(entityId)) return;

    // Determine model type based on order or other criteria
    const { x, y } = hexCoords.getContract();
    const biome = this.biome.getBiome(x, y);
    if (biome === BiomeType.Ocean || biome === BiomeType.DeepOcean) {
      this.armyModel.assignModelToEntity(entityId, "boat");
    } else {
      this.armyModel.assignModelToEntity(entityId, "knight");
    }

    const orderData = orders.find((_order) => _order.orderId === order);
    this.armies.set(entityId, {
      entityId,
      matrixIndex: this.armies.size - 1,
      hexCoords,
      isMine: isAddressEqualToAccount(owner.address),
      owner,
      color: orderData?.color || "#000000",
      order: orderData?.orderName || "",
    });
    this.renderVisibleArmies(this.currentChunkKey!);
  }

  public moveArmy(entityId: ID, hexCoords: Position) {
    const armyData = this.armies.get(entityId);
    if (!armyData) return;

    const { x: startX, y: startY } = armyData.hexCoords.getNormalized();
    const { x: targetX, y: targetY } = hexCoords.getNormalized();

    if (startX === targetX && startY === targetY) return;

    const path = findShortestPath(armyData.hexCoords, hexCoords, this.exploredTiles);

    if (!path || path.length === 0) return;

    // Set initial direction before movement starts
    const firstHex = path[0];
    const currentPosition = this.getArmyWorldPosition(entityId, armyData.hexCoords);
    const newPosition = this.getArmyWorldPosition(entityId, firstHex);

    const direction = new THREE.Vector3().subVectors(newPosition, currentPosition).normalize();
    const angle = Math.atan2(direction.x, direction.z);
    this.armyModel.dummyObject.rotation.set(0, angle + (Math.PI * 3) / 6, 0);

    // Update army position immediately to avoid starting from a "back" position
    this.armies.set(entityId, { ...armyData, hexCoords });
    this.armyPaths.set(entityId, path);

    const modelData = this.armyModel.getModelForEntity(entityId);
    if (modelData) {
      this.armyModel.setAnimationState(armyData.matrixIndex, true);

      this.movingArmies.set(entityId, {
        startPos: currentPosition,
        endPos: newPosition,
        progress: 0,
        matrixIndex: armyData.matrixIndex,
        currentPathIndex: 0,
      });

      // Sync label movement with army movement
      const label = this.labels.get(entityId);
      if (label) {
        this.movingLabels.set(entityId, {
          startPos: currentPosition.clone(),
          endPos: newPosition.clone(),
          progress: 0,
        });
      }
    }
  }

  public removeArmy(entityId: ID) {
    if (!this.armies.delete(entityId)) return;

    this.removeEntityIdLabel(entityId);
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
    const movementSpeed = 1.25;

    this.movingArmies.forEach((movement, entityId) => {
      const armyData = this.visibleArmies.find((army) => army.entityId === entityId);
      if (!armyData) {
        this.armyModel.setAnimationState(movement.matrixIndex, false);
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

        // Check if there are more hexes in the path
        const path = this.armyPaths.get(entityId);
        if (path && movement.currentPathIndex < path.length - 1) {
          movement.currentPathIndex++;
          const nextHex = path[movement.currentPathIndex];
          const isLastPosition = movement.currentPathIndex === path.length - 1;
          const nextPosition = this.getArmyWorldPosition(entityId, nextHex, !isLastPosition);

          movement.startPos = movement.endPos;
          movement.endPos = nextPosition;
          movement.progress = 0;
        } else {
          // Path complete
          this.movingArmies.delete(entityId);
          this.armyPaths.delete(entityId);
          this.armyModel.setAnimationState(matrixIndex, false);
        }
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

      // Update label position
      const label = this.entityIdLabels.get(entityId);
      if (label) {
        label.position.copy(position);
        label.position.y += 1.5;
      }
    });

    if (this.movingArmies.size > 0) {
      this.armyModel.updateInstanceMatrix();
    }

    this.movingLabels.forEach((movement, entityId) => {
      const label = this.labels.get(entityId);
      if (label) {
        // Get the current army position from moving armies
        const armyMovement = this.movingArmies.get(entityId);
        if (armyMovement) {
          const currentPos = new THREE.Vector3()
            .copy(armyMovement.startPos)
            .lerp(armyMovement.endPos, armyMovement.progress);
          this.labelManager.updateLabelPosition(label, currentPos);
        } else {
          this.movingLabels.delete(entityId);
        }
      }
    });

    if (needsBoundingUpdate) {
      this.armyModel.computeBoundingSphere();
    }

    this.armyModel.updateAnimations(deltaTime);
  }

  private getArmyWorldPosition = (armyEntityId: ID, hexCoords: Position, isIntermediatePosition: boolean = false) => {
    const { x: hexCoordsX, y: hexCoordsY } = hexCoords.getNormalized();
    const basePosition = getWorldPositionForHex({ col: hexCoordsX, row: hexCoordsY });

    if (isIntermediatePosition) return basePosition;

    const totalOnSameHex = Array.from(this.armies.values()).filter((army) => {
      const { x, y } = army.hexCoords.getNormalized();
      return x === hexCoordsX && y === hexCoordsY;
    }).length;

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

  private async addEntityIdLabel(army: ArmyData, position: THREE.Vector3) {
    const labelDiv = document.createElement("div");
    labelDiv.classList.add(
      "rounded-md",
      "bg-brown/50",
      "text-gold",
      "p-1",
      "-translate-x-1/2",
      "text-xs",
      "flex",
      "items-center",
    );
    const orderName = army.order.toLowerCase();
    const img = document.createElement("img");
    img.src = `/images/orders/${orderName}.png`;
    img.classList.add("w-[24px]", "h-[24px]", "inline-block", "mr-2", "object-contain");
    labelDiv.appendChild(img);

    const textContainer = document.createElement("div");
    textContainer.classList.add("flex", "flex-col");

    const line1 = document.createTextNode(`${army.owner.ownerName} ${army.owner.guildName ? `(${army.order})` : ""}`);
    const line2 = document.createElement("strong");
    line2.textContent = `${army.owner.guildName ? army.owner.guildName : army.order}`;

    textContainer.appendChild(line1);
    textContainer.appendChild(line2);

    labelDiv.appendChild(textContainer);

    const label = new CSS2DObject(labelDiv);
    label.position.copy(position);
    label.position.y += 1.5; // Position above the army

    this.scene.add(label);
    this.entityIdLabels.set(army.entityId, label);
  }

  removeLabelsFromScene() {
    this.entityIdLabels.forEach((label) => this.scene.remove(label));
  }

  addLabelsToScene() {
    this.entityIdLabels.forEach((label) => {
      if (!this.scene.children.includes(label)) {
        this.scene.add(label);
      }
    });
  }

  private removeEntityIdLabel(entityId: ID) {
    const label = this.entityIdLabels.get(entityId);
    if (label) {
      this.scene.remove(label);
      this.entityIdLabels.delete(entityId);
    }
  }
}
