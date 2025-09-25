import { ChestModelPath } from "@/three/constants";
import InstancedModel from "@/three/managers/instanced-model";
import { Position } from "@bibliothecadao/eternum";

import { ChestData, ChestSystemUpdate } from "@bibliothecadao/eternum";
import { FELT_CENTER, ID } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { CameraView, HexagonScene } from "../scenes/hexagon-scene";
import { RenderChunkSize } from "../types/common";
import { getWorldPositionForHex, hashCoordinates } from "../utils";
import { createChestLabel } from "../utils/labels/label-factory";
import { applyLabelTransitions, transitionManager } from "../utils/labels/label-transitions";
import { gltfLoader } from "../utils/utils";

const MAX_INSTANCES = 1000;

export class ChestManager {
  private scene: THREE.Scene;
  private chestModel!: InstancedModel;
  private renderChunkSize: RenderChunkSize;
  private hexagonScene?: HexagonScene;
  private dummy: THREE.Object3D = new THREE.Object3D();
  chests: Chests = new Chests();
  private visibleChests: ChestData[] = [];
  private currentChunkKey: string | null = "190,170";
  private entityIdLabels: Map<ID, CSS2DObject> = new Map();
  private labelsGroup: THREE.Group;
  private entityIdMap: Map<number, ID> = new Map();
  private scale: number = 1;
  private currentCameraView: CameraView;
  chestHexCoords: Map<number, Set<number>> = new Map();
  private animations: Map<number, THREE.AnimationMixer> = new Map();
  private animationClips: THREE.AnimationClip[] = [];
  private chunkSwitchPromise: Promise<void> | null = null; // Track ongoing chunk switches

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
    this.loadModel().then(() => {
      if (this.currentChunkKey) {
        this.renderVisibleChests(this.currentChunkKey);
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
    applyLabelTransitions(this.entityIdLabels, view);
  };

  public destroy() {
    // Clean up camera view listener
    if (this.hexagonScene) {
      this.hexagonScene.removeCameraViewListener(this.handleCameraViewChange);
    }

    // Clean up animations
    this.animations.forEach((mixer) => mixer.stopAllAction());
    this.animations.clear();
  }

  private async loadModel(): Promise<void> {
    const loader = gltfLoader;

    const loadPromise = new Promise<{ model: InstancedModel; clips: THREE.AnimationClip[] }>((resolve, reject) => {
      loader.load(
        ChestModelPath,
        (gltf) => {
          const instancedModel = new InstancedModel(gltf, MAX_INSTANCES, false, "Chest");
          const clips = gltf.animations || [];
          resolve({ model: instancedModel, clips });
        },
        undefined,
        (error) => {
          console.error(`An error occurred while loading the chest model:`, error);
          reject(error);
        },
      );
    });

    await loadPromise
      .then(({ model, clips }) => {
        this.chestModel = model;
        this.animationClips = clips;
        this.scene.add(model.group);
      })
      .catch((error) => {
        console.error(`Failed to load chest model:`, error);
      });
  }

  async onUpdate(update: ChestSystemUpdate) {
    const { occupierId, hexCoords } = update;
    const normalizedCoord = { col: hexCoords.col - FELT_CENTER, row: hexCoords.row - FELT_CENTER };
    // Add the chest to the map
    const position = new Position({ x: hexCoords.col, y: hexCoords.row });

    if (!this.chestHexCoords.has(normalizedCoord.col)) {
      this.chestHexCoords.set(normalizedCoord.col, new Set());
    }
    if (!this.chestHexCoords.get(normalizedCoord.col)!.has(normalizedCoord.row)) {
      this.chestHexCoords.get(normalizedCoord.col)!.add(normalizedCoord.row);
    }

    this.chests.addChest(occupierId, position);

    // Re-render if we have a current chunk
    if (this.currentChunkKey) {
      this.renderVisibleChests(this.currentChunkKey);
    }
  }

  async updateChunk(chunkKey: string) {
    if (this.currentChunkKey === chunkKey) {
      return;
    }

    // Wait for any ongoing chunk switch to complete first
    if (this.chunkSwitchPromise) {
      console.log(`[CHUNK SYNC] Waiting for previous chest chunk switch to complete before switching to ${chunkKey}`);
      try {
        await this.chunkSwitchPromise;
      } catch (error) {
        console.warn(`Previous chest chunk switch failed:`, error);
      }
    }

    // Check again if chunk key is still different (might have changed while waiting)
    if (this.currentChunkKey === chunkKey) {
      return;
    }

    console.log(`[CHUNK SYNC] Switching chest chunk from ${this.currentChunkKey} to ${chunkKey}`);
    this.currentChunkKey = chunkKey;

    // Create and track the chunk switch promise
    this.chunkSwitchPromise = Promise.resolve().then(() => {
      this.renderVisibleChests(chunkKey);
    });

    try {
      await this.chunkSwitchPromise;
      console.log(`[CHUNK SYNC] Chest chunk switch to ${chunkKey} completed`);
    } finally {
      this.chunkSwitchPromise = null;
    }
  }

  private getChestWorldPosition = (chestEntityId: ID, hexCoords: Position) => {
    const { x: hexCoordsX, y: hexCoordsY } = hexCoords.getNormalized();
    const basePosition = getWorldPositionForHex({ col: hexCoordsX, row: hexCoordsY });
    return basePosition;
  };

  private isChestVisible(chest: ChestData, startRow: number, startCol: number) {
    const { x, y } = chest.hexCoords.getNormalized();
    const isVisible =
      x >= startCol - this.renderChunkSize.width / 2 &&
      x <= startCol + this.renderChunkSize.width / 2 &&
      y >= startRow - this.renderChunkSize.height / 2 &&
      y <= startRow + this.renderChunkSize.height / 2;
    return isVisible;
  }

  private getVisibleChestsForChunk(chests: Map<ID, ChestData>, startRow: number, startCol: number): ChestData[] {
    const visibleChests = Array.from(chests.values())
      .filter((chest) => {
        return this.isChestVisible(chest, startRow, startCol);
      })
      .map((chest) => ({
        entityId: chest.entityId,
        hexCoords: chest.hexCoords,
      }));

    return visibleChests;
  }

  private renderVisibleChests(chunkKey: string) {
    const _chests = this.chests.getChests();
    const visibleChestIds = new Set<ID>();
    const [startRow, startCol] = chunkKey.split(",").map(Number);

    this.visibleChests = this.getVisibleChestsForChunk(_chests, startRow, startCol);

    if (this.chestModel) {
      this.chestModel.setCount(0);
      this.entityIdMap.clear();

      this.visibleChests.forEach((chest) => {
        visibleChestIds.add(chest.entityId);
        const position = this.getChestWorldPosition(chest.entityId, chest.hexCoords);
        position.y += 0.05;
        const { x, y } = chest.hexCoords.getContract();

        const existingLabel = this.entityIdLabels.get(chest.entityId);
        if (existingLabel) {
          const updatedPosition = this.getChestWorldPosition(chest.entityId, chest.hexCoords);
          updatedPosition.y += 1.5;
          existingLabel.position.copy(updatedPosition);
        }

        this.dummy.position.copy(position);

        const rotationSeed = hashCoordinates(x, y);
        const rotationIndex = Math.floor(rotationSeed * 6);
        const randomRotation = (rotationIndex * Math.PI) / 3;
        this.dummy.rotation.y = randomRotation;
        this.dummy.updateMatrix();

        const currentCount = this.chestModel.getCount();
        this.chestModel.setMatrixAt(currentCount, this.dummy.matrix);
        this.chestModel.setCount(currentCount + 1);
        this.entityIdMap.set(currentCount, chest.entityId);
      });

      this.chestModel.needsUpdate();
    }

    // Remove labels for chests that are no longer visible
    this.entityIdLabels.forEach((label, entityId) => {
      if (!this.visibleChests.find((chest) => chest.entityId === entityId)) {
        this.removeEntityIdLabel(entityId);
      }
    });
  }

  private removeEntityIdLabel(entityId: number) {
    const label = this.entityIdLabels.get(entityId);
    if (label) {
      this.labelsGroup.remove(label);
      this.entityIdLabels.delete(entityId);
    }
  }

  private addEntityIdLabel(chest: ChestData, position: THREE.Vector3) {
    // Use centralized chest label creation
    const labelDiv = createChestLabel(chest, this.currentCameraView);

    const label = new CSS2DObject(labelDiv);
    label.position.copy(position);
    label.position.y += 1.5;
    // Store entityId in userData for identification
    label.userData.entityId = chest.entityId;

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
    this.entityIdLabels.set(chest.entityId, label);
  }

  public showLabel(entityId: ID): void {
    const chest = this.chests.getChest(entityId);
    if (!chest) {
      return;
    }

    const position = this.getChestWorldPosition(chest.entityId, chest.hexCoords);
    position.y += 0.05;

    const existingLabel = this.entityIdLabels.get(entityId);
    if (existingLabel) {
      const updatedPosition = this.getChestWorldPosition(chest.entityId, chest.hexCoords);
      updatedPosition.y += 1.5;
      existingLabel.position.copy(updatedPosition);
      return;
    }

    this.addEntityIdLabel(chest, position);
  }

  public hideLabel(entityId: ID): void {
    this.removeEntityIdLabel(entityId);
  }

  public hideAllLabels(): void {
    Array.from(this.entityIdLabels.keys()).forEach((chestId) => this.removeEntityIdLabel(chestId));
  }

  public removeLabelsFromScene(): void {
    this.entityIdLabels.forEach((labelData) => {
      this.labelsGroup.remove(labelData);
    });
  }

  public removeLabelsExcept(entityId?: ID): void {
    this.entityIdLabels.forEach((labelData, labelEntityId) => {
      if (labelEntityId !== entityId) {
        this.labelsGroup.remove(labelData);
      }
    });
  }

  public addLabelsToScene(): void {
    this.entityIdLabels.forEach((labelData) => {
      if (!this.labelsGroup.children.includes(labelData)) {
        this.labelsGroup.add(labelData);
      }
    });
  }

  public async removeChest(entityId: ID) {
    if (!this.chests.getChest(entityId)) {
      return;
    }

    // Remove chest from tracking
    this.chests.removeChest(entityId);

    this.removeEntityIdLabel(entityId);

    // Re-render visible chests
    if (this.currentChunkKey) {
      this.renderVisibleChests(this.currentChunkKey);
    }
  }

  public update(deltaTime: number) {
    // Update animations
    this.animations.forEach((mixer) => {
      mixer.update(deltaTime);
    });
  }
}

class Chests {
  private chests: Map<ID, ChestData> = new Map();

  addChest(occupierId: ID, hexCoords: Position) {
    this.chests.set(occupierId, {
      entityId: occupierId,
      hexCoords,
    });
  }

  removeChest(entityId: ID): ChestData | null {
    const chest = this.chests.get(entityId);
    if (chest) {
      this.chests.delete(entityId);
      return chest;
    }
    return null;
  }

  getChest(entityId: ID): ChestData | null {
    return this.chests.get(entityId) || null;
  }

  getChests(): Map<ID, ChestData> {
    return this.chests;
  }
}
