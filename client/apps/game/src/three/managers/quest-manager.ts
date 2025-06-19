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
import { createContentContainer, createLabelBase, transitionManager } from "../utils/";
import { gltfLoader } from "../utils/utils";
const MAX_INSTANCES = 1000;

const ICONS = {
  [QuestType.DarkShuffle]: "/images/labels/quest.png",
};

export class QuestManager {
  private scene: THREE.Scene;
  private questModels: Map<QuestType, InstancedModel[]> = new Map();
  private renderChunkSize: RenderChunkSize;
  private hexagonScene?: HexagonScene;
  private dummy: THREE.Object3D = new THREE.Object3D();
  quests: Quests = new Quests();
  private visibleQuests: QuestData[] = [];
  private currentChunkKey: string | null = "190,170";
  private entityIdLabels: Map<ID, CSS2DObject> = new Map();
  private labelsGroup: THREE.Group;
  private entityIdMaps: Map<QuestType, Map<number, ID>> = new Map();
  private scale: number = 1;
  private currentCameraView: CameraView;
  questHexCoords: Map<number, Set<number>> = new Map();

  constructor(
    scene: THREE.Scene,
    renderChunkSize: RenderChunkSize,
    labelsGroup?: THREE.Group,
    hexagonScene?: HexagonScene,
  ) {
    this.scene = scene;
    this.hexagonScene = hexagonScene;
    this.labelsGroup = labelsGroup || new THREE.Group();
    this.renderChunkSize = renderChunkSize;
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;
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

    // If we're moving away from Medium view, clean up transition state
    if (this.currentCameraView === CameraView.Medium) {
      transitionManager.clearMediumViewTransition();
    }

    this.currentCameraView = view;

    // If we're switching to Medium view, store timestamp
    if (view === CameraView.Medium) {
      transitionManager.setMediumViewTransition();
    }

    // Update all existing labels to reflect the new view
    this.visibleQuests.forEach((quest) => {
      this.updateLabelVisibility(quest.entityId, view === CameraView.Far);
    });
  };

  public destroy() {
    // Clean up camera view listener
    if (this.hexagonScene) {
      this.hexagonScene.removeCameraViewListener(this.handleCameraViewChange);
    }
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

    this.currentChunkKey = chunkKey;
    this.renderVisibleQuests(chunkKey);
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

          // Always recreate the label to ensure it matches current camera view
          if (this.entityIdLabels.has(quest.entityId)) {
            this.removeEntityIdLabel(quest.entityId);
          }
          this.addEntityIdLabel(quest, position);

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
    this.entityIdLabels.forEach((label, entityId) => {
      if (!this.visibleQuests.find((quest) => quest.entityId === entityId)) {
        this.removeEntityIdLabel(entityId);
      }
    });

    // // Update all model instances
    // this.questModel.updateAllInstances();
    // this.questModel.computeBoundingSphere();
  }

  private removeEntityIdLabel(entityId: number) {
    const label = this.entityIdLabels.get(entityId);
    if (label) {
      this.labelsGroup.remove(label);
      this.entityIdLabels.delete(entityId);
    }
  }

  private addEntityIdLabel(quest: QuestData, position: THREE.Vector3) {
    // Create label div using the shared base
    const labelDiv = createLabelBase({
      isMine: false, // Quests don't have ownership
      textColor: "text-gold", // Use gold color for quests
    });

    // Prevent right click
    labelDiv.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    const img = document.createElement("img");
    img.src = ICONS[QuestType.DarkShuffle];
    img.classList.add("w-auto", "h-full", "inline-block", "object-contain", "max-w-[32px]");
    labelDiv.appendChild(img);

    // Create text container with transition using shared utility
    const textContainer = createContentContainer(this.currentCameraView);

    const line1 = document.createElement("span");
    line1.textContent = `Quest`;
    line1.style.color = "inherit";

    textContainer.appendChild(line1);
    labelDiv.appendChild(textContainer);

    const label = new CSS2DObject(labelDiv);
    label.position.copy(position);
    label.position.y += 1.5;

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

    this.labelsGroup.add(label);
    this.entityIdLabels.set(quest.entityId, label);
  }

  public removeLabelsFromScene(): void {
    this.entityIdLabels.forEach((labelData) => {
      this.labelsGroup.remove(labelData);
    });
  }

  public addLabelsToScene(): void {
    this.entityIdLabels.forEach((labelData) => {
      if (!this.labelsGroup.children.includes(labelData)) {
        this.labelsGroup.add(labelData);
      }
    });
  }

  public updateLabelVisibility(entityId: number, isCompact: boolean): void {
    const labelData = this.entityIdLabels.get(entityId);
    if (labelData?.element) {
      const textContainer = labelData.element.querySelector(".flex.flex-col");
      if (textContainer) {
        // Get the container's unique ID or generate one if it doesn't exist
        let containerId = (textContainer as HTMLElement).dataset.containerId;
        if (!containerId) {
          containerId = `quest_${entityId}_${Math.random().toString(36).substring(2, 9)}`;
          (textContainer as HTMLElement).dataset.containerId = containerId;
        }

        if (isCompact) {
          // For Far view (isCompact = true), always collapse immediately
          textContainer.classList.add("max-w-0", "ml-0");
          textContainer.classList.remove("max-w-[250px]", "ml-2");
          // Clear any existing timeouts
          transitionManager.clearTimeout(containerId);
        } else {
          // For Medium and Close views, expand immediately
          textContainer.classList.remove("max-w-0", "ml-0");
          textContainer.classList.add("max-w-[250px]", "ml-2");

          // If this is Medium view, add timeout to switch back to compact
          if (this.currentCameraView === CameraView.Medium) {
            // Store the current timestamp
            transitionManager.setMediumViewTransition(containerId);

            // Use the managed timeout
            transitionManager.setLabelTimeout(
              () => {
                // Only apply if the element is still connected to the DOM
                if (textContainer.isConnected) {
                  textContainer.classList.remove("max-w-[250px]", "ml-2");
                  textContainer.classList.add("max-w-0", "ml-0");

                  // Clear the transition state
                  transitionManager.clearMediumViewTransition(containerId);
                }
              },
              2000,
              containerId,
            );
          } else if (this.currentCameraView === CameraView.Close) {
            // For Close view, ensure we cancel any existing timeouts
            transitionManager.clearTimeout(containerId);
          }
        }
      }
    }
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
