import { Position } from "@/types/position";
import { ID } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { CameraView, HexagonScene } from "../scenes/hexagon-scene";
import { QuestData, QuestSystemUpdate } from "../types";
import { RenderChunkSize } from "../types/common";
import { getWorldPositionForHex } from "../utils";
import { QuestModel } from "./quest-model";

export class QuestManager {
  private scene: THREE.Scene;
  private questMarkers: Map<string, THREE.Object3D> = new Map();
  private questLabelsGroup: THREE.Group;
  private lastUpdateTime: number = 0;
  private updateInterval: number = 5000; // 5 seconds between updates
  private renderChunkSize: RenderChunkSize;
  private hexagonScene?: HexagonScene;
  private quests: Map<ID, QuestData> = new Map();
  private visibleQuests: QuestData[] = [];
  private currentChunkKey: string | null = "190,170";
  private questModel: QuestModel;
  private entityIdLabels: Map<number, CSS2DObject> = new Map();
  private scale: number = 1;
  private currentCameraView: CameraView;
  private readonly labels: Map<number, { label: CSS2DObject; entityId: number }> = new Map();
  private readonly labelsGroup: THREE.Group;

  constructor(
    scene: THREE.Scene,
    renderChunkSize: RenderChunkSize,
    questLabelsGroup: THREE.Group,
    hexagonScene: HexagonScene,
  ) {
    this.scene = scene;
    this.hexagonScene = hexagonScene;
    this.questLabelsGroup = questLabelsGroup;
    this.renderChunkSize = renderChunkSize;
    this.questModel = new QuestModel(scene);
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;
    this.labelsGroup = new THREE.Group();
  }

  async onUpdate(update: QuestSystemUpdate) {
    // Prevent too frequent updates
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateInterval) {
      return false;
    }
    this.lastUpdateTime = now;

    console.log("QuestManager.onUpdate called at", new Date().toISOString());

    const { entityId, hexCoords, id, reward, capacity, participantCount, targetScore, expiresAt, gameAddress } = update;

    // Add the quest to the map with the complete owner info
    const position = new Position({ x: hexCoords.col, y: hexCoords.row });
    console.log("adding quest", update);
    this.addQuest(entityId, position, id, reward, capacity, participantCount, targetScore, expiresAt, gameAddress);
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

  public getQuests() {
    return Array.from(this.quests.values());
  }

  private isQuestVisible(quest: { entityId: ID; hexCoords: Position }, startRow: number, startCol: number) {
    const { x, y } = quest.hexCoords.getNormalized();
    const isVisible =
      x >= startCol - this.renderChunkSize.width / 2 &&
      x <= startCol + this.renderChunkSize.width / 2 &&
      y >= startRow - this.renderChunkSize.height / 2 &&
      y <= startRow + this.renderChunkSize.height / 2;
    return isVisible;
  }

  private getVisibleQuestsForChunk(startRow: number, startCol: number): Array<QuestData> {
    const visibleQuests = Array.from(this.quests.entries())
      .filter(([_, quest]) => {
        return this.isQuestVisible(quest, startRow, startCol);
      })
      .map(([entityId, quest]) => ({
        entityId,
        hexCoords: quest.hexCoords,
        id: quest.id,
        reward: quest.reward,
        capacity: quest.capacity,
        participantCount: quest.participantCount,
        targetScore: quest.targetScore,
        expiresAt: quest.expiresAt,
        gameAddress: quest.gameAddress,
      }));

    return visibleQuests;
  }

