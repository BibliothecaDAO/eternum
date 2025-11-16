import { QuestModelPaths } from "@/three/constants";
import InstancedModel from "@/three/managers/instanced-model";
import { FELT_CENTER } from "@/ui/config";
import { Position, QuestData, QuestSystemUpdate } from "@bibliothecadao/eternum";

import { ID, QuestType } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { CameraView, HexagonScene } from "../scenes/hexagon-scene";
import { RenderChunkSize } from "../types/common";
import { getWorldPositionForHex, hashCoordinates } from "../utils";
import { FrustumManager } from "../utils/frustum-manager";
import { QuestLabelData, QuestLabelType } from "../utils/labels/label-factory";
import { LabelManager } from "../utils/labels/label-manager";
import { gltfLoader } from "../utils/utils";
const MAX_INSTANCES = 1000;

export class QuestManager {
  private scene: THREE.Scene;
  private questModels: Map<QuestType, InstancedModel[]> = new Map();
  private renderChunkSize: RenderChunkSize;
  private hexagonScene?: HexagonScene;
  private dummy: THREE.Object3D = new THREE.Object3D();
  quests: Quests = new Quests();
  private visibleQuests: QuestData[] = [];
  private currentChunkKey: string | null = "190,170";
  private entityIdMaps: Map<QuestType, Map<number, ID>> = new Map();
  private questInstanceOrder: Map<QuestType, ID[]> = new Map();
  private questInstanceIndices: Map<ID, { questType: QuestType; index: number }> = new Map();
  private scale: number = 1;
  private currentCameraView: CameraView;
  private labelManager: LabelManager;
  questHexCoords: Map<number, Set<number>> = new Map();
  private chunkSwitchPromise: Promise<void> | null = null; // Track ongoing chunk switches
  private frustumManager?: FrustumManager;

  constructor(
    scene: THREE.Scene,
    renderChunkSize: RenderChunkSize,
    labelsGroup?: THREE.Group,
    hexagonScene?: HexagonScene,
    frustumManager?: FrustumManager,
  ) {
    this.scene = scene;
    this.hexagonScene = hexagonScene;
    this.renderChunkSize = renderChunkSize;
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;
    this.frustumManager = frustumManager;

    // Initialize the label manager
    this.labelManager = new LabelManager({
      labelsGroup: labelsGroup || new THREE.Group(),
      initialCameraView: this.currentCameraView,
      maxLabels: 1000,
      autoCleanup: true,
    });

    // Register the quest label type
    this.labelManager.registerLabelType(QuestLabelType);
    this.loadModels().then(() => {
      if (this.currentChunkKey) {
        this.renderVisibleQuests(this.currentChunkKey);
      }
    });

    if (hexagonScene) {
      hexagonScene.addCameraViewListener(this.handleCameraViewChange);
    }
  }

  private handleCameraViewChange = (view: CameraView) => {
    if (this.currentCameraView === view) return;
    this.currentCameraView = view;

    // Update the label manager's camera view
    this.labelManager.updateCameraView(view);
  };

  public destroy() {
    // Clean up camera view listener
    if (this.hexagonScene) {
      this.hexagonScene.removeCameraViewListener(this.handleCameraViewChange);
    }

    // Clean up the label manager
    this.labelManager.destroy();
  }

  private async loadModels(): Promise<void> {
    const loader = gltfLoader;
    for (const [key, modelPath] of Object.entries(QuestModelPaths)) {
      const questType = parseInt(key) as QuestType;

      if (questType === undefined) continue;
      if (!modelPath) continue;

      const loadPromise = new Promise<InstancedModel>((resolve, reject) => {
        loader.load(
          modelPath,
          (gltf) => {
            const instancedModel = new InstancedModel(gltf, MAX_INSTANCES, false, "Quest" + QuestType[questType]);
            resolve(instancedModel);
          },
          undefined,
          (error) => {
            console.error(modelPath);
            console.error(`An error occurred while loading the ${questType} model:`, error);
            reject(error);
          },
        );
      });

      await loadPromise
        .then((instancedModel) => {
          this.questModels.set(questType, [instancedModel]);
          this.scene.add(instancedModel.group);
        })
        .catch((error) => {
          console.error(`Failed to load models for ${QuestType[questType]}:`, error);
        });
    }
  }

