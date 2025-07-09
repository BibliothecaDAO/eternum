import { useAccountStore } from "@/hooks/store/use-account-store";
import { ArmyModel } from "@/three/managers/army-model";
import { CameraView, HexagonScene } from "@/three/scenes/hexagon-scene";
import { GUIManager } from "@/three/utils/";
import { isAddressEqualToAccount } from "@/three/utils/utils";
import { Position } from "@/types/position";
import { COLORS } from "@/ui/features/settlement";
import { getCharacterName } from "@/utils/agent";
import { Biome, configManager, getTroopName } from "@bibliothecadao/eternum";
import { BiomeType, ContractAddress, HexEntityInfo, ID, orders, TroopTier, TroopType } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { ArmyData, ArmySystemUpdate, RenderChunkSize } from "../types";
import { getWorldPositionForHex, hashCoordinates } from "../utils";
import {
  createContentContainer,
  createLabelBase,
  createOwnerDisplayElement,
  findShortestPath,
  LABEL_STYLES,
  TIERS_TO_STARS,
} from "../utils/";
import { FXManager } from "./fx-manager";

const myColor = new THREE.Color(0, 1.5, 0);
const neutralColor = new THREE.Color(0xffffff);

export class ArmyManager {
  private scene: THREE.Scene;
  private armyModel: ArmyModel;
  private armies: Map<ID, ArmyData> = new Map();
  private scale: THREE.Vector3;
  private currentChunkKey: string | null = "190,170";
  private renderChunkSize: RenderChunkSize;
  private visibleArmies: ArmyData[] = [];
  private armyPaths: Map<ID, Position[]> = new Map();
  private entityIdLabels: Map<ID, CSS2DObject> = new Map();
  private labelsGroup: THREE.Group;
  private currentCameraView: CameraView;
  private hexagonScene?: HexagonScene;
  private fxManager: FXManager;
  private armyRelicEffects: Map<ID, Array<{ relicNumber: number; fx: { end: () => void } }>> = new Map();

  constructor(
    scene: THREE.Scene,
    renderChunkSize: { width: number; height: number },
    labelsGroup?: THREE.Group,
    hexagonScene?: HexagonScene,
  ) {
    this.scene = scene;
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;
    this.armyModel = new ArmyModel(scene, labelsGroup, this.currentCameraView);
    this.scale = new THREE.Vector3(0.3, 0.3, 0.3);
    this.renderChunkSize = renderChunkSize;
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onRightClick = this.onRightClick.bind(this);
    this.labelsGroup = labelsGroup || new THREE.Group();
    this.hexagonScene = hexagonScene;
    this.fxManager = new FXManager(scene, 1);

    // Subscribe to camera view changes if scene is provided
    if (hexagonScene) {
      hexagonScene.addCameraViewListener(this.handleCameraViewChange);
    }

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
              false,
              false,
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
    const { entityId, hexCoords, owner, troopType, troopTier, order } = update;

    const newPosition = new Position({ x: hexCoords.col, y: hexCoords.row });

    if (this.armies.has(entityId)) {
      this.moveArmy(entityId, newPosition, armyHexes, structureHexes, exploredTiles);
    } else {
      this.addArmy(entityId, newPosition, owner, order, troopType, troopTier, update.isDaydreamsAgent, update.isAlly);
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

    // Clear existing relic effects before re-rendering
    this.armyRelicEffects.forEach((effects, entityId) => {
      effects.forEach((effect) => effect.fx.end());
    });
    this.armyRelicEffects.clear();

    let currentCount = 0;
    this.visibleArmies.forEach((army) => {
      const position = this.getArmyWorldPosition(army.entityId, army.hexCoords);
      const { x, y } = army.hexCoords.getContract();
      const biome = Biome.getBiome(x, y);
      const modelType = this.armyModel.getModelTypeForEntity(army.entityId, army.category, army.tier, biome);
      this.armyModel.assignModelToEntity(army.entityId, modelType);

      if (army.isDaydreamsAgent) {
        this.armyModel.setIsAgent(true);
      }

      const rotationSeed = hashCoordinates(x, y);
      const rotationIndex = Math.floor(rotationSeed * 6);
      const randomRotation = (rotationIndex * Math.PI) / 3;
      // Update the specific model instance for this entity
      this.armyModel.updateInstance(
        army.entityId,
        currentCount,
        position,
        this.scale,
        new THREE.Euler(0, randomRotation, 0),
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

      // Add random relic effects for demo
      this.addRandomRelicEffects(army.entityId, position);
    });

    // Remove labels for armies that are no longer visible
    this.entityIdLabels.forEach((label, entityId) => {
      if (!this.visibleArmies.find((army) => army.entityId === entityId)) {
        this.removeEntityIdLabel(entityId);
      }
    });

    // Update all model instances
    this.armyModel.updateAllInstances();
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
        isAlly: army.isAlly,
        order: army.order,
        category: army.category,
        tier: army.tier,
        isDaydreamsAgent: army.isDaydreamsAgent,
      }));

