import { useAccountStore } from "@/hooks/store/use-account-store";
import { GUIManager } from "@/three/helpers/gui-manager";
import { isAddressEqualToAccount } from "@/three/helpers/utils";
import { ArmyModel, ModelType, TROOP_TO_MODEL } from "@/three/managers/army-model";
import { LabelManager } from "@/three/managers/label-manager";
import { Position } from "@/types/position";
import {
  Biome,
  BiomeType,
  configManager,
  ContractAddress,
  HexEntityInfo,
  ID,
  orders,
  TroopTier,
  TroopType,
} from "@bibliothecadao/eternum";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { findShortestPath } from "../helpers/pathfinding";
import { ArmyData, ArmySystemUpdate, MovingArmyData, MovingLabelData, RenderChunkSize } from "../types";
import { getWorldPositionForHex } from "../utils";

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
  private armyPaths: Map<ID, Position[]> = new Map();
  private entityIdLabels: Map<ID, CSS2DObject> = new Map();

  constructor(scene: THREE.Scene, renderChunkSize: { width: number; height: number }) {
    this.scene = scene;
    this.armyModel = new ArmyModel(scene);
    this.scale = new THREE.Vector3(0.3, 0.3, 0.3);
    this.labelManager = new LabelManager("textures/army_label.png", 1.5);
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
              {
                address: createArmyParams.isMine
                  ? ContractAddress(useAccountStore.getState().account?.address || "0")
                  : 0n,
                // TODO: Add owner name and guild name
                ownerName: "Neutral",
                guildName: "None",
              },
              1,
              TroopType.Paladin,
              TroopTier.T1,
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

  async onUpdate(
    update: ArmySystemUpdate,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    structureHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredTiles: Map<number, Map<number, BiomeType>>,
  ) {
    await this.armyModel.loadPromise;
    const { entityId, hexCoords, owner, troopType, troopTier, order, deleted } = update;

    // If the army is marked as deleted, remove it from the map
    if (deleted) {
      if (this.armies.has(entityId)) {
        this.removeArmy(entityId);
        return true;
      }
      return false;
    }

    const newPosition = new Position({ x: hexCoords.col, y: hexCoords.row });

    if (this.armies.has(entityId)) {
      this.moveArmy(entityId, newPosition, armyHexes, structureHexes, exploredTiles);
    } else {
      this.addArmy(entityId, newPosition, owner, order, troopType, troopTier);
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

  private getModelTypeForBiome(biome: BiomeType, troopType: TroopType, troopTier: TroopTier): ModelType {
    // For water biomes, always return boat model regardless of troop type
    if (biome === BiomeType.Ocean || biome === BiomeType.DeepOcean) {
      return ModelType.Boat;
    }

    // For land biomes, return the appropriate model based on troop type and tier
    return TROOP_TO_MODEL[troopType][troopTier];
  }

  private renderVisibleArmies(chunkKey: string) {
    const [startRow, startCol] = chunkKey.split(",").map(Number);
    this.visibleArmies = this.getVisibleArmiesForChunk(startRow, startCol);

    // Reset all model instances
    this.armyModel.resetInstanceCounts();

    let currentCount = 0;
    this.visibleArmies.forEach((army) => {
      const position = this.getArmyWorldPosition(army.entityId, army.hexCoords);
      const { x, y } = army.hexCoords.getContract();
      const biome = Biome.getBiome(x, y);
      const modelType = this.getModelTypeForBiome(biome, army.category, army.tier);
      this.armyModel.assignModelToEntity(army.entityId, modelType);

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
        category: army.category,
        tier: army.tier,
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
    category: TroopType,
    tier: TroopTier,
  ) {
    if (this.armies.has(entityId)) return;

    const { x, y } = hexCoords.getContract();
    const biome = Biome.getBiome(x, y);
    const modelType = this.getModelTypeForBiome(biome, category, tier);
    this.armyModel.assignModelToEntity(entityId, modelType);

    const orderData = orders.find((_order) => _order.orderId === order);
    this.armies.set(entityId, {
      entityId,
      matrixIndex: this.armies.size - 1,
      hexCoords,
      isMine: isAddressEqualToAccount(owner.address),
      owner,
      color: orderData?.color || "#000000",
      order: orderData?.orderName || "",
      category,
      tier,
    });
    this.renderVisibleArmies(this.currentChunkKey!);
  }

  public moveArmy(
    entityId: ID,
    hexCoords: Position,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    structureHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredTiles: Map<number, Map<number, BiomeType>>,
  ) {
    const armyData = this.armies.get(entityId);
    if (!armyData) return;

    const startPos = armyData.hexCoords.getNormalized();
    const targetPos = hexCoords.getNormalized();

    if (startPos.x === targetPos.x && startPos.y === targetPos.y) return;

    // todo: currently taking max stamina of paladin as max stamina but need to refactor
    const maxTroopStamina = configManager.getTroopStaminaConfig(TroopType.Paladin);
    const maxHex = Math.floor(Number(maxTroopStamina) / configManager.getMinTravelStaminaCost());

    const path = findShortestPath(armyData.hexCoords, hexCoords, exploredTiles, structureHexes, armyHexes, maxHex);

    if (!path || path.length === 0) return;

    // Convert path to world positions
    const worldPath = path.map((pos) => this.getArmyWorldPosition(entityId, pos));

    // Update army position immediately to avoid starting from a "back" position
    this.armies.set(entityId, { ...armyData, hexCoords });
    this.armyPaths.set(entityId, path);

    // Start movement in ArmyModel with troop information
    this.armyModel.startMovement(entityId, worldPath, armyData.matrixIndex, armyData.category, armyData.tier);
  }

  public removeArmy(entityId: ID) {
    if (!this.armies.delete(entityId)) return;

    this.armyModel.removeLabel(entityId);
    this.renderVisibleArmies(this.currentChunkKey!);
  }

  public getArmies() {
    return Array.from(this.armies.values());
  }

  update(deltaTime: number) {
    // Update movements in ArmyModel
    this.armyModel.updateMovements(deltaTime);
    this.armyModel.updateAnimations(deltaTime);
  }

  private getArmyWorldPosition = (armyEntityId: ID, hexCoords: Position, isIntermediatePosition: boolean = false) => {
    const { x: hexCoordsX, y: hexCoordsY } = hexCoords.getNormalized();
    const basePosition = getWorldPositionForHex({ col: hexCoordsX, row: hexCoordsY });

    if (isIntermediatePosition) return basePosition;

    return basePosition;
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
    const line3 = document.createElement("strong");
    line3.textContent = `${army.category} ${army.tier}`;

    textContainer.appendChild(line1);
    textContainer.appendChild(line2);
    textContainer.appendChild(line3);

    labelDiv.appendChild(textContainer);

    this.armyModel.addLabel(army.entityId, labelDiv, position);
  }

  removeLabelsFromScene() {
    this.armyModel.removeLabelsFromScene();
  }

  addLabelsToScene() {
    this.armyModel.addLabelsToScene();
  }

  private removeEntityIdLabel(entityId: ID) {
    this.armyModel.removeLabel(entityId);
  }
}