  async onUpdate(update: QuestSystemUpdate) {
    const { entityId, occupierId, hexCoords } = update;
    const normalizedCoord = { col: hexCoords.col - FELT_CENTER(), row: hexCoords.row - FELT_CENTER() };
    // Add the quest to the map with the complete owner info
    const position = new Position({ x: hexCoords.col, y: hexCoords.row });
    const questType = QuestType.DarkShuffle;

    if (!this.questHexCoords.has(normalizedCoord.col)) {
      this.questHexCoords.set(normalizedCoord.col, new Set());
    }
    if (!this.questHexCoords.get(normalizedCoord.col)!.has(normalizedCoord.row)) {
      this.questHexCoords.get(normalizedCoord.col)!.add(normalizedCoord.row);
    }

    this.quests.addQuest(entityId, questType, occupierId, position);

    // SPAG Re-render if we have a current chunk
    if (this.currentChunkKey) {
      this.renderVisibleQuests(this.currentChunkKey);
    }
  }

  async updateChunk(chunkKey: string, options?: { force?: boolean }) {
    const force = options?.force ?? false;
    if (!force && this.currentChunkKey === chunkKey) {
      return;
    }

    // Wait for any ongoing chunk switch to complete first
    if (this.chunkSwitchPromise) {
      console.log(`[CHUNK SYNC] Waiting for previous quest chunk switch to complete before switching to ${chunkKey}`);
      try {
        await this.chunkSwitchPromise;
      } catch (error) {
        console.warn(`Previous quest chunk switch failed:`, error);
      }
    }

    // Check again if chunk key is still different (might have changed while waiting)
    if (!force && this.currentChunkKey === chunkKey) {
      return;
    }

    const previousChunk = this.currentChunkKey;
    const isSwitch = previousChunk !== chunkKey;
    if (isSwitch) {
      console.log(`[CHUNK SYNC] Switching quest chunk from ${this.currentChunkKey} to ${chunkKey}`);
      this.currentChunkKey = chunkKey;
    } else if (force) {
      console.log(`[CHUNK SYNC] Refreshing quest chunk ${chunkKey}`);
    }

    // Create and track the chunk switch promise
    this.chunkSwitchPromise = Promise.resolve().then(() => {
      this.renderVisibleQuests(chunkKey);
    });

    try {
      await this.chunkSwitchPromise;
      console.log(`[CHUNK SYNC] Quest chunk ${isSwitch ? "switch" : "refresh"} for ${chunkKey} completed`);
    } finally {
      this.chunkSwitchPromise = null;
    }
  }

  private getQuestWorldPosition = (questEntityId: ID, hexCoords: Position) => {
    const { x: hexCoordsX, y: hexCoordsY } = hexCoords.getNormalized();
    const basePosition = getWorldPositionForHex({ col: hexCoordsX, row: hexCoordsY });
    return basePosition;
  };

  private isQuestVisible(quest: QuestData, startRow: number, startCol: number) {
    const { x, y } = quest.hexCoords.getNormalized();
    const insideChunk =
      x >= startCol - this.renderChunkSize.width / 2 &&
      x <= startCol + this.renderChunkSize.width / 2 &&
      y >= startRow - this.renderChunkSize.height / 2 &&
      y <= startRow + this.renderChunkSize.height / 2;

    if (!insideChunk) {
      return false;
    }

    if (!this.frustumManager) {
      return true;
    }

    const worldPos = this.getQuestWorldPosition(quest.entityId, quest.hexCoords);
    worldPos.y += 0.05;
    return this.frustumManager.isPointVisible(worldPos);
  }

  private getVisibleQuestsForChunk(quests: Map<ID, QuestData>, startRow: number, startCol: number): QuestData[] {
    const visibleQuests = Array.from(quests.values())

      .filter((quest) => {
        return this.isQuestVisible(quest, startRow, startCol);
      })
      .map((quest) => ({
        entityId: quest.entityId,
        questType: quest.questType,
        occupierId: quest.occupierId,
        hexCoords: quest.hexCoords,
      }));

    return visibleQuests;
  }