    return visibleArmies;
  }

  public addArmy(
    entityId: ID,
    hexCoords: Position,
    owner: { address: bigint; ownerName: string; guildName: string },
    order: number,
    category: TroopType,
    tier: TroopTier,
    isDaydreamsAgent: boolean,
    isAlly: boolean,
  ) {
    if (this.armies.has(entityId)) return;

    const { x, y } = hexCoords.getContract();
    const biome = Biome.getBiome(x, y);
    const modelType = this.armyModel.getModelTypeForEntity(entityId, category, tier, biome);
    this.armyModel.assignModelToEntity(entityId, modelType);

    const orderData = orders.find((_order) => _order.orderId === order);
    const isMine = isAddressEqualToAccount(owner.address);

    // Determine the color based on ownership (consistent with structure labels)
    let color;
    if (isDaydreamsAgent) {
      color = COLORS.SELECTED;
    } else if (isMine) {
      color = LABEL_STYLES.MINE.textColor;
    } else if (isAlly) {
      color = LABEL_STYLES.ALLY.textColor;
    } else {
      color = LABEL_STYLES.ENEMY.textColor;
    }

    this.armies.set(entityId, {
      entityId,
      matrixIndex: this.armies.size - 1,
      hexCoords,
      isMine,
      isAlly,
      owner,
      color,
      order: orderData?.orderName || "",
      category,
      tier,
      isDaydreamsAgent,
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
    const maxTroopStamina = configManager.getTroopStaminaConfig(TroopType.Paladin, TroopTier.T3);
    const maxHex = Math.floor(Number(maxTroopStamina) / configManager.getMinTravelStaminaCost());

    const path = findShortestPath(armyData.hexCoords, hexCoords, exploredTiles, structureHexes, armyHexes, maxHex);

    if (!path || path.length === 0) {
      // If no path is found, just teleport the army to the target position
      this.armies.set(entityId, { ...armyData, hexCoords });
      return;
    }

    // Convert path to world positions
    const worldPath = path.map((pos) => this.getArmyWorldPosition(entityId, pos));

    // Update army position immediately to avoid starting from a "back" position
    this.armies.set(entityId, { ...armyData, hexCoords });
    this.armyPaths.set(entityId, path);

    // Update relic effects position when army moves
    const relicEffects = this.armyRelicEffects.get(entityId);
    if (relicEffects) {
      // Remove old effects
      relicEffects.forEach((effect) => effect.fx.end());
      this.armyRelicEffects.delete(entityId);
      
      // Re-add effects at new position
      const targetWorldPos = this.getArmyWorldPosition(entityId, hexCoords);
      this.addRandomRelicEffects(entityId, targetWorldPos);
    }

    // Start movement in ArmyModel with troop information
    this.armyModel.startMovement(entityId, worldPath, armyData.matrixIndex, armyData.category, armyData.tier);
  }

  private addRandomRelicEffects(entityId: ID, position: THREE.Vector3) {
    // Generate random number of relics (1-3)
    const numRelics = Math.floor(Math.random() * 3) + 1;
    const relicEffects: Array<{ relicNumber: number; fx: { end: () => void } }> = [];

    for (let i = 0; i < numRelics; i++) {
      // Random relic between 40-56
      const relicNumber = Math.floor(Math.random() * 17) + 40;
      
      // Register the relic FX if not already registered
      this.fxManager.registerRelicFX(relicNumber);
      
      // Play the relic effect at army position, elevated above the label
      const fx = this.fxManager.playFxAtCoords(
        `relic_${relicNumber}`,
        position.x,
        position.y + 1.5, // Position closer to the character
        position.z,
        0.8, // Smaller size for relics
        undefined,
        true // Infinite effect
      );
      
      relicEffects.push({ relicNumber, fx });
    }

    this.armyRelicEffects.set(entityId, relicEffects);
  }

  public addRelicEffect(entityId: ID, relicNumber: number) {
    const army = this.armies.get(entityId);
    if (!army) return;

    const position = this.getArmyWorldPosition(entityId, army.hexCoords);
    
    // Register the relic FX if not already registered
    this.fxManager.registerRelicFX(relicNumber);
    
    // Play the relic effect
    const fx = this.fxManager.playFxAtCoords(
      `relic_${relicNumber}`,
      position.x,
      position.y + 1.5,
      position.z,
      0.8,
      undefined,
      true
    );

    // Add to existing effects or create new array
    const existingEffects = this.armyRelicEffects.get(entityId) || [];
    existingEffects.push({ relicNumber, fx });
    this.armyRelicEffects.set(entityId, existingEffects);
  }

  public removeRelicEffect(entityId: ID, relicNumber: number) {
    const effects = this.armyRelicEffects.get(entityId);
    if (!effects) return;

    const index = effects.findIndex((effect) => effect.relicNumber === relicNumber);
    if (index !== -1) {
      effects[index].fx.end();
      effects.splice(index, 1);
      
      if (effects.length === 0) {
        this.armyRelicEffects.delete(entityId);
      }
    }
  }

  public removeAllRelicEffects(entityId: ID) {
    const effects = this.armyRelicEffects.get(entityId);
    if (!effects) return;

    effects.forEach((effect) => effect.fx.end());
    this.armyRelicEffects.delete(entityId);
  }

  public removeArmy(entityId: ID) {
    if (!this.armies.has(entityId)) return;

    // Remove any relic effects
    this.removeAllRelicEffects(entityId);

    const { promise } = this.fxManager.playFxAtCoords(
      "skull",
      this.getArmyWorldPosition(entityId, this.armies.get(entityId)!.hexCoords).x,
      this.getArmyWorldPosition(entityId, this.armies.get(entityId)!.hexCoords).y + 2,
      this.getArmyWorldPosition(entityId, this.armies.get(entityId)!.hexCoords).z,
      1,
      "Defeated!",
    );
    promise.then(() => {
      this.armies.delete(entityId);
      this.armyModel.removeLabel(entityId);
      this.entityIdLabels.delete(entityId);
      this.renderVisibleArmies(this.currentChunkKey!);
    });
  }

  public getArmies() {
    return Array.from(this.armies.values());
  }

  update(deltaTime: number) {
    // Update movements in ArmyModel
    this.armyModel.updateMovements(deltaTime);
    this.armyModel.updateAnimations(deltaTime);
  }

  private getArmyWorldPosition = (_armyEntityId: ID, hexCoords: Position, isIntermediatePosition: boolean = false) => {
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
    // Create base label using shared utility
    const labelDiv = createLabelBase({
      isMine: army.isMine,
      isAlly: army.isAlly,
      isDaydreamsAgent: army.isDaydreamsAgent,
      // No need to specify textColor - it will use LABEL_STYLES from our utility
    });

    // Prevent right click
    labelDiv.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    // Add army icon
    const img = document.createElement("img");
    img.src = army.isDaydreamsAgent
      ? "/images/logos/daydreams.png"
      : `/images/labels/${army.isMine ? "army" : army.isAlly ? "allies_army" : "enemy_army"}.png`;
    img.classList.add("w-auto", "h-full", "inline-block", "object-contain", "max-w-[32px]");
    labelDiv.appendChild(img);

    // Create text container with transition using shared utility
    const textContainer = createContentContainer(this.currentCameraView);

    // Add owner information using shared component
    const line1 = createOwnerDisplayElement({
      owner: army.owner,
      isMine: army.isMine,
      isAlly: army.isAlly,
      cameraView: this.currentCameraView,
      color: army.color, // Use the color directly from the army data
      isDaydreamsAgent: army.isDaydreamsAgent,
    });

    // Add troop type information with consistent styling
    const line2 = document.createElement("strong");
    if (army.isDaydreamsAgent) {
      line2.textContent = `${getCharacterName(army.tier, army.category, army.entityId)}`;
    } else {
      line2.textContent = `${getTroopName(army.category, army.tier)} ${TIERS_TO_STARS[army.tier]}`;
    }

    textContainer.appendChild(line1);
    textContainer.appendChild(line2);
    labelDiv.appendChild(textContainer);

    const label = new CSS2DObject(labelDiv);
    label.position.copy(position);
    label.position.y += 2.1;

    // Store original renderOrder
    const originalRenderOrder = label.renderOrder;

    // Set renderOrder to Infinity on hover
    labelDiv.addEventListener("mouseenter", () => {
      label.renderOrder = Infinity;
    });

    // Restore original renderOrder when mouse leaves
    labelDiv.addEventListener("mouseleave", () => {
      label.renderOrder = originalRenderOrder;
    });

    this.entityIdLabels.set(army.entityId, label);
    this.armyModel.addLabel(army.entityId, label);
  }

  removeLabelsFromScene() {
    this.armyModel.removeLabelsFromScene();
  }

  addLabelsToScene() {
    this.armyModel.addLabelsToScene();
  }

  private removeEntityIdLabel(entityId: ID) {
    this.armyModel.removeLabel(entityId);
    this.entityIdLabels.delete(entityId);
  }

  private handleCameraViewChange = (view: CameraView) => {
    if (this.currentCameraView === view) return;
    this.currentCameraView = view;

    // Update the ArmyModel's camera view
    this.armyModel.setCurrentCameraView(view);

    // Update all existing labels to reflect the new view
    this.visibleArmies.forEach((army) => {
      this.armyModel.updateLabelVisibility(army.entityId, view === CameraView.Far);
    });
  };

  public destroy() {
    // Clean up camera view listener
    if (this.hexagonScene) {
      this.hexagonScene.removeCameraViewListener(this.handleCameraViewChange);
    }
    // Clean up relic effects
    this.armyRelicEffects.forEach((effects) => {
      effects.forEach((effect) => effect.fx.end());
    });
    this.armyRelicEffects.clear();
    // Clean up any other resources...
  }
}