  private renderVisibleQuests(chunkKey: string) {
    const [startRow, startCol] = chunkKey.split(",").map(Number);
    this.visibleQuests = this.getVisibleQuestsForChunk(startRow, startCol);

    // Reset all model instances
    this.questModel.resetInstanceCounts();

    let currentCount = 0;
    this.visibleQuests.forEach((quest) => {
      const position = this.getQuestWorldPosition(quest.entityId, quest.hexCoords);
      const { x, y } = quest.hexCoords.getContract();

      // Update the specific model instance for this entity
      this.questModel.updateInstance(
        quest.entityId,
        currentCount,
        position,
        this.scale,
        new THREE.Euler(0, Math.random() * Math.PI * 2, 0), // Random rotation
        new THREE.Color(0xffcc00), // Gold color for quests
      );

      this.quests.set(quest.entityId, { ...quest });

      // Increment count and update all meshes
      currentCount++;
      this.questModel.setVisibleCount(currentCount);

      // Add or update entity ID label
      if (this.entityIdLabels.has(quest.entityId)) {
        const label = this.entityIdLabels.get(quest.entityId)!;
        label.position.copy(position);
        label.position.y += 2.5; // Position above the quest marker
      } else {
        this.addEntityIdLabel(quest, position);
      }
    });

    // Remove labels for quests that are no longer visible
    this.entityIdLabels.forEach((label, entityId) => {
      if (!this.visibleQuests.find((quest) => quest.entityId === entityId)) {
        this.removeEntityIdLabel(entityId);
      }
    });

    // Update all model instances
    this.questModel.updateAllInstances();
    this.questModel.computeBoundingSphere();
  }

  private addQuestLabel(quest: QuestData, position: THREE.Vector3) {
    console.log("adding quest label", quest);
    // Create a div element for the CSS2D label
    const labelDiv = document.createElement("div");
    labelDiv.className = "quest-label";
    labelDiv.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    labelDiv.style.color = "white";
    labelDiv.style.padding = "10px";
    labelDiv.style.borderRadius = "5px";
    labelDiv.style.textAlign = "center";
    labelDiv.style.width = "120px";
    labelDiv.style.pointerEvents = "none"; // Make it non-interactive

    // Add quest info
    const titleElement = document.createElement("div");
    titleElement.textContent = "Quest";
    titleElement.style.fontWeight = "bold";
    titleElement.style.fontSize = "16px";
    labelDiv.appendChild(titleElement);

    const idElement = document.createElement("div");
    idElement.textContent = `ID: ${quest.id}`;
    idElement.style.fontSize = "12px";
    labelDiv.appendChild(idElement);

    // Create the CSS2D object
    const label = new CSS2DObject(labelDiv);
    label.position.copy(position);
    label.position.y += 2.5; // Position above the quest marker

    this.questLabelsGroup.add(label);
    this.entityIdLabels.set(quest.entityId, label);
  }

  private removeEntityIdLabel(entityId: number) {
    const label = this.entityIdLabels.get(entityId);
    if (label) {
      this.questLabelsGroup.remove(label);
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
      "p-1",
      "-translate-x-1/2",
      "text-xs",
      "flex",
      "items-center",
    );
    // Prevent right click
    labelDiv.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    const img = document.createElement("img");
    img.src = `/textures/army_label.png`;
    img.classList.add("w-[24px]", "h-[24px]", "inline-block", "object-contain");
    labelDiv.appendChild(img);

    // Create text container with transition
    const textContainer = document.createElement("div");
    textContainer.classList.add(
      "flex",
      "flex-col",
      "transition-all",
      "duration-700",
      "ease-in-out",
      "overflow-hidden",
      "whitespace-nowrap",
      this.currentCameraView === CameraView.Far ? "max-w-0" : "max-w-[200px]",
      this.currentCameraView === CameraView.Far ? "ml-0" : "ml-2",
    );

    const line1 = document.createElement("span");
    line1.textContent = `Quest`;
    line1.style.color = "inherit";
    const line2 = document.createElement("strong");
    line2.textContent = `ID: ${quest.id}`;

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

    this.questLabelsGroup.add(label);
    this.entityIdLabels.set(quest.entityId, label);
  }

  public removeLabelsFromScene(): void {
    this.labels.forEach((labelData) => {
      this.labelsGroup.remove(labelData.label);
    });
  }

  public addLabelsToScene(): void {
    this.labels.forEach((labelData) => {
      if (!this.labelsGroup.children.includes(labelData.label)) {
        this.labelsGroup.add(labelData.label);
      }
    });
  }

  public addQuest(
    entityId: ID,
    hexCoords: Position,
    id: number,
    reward: number,
    capacity: number,
    participantCount: number,
    targetScore: number,
    expiresAt: number,
    gameAddress: string,
  ) {
    if (this.quests.has(entityId)) return;
    this.quests.set(entityId, {
      entityId,
      hexCoords,
      id,
      reward,
      capacity,
      participantCount,
      targetScore,
      expiresAt,
      gameAddress,
    });
  }
}