  private renderVisibleQuests(chunkKey: string) {
    const questsByType = this.quests.getQuests();
    const visibleQuestIds = new Set<ID>();
    const aggregatedVisible: QuestData[] = [];
    const [startRow, startCol] = chunkKey.split(",").map(Number);

    questsByType.forEach((quests, questType) => {
      const visibleQuests = this.getVisibleQuestsForChunk(quests, startRow, startCol);
      aggregatedVisible.push(...visibleQuests);
      visibleQuests.forEach((quest) => visibleQuestIds.add(quest.entityId));
      this.syncQuestInstancesForType(questType, visibleQuests);
    });

    this.visibleQuests = aggregatedVisible;

    const questLabels = this.labelManager.getLabelsByType("quest");
    questLabels.forEach((labelInstance) => {
      if (!visibleQuestIds.has(labelInstance.data.entityId)) {
        this.labelManager.removeLabel(labelInstance.data.entityId);
      }
    });
  }

  private syncQuestInstancesForType(questType: QuestType, visibleQuests: QuestData[]) {
    const models = this.questModels.get(questType);
    if (!models || models.length === 0) {
      return;
    }

    this.ensureQuestTracking(questType);

    const order = this.questInstanceOrder.get(questType)!;
    const visibleSet = new Set(visibleQuests.map((quest) => quest.entityId));

    for (let i = order.length - 1; i >= 0; i--) {
      const entityId = order[i];
      if (!visibleSet.has(entityId)) {
        this.removeQuestInstance(questType, entityId);
      }
    }

    visibleQuests.forEach((quest) => {
      const binding = this.questInstanceIndices.get(quest.entityId);
      if (!binding || binding.questType !== questType) {
        this.addQuestInstance(questType, quest);
      } else {
        this.updateQuestInstance(questType, quest, binding.index);
      }

      this.updateActiveQuestLabel(quest);
    });

    const count = this.questInstanceOrder.get(questType)!.length;
    models.forEach((model) => {
      model.setCount(count);
      model.needsUpdate();
    });
  }

  private ensureQuestTracking(questType: QuestType) {
    if (!this.questInstanceOrder.has(questType)) {
      this.questInstanceOrder.set(questType, []);
    }
    if (!this.entityIdMaps.has(questType)) {
      this.entityIdMaps.set(questType, new Map());
    }
  }

  private addQuestInstance(questType: QuestType, quest: QuestData) {
    const models = this.questModels.get(questType);
    if (!models || models.length === 0) {
      return;
    }

    const order = this.questInstanceOrder.get(questType)!;
    const index = order.length;
    order.push(quest.entityId);
    this.questInstanceIndices.set(quest.entityId, { questType, index });
    this.entityIdMaps.get(questType)!.set(index, quest.entityId);
    this.writeQuestInstance(models[0], quest, index);
  }

  private updateQuestInstance(questType: QuestType, quest: QuestData, index: number) {
    const models = this.questModels.get(questType);
    if (!models || models.length === 0) {
      return;
    }

    this.writeQuestInstance(models[0], quest, index);
    this.entityIdMaps.get(questType)!.set(index, quest.entityId);
  }

  private removeQuestInstance(questType: QuestType, entityId: ID) {
    const models = this.questModels.get(questType);
    if (!models || models.length === 0) {
      return;
    }

    const order = this.questInstanceOrder.get(questType);
    const binding = this.questInstanceIndices.get(entityId);
    if (!order || !binding || binding.questType !== questType) {
      return;
    }

    const index = binding.index;
    const lastIndex = order.length - 1;
    const lastEntityId = order[lastIndex];

    if (index !== lastIndex) {
      order[index] = lastEntityId;
      const swappedQuest = this.quests.getQuest(lastEntityId);
      if (swappedQuest) {
        this.writeQuestInstance(models[0], swappedQuest, index);
      }
      this.questInstanceIndices.set(lastEntityId, { questType, index });
      this.entityIdMaps.get(questType)!.set(index, lastEntityId);
    }

    order.pop();
    this.questInstanceIndices.delete(entityId);
    this.entityIdMaps.get(questType)!.delete(lastIndex);
    this.labelManager.removeLabel(Number(entityId));
  }

