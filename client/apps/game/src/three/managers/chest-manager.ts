import { ChestModelPath } from "@/three/constants";
import InstancedModel from "@/three/managers/instanced-model";
import { Position } from "@/types/position";
import { FELT_CENTER, ID } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { CameraView, HexagonScene } from "../scenes/hexagon-scene";
import { ChestData, ChestSystemUpdate } from "../types";
import { RenderChunkSize } from "../types/common";
import { getWorldPositionForHex, hashCoordinates } from "../utils";
import { createContentContainer, createLabelBase, transitionManager } from "../utils/";
import { gltfLoader } from "../utils/utils";

const MAX_INSTANCES = 1000;
const CHEST_ICON_PATH = "/images/labels/chest.png";

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
    this.visibleChests.forEach((chest) => {
      this.updateLabelVisibility(chest.entityId, view === CameraView.Far);
    });
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

    this.currentChunkKey = chunkKey;
    this.renderVisibleChests(chunkKey);
  }

  private getChestWorldPosition = (chestEntityId: ID, hexCoords: Position) => {
    const { x: hexCoordsX, y: hexCoordsY } = hexCoords.getNormalized();
    const basePosition = getWorldPositionForHex({ col: hexCoordsX, row: hexCoordsY });
    return basePosition;
  };

  private isChestVisible(chest: { entityId: ID; hexCoords: Position }, startRow: number, startCol: number) {
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

        // Always recreate the label to ensure it matches current camera view
        if (this.entityIdLabels.has(chest.entityId)) {
          this.removeEntityIdLabel(chest.entityId);
        }
        this.addEntityIdLabel(chest, position);

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
    // Create label div using the shared base
    const labelDiv = createLabelBase({
      isMine: false, // Chests don't have ownership
      textColor: "text-yellow-300", // Use gold color for chests
    });

    // Prevent right click
    labelDiv.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    const img = document.createElement("img");
    img.src = CHEST_ICON_PATH;
    img.classList.add("w-auto", "h-full", "inline-block", "object-contain", "max-w-[32px]");
    labelDiv.appendChild(img);

    // Create text container with transition using shared utility
    const textContainer = createContentContainer(this.currentCameraView);

    const line1 = document.createElement("span");
    line1.textContent = `Chest`;
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
    this.entityIdLabels.set(chest.entityId, label);
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
          containerId = `chest_${entityId}_${Math.random().toString(36).substring(2, 9)}`;
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
