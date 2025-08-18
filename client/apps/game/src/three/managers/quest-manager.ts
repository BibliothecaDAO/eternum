import { QuestModelPaths } from "@/three/constants";
import InstancedModel from "@/three/managers/instanced-model";
import { Position } from "@/types/position";
import { FELT_CENTER, ID, QuestType } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { CameraView, HexagonScene } from "../scenes/hexagon-scene";
import { QuestData, QuestSystemUpdate } from "../types";
import { RenderChunkSize } from "../types/common";
import { getWorldPositionForHex, hashCoordinates } from "../utils";
import { LabelManager } from "../utils/labels/label-manager";
import { QuestLabelType, QuestLabelData } from "../utils/labels/label-factory";
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
  private scale: number = 1;
  private currentCameraView: CameraView;
  private labelManager: LabelManager;
  questHexCoords: Map<number, Set<number>> = new Map();
  private chunkSwitchPromise: Promise<void> | null = null; // Track ongoing chunk switches

  constructor(
    scene: THREE.Scene,
    renderChunkSize: RenderChunkSize,
    labelsGroup?: THREE.Group,
    hexagonScene?: HexagonScene,
  ) {
    this.scene = scene;
    this.hexagonScene = hexagonScene;
    this.renderChunkSize = renderChunkSize;
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;

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
    const normalizedCoord = { col: hexCoords.col - FELT_CENTER, row: hexCoords.row - FELT_CENTER };
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

  async updateChunk(chunkKey: string) {
    if (this.currentChunkKey === chunkKey) {
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
    if (this.currentChunkKey === chunkKey) {
      return;
    }

    console.log(`[CHUNK SYNC] Switching quest chunk from ${this.currentChunkKey} to ${chunkKey}`);
    this.currentChunkKey = chunkKey;

    // Create and track the chunk switch promise
    this.chunkSwitchPromise = Promise.resolve().then(() => {
      this.renderVisibleQuests(chunkKey);
    });

    try {
      await this.chunkSwitchPromise;
      console.log(`[CHUNK SYNC] Quest chunk switch to ${chunkKey} completed`);
    } finally {
      this.chunkSwitchPromise = null;
    }
  }

  private getQuestWorldPosition = (questEntityId: ID, hexCoords: Position) => {
    const { x: hexCoordsX, y: hexCoordsY } = hexCoords.getNormalized();
    const basePosition = getWorldPositionForHex({ col: hexCoordsX, row: hexCoordsY });
    return basePosition;
  };

  private isQuestVisible(quest: { entityId: ID; hexCoords: Position }, startRow: number, startCol: number) {
    const { x, y } = quest.hexCoords.getNormalized();
    const isVisible =
      x >= startCol - this.renderChunkSize.width / 2 &&
      x <= startCol + this.renderChunkSize.width / 2 &&
      y >= startRow - this.renderChunkSize.height / 2 &&
      y <= startRow + this.renderChunkSize.height / 2;
    return isVisible;
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
    const _quests = this.quests.getQuests();
    const visibleQuestIds = new Set<ID>();

    for (const [questType, quests] of _quests) {
      const [startRow, startCol] = chunkKey.split(",").map(Number);
      this.visibleQuests = this.getVisibleQuestsForChunk(quests, startRow, startCol);
      const models = this.questModels.get(questType);

      if (models && models.length > 0) {
        models.forEach((model) => {
          model.setCount(0);
        });

        this.entityIdMaps.set(questType, new Map());

        this.visibleQuests.forEach((quest) => {
          visibleQuestIds.add(quest.entityId);
          const position = this.getQuestWorldPosition(quest.entityId, quest.hexCoords);
          position.y += 0.05;
          const { x, y } = quest.hexCoords.getContract();

          // Create or update quest label using the label manager
          const questLabelData: QuestLabelData = {
            entityId: quest.entityId,
            hexCoords: quest.hexCoords,
            questType: quest.questType,
            occupierId: quest.occupierId,
          };

          // Remove existing label if it exists, then create new one
          this.labelManager.removeLabel(quest.entityId);
          this.labelManager.createLabel("quest", questLabelData, {
            cameraView: this.currentCameraView,
          });

          this.dummy.position.copy(position);

          const rotationSeed = hashCoordinates(x, y);
          const rotationIndex = Math.floor(rotationSeed * 6);
          const randomRotation = (rotationIndex * Math.PI) / 3;
          this.dummy.rotation.y = randomRotation;
          this.dummy.updateMatrix();

          const model = models[0]; // Assuming you're using the first model
          const currentCount = model.getCount();
          model.setMatrixAt(currentCount, this.dummy.matrix);
          model.setCount(currentCount + 1);
          this.entityIdMaps.get(questType)!.set(currentCount, quest.entityId);
        });

        models.forEach((model) => model.needsUpdate());
      }
    }
    // Remove labels for quests that are no longer visible
    const questLabels = this.labelManager.getLabelsByType("quest");
    questLabels.forEach((labelInstance) => {
      if (!visibleQuestIds.has(labelInstance.data.entityId)) {
        this.labelManager.removeLabel(labelInstance.data.entityId);
      }
    });

    // // Update all model instances
    // this.questModel.updateAllInstances();
    // this.questModel.computeBoundingSphere();
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

  getQuests(): Map<QuestType, Map<ID, QuestData>> {
    return this.quests;
  }
}
