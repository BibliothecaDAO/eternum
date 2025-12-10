import { ChestModelPath } from "@/three/constants";
import InstancedModel from "@/three/managers/instanced-model";
import { FELT_CENTER } from "@/ui/config";
import { Position } from "@bibliothecadao/eternum";

import { ChestData, ChestSystemUpdate } from "@bibliothecadao/eternum";
import { ID } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { CameraView, HexagonScene } from "../scenes/hexagon-scene";
import { RenderChunkSize } from "../types/common";
import { getRenderBounds } from "../utils/chunk-geometry";
import { getWorldPositionForHex, hashCoordinates } from "../utils";
import { FrustumManager } from "../utils/frustum-manager";
import { createChestLabel } from "../utils/labels/label-factory";
import { applyLabelTransitions, transitionManager } from "../utils/labels/label-transitions";
import { gltfLoader } from "../utils/utils";
import { PointsLabelRenderer } from "./points-label-renderer";

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
  private chestInstanceOrder: ID[] = [];
  private chestInstanceIndices: Map<ID, number> = new Map();
  private scale: number = 1;
  private chunkSize: number;
  private currentCameraView: CameraView;
  chestHexCoords: Map<number, Set<number>> = new Map();
  private animations: Map<number, THREE.AnimationMixer> = new Map();
  private animationClips: THREE.AnimationClip[] = [];
  private chunkSwitchPromise: Promise<void> | null = null; // Track ongoing chunk switches
  private pointsRenderer?: PointsLabelRenderer; // Points-based icon renderer
  private frustumManager?: FrustumManager;

  constructor(
    scene: THREE.Scene,
    renderChunkSize: RenderChunkSize,
    labelsGroup?: THREE.Group,
    hexagonScene?: HexagonScene,
    frustumManager?: FrustumManager,
    chunkSize: number = Math.max(1, Math.floor(renderChunkSize.width / 2)),
  ) {
    this.scene = scene;
    this.hexagonScene = hexagonScene;
    this.labelsGroup = labelsGroup || new THREE.Group();
    this.renderChunkSize = renderChunkSize;
    this.chunkSize = chunkSize;
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;
    this.frustumManager = frustumManager;
    this.loadModel().then(() => {
      if (this.currentChunkKey) {
        this.renderVisibleChests(this.currentChunkKey);
      }
    });

    // Initialize points-based icon renderer
    this.initializePointsRenderer();

    if (hexagonScene) {
      hexagonScene.addCameraViewListener(this.handleCameraViewChange);
    }
  }

  public getVisibleCount(): number {
    return this.visibleChests.length;
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

  private initializePointsRenderer(): void {
    // Load chest icon texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "/images/labels/chest.png",
      (texture) => {
        // Texture loaded successfully
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false; // Prevent vertical flip for point sprites

        // Create points renderer with loaded texture
        this.pointsRenderer = new PointsLabelRenderer(
          this.scene,
          texture,
          MAX_INSTANCES, // Max points same as max chest instances
          5, // Point size in pixels (increased from 32)
          0, // Hover scale multiplier
          1.3, // Hover brightness multiplier
          true, // sizeAttenuation: false = fixed screen size, true = scales with distance
        );

        console.log("[ChestManager] Points-based icon renderer initialized");

        // Re-render visible chests to populate points
        if (this.currentChunkKey) {
          this.renderVisibleChests(this.currentChunkKey);
        }
      },
      undefined,
      (error) => {
        console.error("[ChestManager] Failed to load chest icon texture:", error);
      },
    );
  }

  public destroy() {
    // Clean up camera view listener
    if (this.hexagonScene) {
      this.hexagonScene.removeCameraViewListener(this.handleCameraViewChange);
    }

    // Clean up animations
    this.animations.forEach((mixer) => mixer.stopAllAction());
    this.animations.clear();

    // Clean up points renderer
    if (this.pointsRenderer) {
      this.pointsRenderer.dispose();
    }
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
    const normalizedCoord = { col: hexCoords.col - FELT_CENTER(), row: hexCoords.row - FELT_CENTER() };
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

  async updateChunk(chunkKey: string, options?: { force?: boolean }) {
    const force = options?.force ?? false;
    if (!force && this.currentChunkKey === chunkKey) {
      return;
    }

    // Wait for any ongoing chunk switch to complete first
    if (this.chunkSwitchPromise) {
      // console.log(`[CHUNK SYNC] Waiting for previous chest chunk switch to complete before switching to ${chunkKey}`);
      try {
        await this.chunkSwitchPromise;
      } catch (error) {
        console.warn(`Previous chest chunk switch failed:`, error);
      }
    }

    // Check again if chunk key is still different (might have changed while waiting)
    if (!force && this.currentChunkKey === chunkKey) {
      return;
    }

    const previousChunk = this.currentChunkKey;
    const isSwitch = previousChunk !== chunkKey;
    if (isSwitch) {
      // console.log(`[CHUNK SYNC] Switching chest chunk from ${this.currentChunkKey} to ${chunkKey}`);
      this.currentChunkKey = chunkKey;
    } else if (force) {
      // console.log(`[CHUNK SYNC] Refreshing chest chunk ${chunkKey}`);
    }

    // Create and track the chunk switch promise
    this.chunkSwitchPromise = Promise.resolve().then(() => {
      this.renderVisibleChests(chunkKey);
    });

    try {
      await this.chunkSwitchPromise;
      // console.log(`[CHUNK SYNC] Chest chunk ${isSwitch ? "switch" : "refresh"} for ${chunkKey} completed`);
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
    const bounds = getRenderBounds(startRow, startCol, this.renderChunkSize, this.chunkSize);
    const insideChunk = x >= bounds.minCol && x <= bounds.maxCol && y >= bounds.minRow && y <= bounds.maxRow;

    if (!insideChunk) {
      return false;
    }

    if (!this.frustumManager) {
      return true;
    }

    const worldPos = this.getChestWorldPosition(chest.entityId, chest.hexCoords);
    worldPos.y += 0.05;
    return this.frustumManager.isPointVisible(worldPos);
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
    if (!this.chestModel) {
      return;
    }

    const allChests = this.chests.getChests();
    const [startRow, startCol] = chunkKey.split(",").map(Number);
    const visibleChests = this.getVisibleChestsForChunk(allChests, startRow, startCol);
    const visibleChestIds = new Set<ID>(visibleChests.map((chest) => chest.entityId));

    this.visibleChests = visibleChests;

    for (let i = this.chestInstanceOrder.length - 1; i >= 0; i--) {
      const entityId = this.chestInstanceOrder[i];
      if (!visibleChestIds.has(entityId)) {
        this.removeChestInstance(entityId);
      }
    }

    visibleChests.forEach((chest) => {
      if (!this.chestInstanceIndices.has(chest.entityId)) {
        this.addChestInstance(chest);
      } else {
        this.updateChestInstance(chest);
      }
    });

    this.chestModel.setCount(this.chestInstanceOrder.length);
    this.chestModel.needsUpdate();

    this.entityIdLabels.forEach((label, entityId) => {
      if (!visibleChestIds.has(entityId)) {
        this.removeEntityIdLabel(entityId);
      }
    });

    if (this.pointsRenderer) {
      this.pointsRenderer.getEntityIds().forEach((entityId) => {
        if (!visibleChestIds.has(entityId)) {
          this.pointsRenderer!.removePoint(entityId);
        }
      });
    }
  }

  private addChestInstance(chest: ChestData) {
    const index = this.chestInstanceOrder.length;
    this.chestInstanceOrder.push(chest.entityId);
    this.chestInstanceIndices.set(chest.entityId, index);
    this.entityIdMap.set(index, chest.entityId);
    this.writeChestInstance(chest, index);
    this.updateChestLabelPosition(chest);
    this.updateChestPoint(chest);
  }

  private updateChestInstance(chest: ChestData) {
    const index = this.chestInstanceIndices.get(chest.entityId);
    if (index === undefined) {
      return;
    }
    this.writeChestInstance(chest, index);
    this.entityIdMap.set(index, chest.entityId);
    this.updateChestLabelPosition(chest);
    this.updateChestPoint(chest);
  }

  private removeChestInstance(entityId: ID) {
    const index = this.chestInstanceIndices.get(entityId);
    if (index === undefined) {
      return;
    }

    const lastIndex = this.chestInstanceOrder.length - 1;
    const lastEntityId = this.chestInstanceOrder[lastIndex];

    if (index !== lastIndex) {
      this.chestInstanceOrder[index] = lastEntityId;
      this.chestInstanceIndices.set(lastEntityId, index);
      const lastChest = this.chests.getChest(lastEntityId);
      if (lastChest) {
        this.writeChestInstance(lastChest, index);
      }
      this.entityIdMap.set(index, lastEntityId);
    }

    this.chestInstanceOrder.pop();
    this.chestInstanceIndices.delete(entityId);
    this.entityIdMap.delete(lastIndex);
    this.removeChestPoint(entityId);
    this.removeEntityIdLabel(entityId);
  }

  private writeChestInstance(chest: ChestData, index: number) {
    const position = this.getChestWorldPosition(chest.entityId, chest.hexCoords);
    position.y += 0.05;
    const { x, y } = chest.hexCoords.getContract();

    this.dummy.position.copy(position);
    const rotationSeed = hashCoordinates(x, y);
    const rotationIndex = Math.floor(rotationSeed * 6);
    const randomRotation = (rotationIndex * Math.PI) / 3;
    this.dummy.rotation.y = randomRotation;
    this.dummy.updateMatrix();
    this.chestModel.setMatrixAt(index, this.dummy.matrix);
  }

  private updateChestLabelPosition(chest: ChestData) {
    const existingLabel = this.entityIdLabels.get(chest.entityId);
    if (!existingLabel) {
      return;
    }
    const updatedPosition = this.getChestWorldPosition(chest.entityId, chest.hexCoords);
    updatedPosition.y += 1.5;
    existingLabel.position.copy(updatedPosition);
  }

  private updateChestPoint(chest: ChestData) {
    if (!this.pointsRenderer) {
      return;
    }
    const iconPosition = this.getChestWorldPosition(chest.entityId, chest.hexCoords);
    iconPosition.y += 2;
    this.pointsRenderer.setPoint({
      entityId: chest.entityId,
      position: iconPosition,
    });
  }

  private removeChestPoint(entityId: ID) {
    if (this.pointsRenderer && this.pointsRenderer.hasPoint(entityId)) {
      this.pointsRenderer.removePoint(entityId);
    }
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
      // Highlight point icon on hover
      if (this.pointsRenderer) {
        this.pointsRenderer.setHover(entityId);
      }
      return;
    }

    this.addEntityIdLabel(chest, position);

    // Highlight point icon on hover
    if (this.pointsRenderer) {
      this.pointsRenderer.setHover(entityId);
    }
  }

  public hideLabel(entityId: ID): void {
    this.removeEntityIdLabel(entityId);

    // Remove hover highlight from point icon
    if (this.pointsRenderer) {
      this.pointsRenderer.clearHover();
    }
  }

  public hideAllLabels(): void {
    Array.from(this.entityIdLabels.keys()).forEach((chestId) => this.removeEntityIdLabel(chestId));

    // Clear hover highlight from points
    if (this.pointsRenderer) {
      this.pointsRenderer.clearHover();
    }
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

    // Remove point icon
    if (this.pointsRenderer) {
      this.pointsRenderer.removePoint(entityId);
    }

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
