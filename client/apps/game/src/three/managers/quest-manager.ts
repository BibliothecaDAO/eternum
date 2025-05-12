import InstancedModel from "@/three/managers/instanced-model";
import { Position } from "@/types/position";
import { ContractAddress, FELT_CENTER, ID, QuestType } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { gltfLoader } from "../helpers/utils";
import { QuestModelPaths } from "../scenes/constants";
import { CameraView, HexagonScene } from "../scenes/hexagon-scene";
import { QuestData, QuestSystemUpdate } from "../types";
import { RenderChunkSize } from "../types/common";
import { getWorldPositionForHex, hashCoordinates } from "../utils";
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
    this.currentCameraView = view;

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
            const instancedModel = new InstancedModel(gltf, MAX_INSTANCES, false, QuestType[questType]);
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
    const { entityId, id, game_address, hexCoords, level, resource_type, amount, capacity, participant_count } = update;
    const normalizedCoord = { col: hexCoords.col - FELT_CENTER, row: hexCoords.row - FELT_CENTER };
    // Add the quest to the map with the complete owner info
    const position = new Position({ x: hexCoords.col, y: hexCoords.row });
    const structureType = QuestType.DarkShuffle;

    if (!this.questHexCoords.has(normalizedCoord.col)) {
      this.questHexCoords.set(normalizedCoord.col, new Set());
    }
    if (!this.questHexCoords.get(normalizedCoord.col)!.has(normalizedCoord.row)) {
      this.questHexCoords.get(normalizedCoord.col)!.add(normalizedCoord.row);
    }

    this.quests.addQuest(
      entityId,
      structureType,
      id,
      game_address,
      position,
      level,
      resource_type,
      amount,
      capacity,
      participant_count,
    );

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
        id: quest.id,
        game_address: quest.game_address,
        hexCoords: quest.hexCoords,
        level: quest.level,
        resource_type: quest.resource_type,
        amount: quest.amount,
        capacity: quest.capacity,
        participant_count: quest.participant_count,
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
    const labelDiv = document.createElement("div");
    labelDiv.classList.add(
      "rounded-md",
      "bg-brown/50",
      "hover:bg-brown/90",
      "pointer-events-auto",
      "text-gold",
      "p-0.5",
      "-translate-x-1/2",
      "text-xxs",
      "h-10",
      "flex",
      "items-center",
      "group",
    );
    // Prevent right click
    labelDiv.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    const img = document.createElement("img");
    img.src = ICONS[QuestType.DarkShuffle];
    img.classList.add("w-auto", "h-full", "inline-block", "object-contain", "max-w-[32px]");
    labelDiv.appendChild(img);

    // Create text container with transition
    const textContainer = document.createElement("div");
    textContainer.classList.add(
      "flex",
      "flex-col",
      "transition-width",
      "duration-700",
      "ease-in-out",
      "overflow-hidden",
      "whitespace-nowrap",
      "group-hover:max-w-[250px]",
      "group-hover:ml-2",
      this.currentCameraView === CameraView.Far ? "max-w-0" : "max-w-[250px]",
      this.currentCameraView === CameraView.Far ? "ml-0" : "ml-2",
    );

    const line1 = document.createElement("span");
    line1.textContent = `Quest`;
    line1.style.color = "inherit";
    const line2 = document.createElement("strong");
    line2.textContent = `Level: ${quest.level + 1}`;

    textContainer.appendChild(line1);
    textContainer.appendChild(line2);
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
        if (isCompact) {
          textContainer.classList.add("max-w-0", "ml-0");
          textContainer.classList.remove("max-w-[250px]", "ml-2");
        } else {
          textContainer.classList.remove("max-w-0", "ml-0");
          textContainer.classList.add("max-w-[250px]", "ml-2");
        }
      }
    }
  }
}

class Quests {
  private quests: Map<QuestType, Map<ID, QuestData>> = new Map();

  addQuest(
    entityId: ID,
    questType: QuestType,
    id: ID,
    game_address: ContractAddress,
    hexCoords: Position,
    level: number,
    resource_type: number,
    amount: bigint,
    capacity: number,
    participant_count: number,
  ) {
    if (!this.quests.has(questType)) {
      this.quests.set(questType, new Map());
    }
    this.quests.get(questType)!.set(entityId, {
      entityId,
      id,
      game_address,
      hexCoords,
      level,
      resource_type,
      amount,
      capacity,
      participant_count,
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