  private writeQuestInstance(model: InstancedModel, quest: QuestData, index: number) {
    const position = this.getQuestWorldPosition(quest.entityId, quest.hexCoords);
    position.y += 0.05;
    const { x, y } = quest.hexCoords.getContract();

    this.dummy.position.copy(position);
    const rotationSeed = hashCoordinates(x, y);
    const rotationIndex = Math.floor(rotationSeed * 6);
    const randomRotation = (rotationIndex * Math.PI) / 3;
    this.dummy.rotation.y = randomRotation;
    this.dummy.updateMatrix();

    model.setMatrixAt(index, this.dummy.matrix);
  }

  private updateActiveQuestLabel(quest: QuestData) {
    const activeLabel = this.labelManager.getLabel(Number(quest.entityId));
    if (!activeLabel) {
      return;
    }

    const questLabelData: QuestLabelData = {
      entityId: quest.entityId,
      hexCoords: quest.hexCoords,
      questType: quest.questType,
      occupierId: quest.occupierId,
    };

    this.labelManager.createLabel("quest", questLabelData, {
      cameraView: this.currentCameraView,
    });
  }

  // Label management is now handled by LabelManager

  public removeLabelsFromScene(): void {
    // Label visibility is managed by LabelManager
    // If needed, we could call labelManager.removeAllLabels() here
  }

  public removeLabelsExcept(entityId?: ID): void {
    // Remove all labels except the one with the specified entityId
    const questLabels = this.labelManager.getLabelsByType("quest");
    questLabels.forEach((label, labelEntityId) => {
      if (labelEntityId !== entityId) {
        this.labelManager.removeLabel(labelEntityId);
      }
    });
  }

  public addLabelsToScene(): void {
    // Label visibility is managed by LabelManager
    // Labels are automatically added when created
  }

  public showLabel(entityId: ID): void {
    const quest = this.quests.getQuest(entityId);
    if (!quest) {
      return;
    }

    const questLabelData: QuestLabelData = {
      entityId: quest.entityId,
      hexCoords: quest.hexCoords,
      questType: quest.questType,
      occupierId: quest.occupierId,
    };

    this.labelManager.createLabel("quest", questLabelData, {
      cameraView: this.currentCameraView,
    });
  }

  public hideLabel(entityId: ID): void {
    this.labelManager.removeLabel(Number(entityId));
  }

  public hideAllLabels(): void {
    this.labelManager.removeAllLabels();
  }

  // Label visibility transitions are now handled automatically by LabelManager

  // Getter for compatibility with worldmap hover functionality
  get entityIdLabels(): Map<ID, CSS2DObject> {
    const labelMap = new Map<ID, CSS2DObject>();
    const questLabels = this.labelManager.getLabelsByType("quest");
    questLabels.forEach((label) => {
      labelMap.set(label.data.entityId, label.css2dObject);
    });
    return labelMap;
  }
}

class Quests {
  private quests: Map<QuestType, Map<ID, QuestData>> = new Map();

  addQuest(entityId: ID, questType: QuestType, occupierId: ID, hexCoords: Position) {
    if (!this.quests.has(questType)) {
      this.quests.set(questType, new Map());
    }
    this.quests.get(questType)!.set(entityId, {
      entityId,
      questType,
      occupierId,
      hexCoords,
    });
  }

  removeQuestFromPosition(hexCoords: { x: number; y: number }) {
    this.quests.forEach((quests) => {
      quests.forEach((quest) => {
        const { x, y } = quest.hexCoords.getNormalized();
        if (x === hexCoords.x && y === hexCoords.y) {
          quests.delete(quest.entityId);
        }
      });
    });
  }

  removeQuest(entityId: ID): QuestData | null {
    let removedQuest: QuestData | null = null;

    this.quests.forEach((quests) => {
      const quest = quests.get(entityId);
      if (quest) {
        quests.delete(entityId);
        removedQuest = quest;
      }
    });

    return removedQuest;
  }

  getQuest(entityId: ID): QuestData | undefined {
    for (const quests of this.quests.values()) {
      const quest = quests.get(entityId);
      if (quest) {
        return quest;
      }
    }

    return undefined;
  }

  getQuests(): Map<QuestType, Map<ID, QuestData>> {
    return this.quests;
  }
}
