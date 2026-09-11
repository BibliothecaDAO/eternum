import { resolveChestTransition } from "../rewards/chest-transition-policy";
import { ChestModelPath } from "@/three/constants";
import { RewardTileModel } from "../rewards/reward-tile-model";
import { ChestTransitions } from "../rewards/chest-transitions";
import type { PipelineCompiler } from "../pipeline-compiler";
import { FELT_CENTER } from "@/ui/config";
import { Position } from "@bibliothecadao/eternum";
import {
  getActiveGameSyncRuntime,
  type ChestSpatialProjectionChange,
  type ChestSpatialRenderable,
  type WorldSpatialProjection,
} from "@bibliothecadao/eternum/game-sync";
import { ID } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { CameraView, HexagonScene } from "../scenes/hexagon-scene";
import { resolveWorldmapContentLadder, type WorldmapContentLadder } from "../scenes/worldmap-content-ladder";
import { FLAT_TERRAIN_SURFACE, placePositionOnTerrain } from "../terrain/terrain-surface";
import { RenderChunkSize } from "../types/common";
import { getRenderBounds } from "../utils/chunk-geometry";
import { getWorldPositionForHex } from "../utils";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { resolveRewardNightAmount } from "../rewards/reward-lighting";
import { createChestLabel } from "../utils/labels/label-factory";
import { applyLabelTransitions, transitionManager } from "../utils/labels/label-transitions";
import { gltfLoader } from "../utils/utils";
import { snapshotRendererDiagnostics } from "../renderer-diagnostics";
import { resolveChestPointLabelSize } from "./chest-point-label-policy";
import {
  bindManagerChunkRuntimeState,
  recoverManagerChunkRuntimeAfterStall,
  type ManagerChunkUpdateOptions,
  type RecoverManagerChunkRuntimeAfterStallInput,
  runManagerChunkUpdateRuntime,
} from "./manager-chunk-runtime";
import { PointsLabelRenderer } from "./points-label-renderer";
import {
  isCommittedManagerChunk,
  MANAGER_UNCOMMITTED_CHUNK,
  shouldAcceptManagerChunkRequest,
  shouldRunManagerChunkUpdate,
  waitForVisualSettle,
} from "./manager-update-convergence";
import { resolvePointLabelTextureFlipY } from "./point-label-texture-policy";
import type { HoverLabelShowResult } from "./hover-label-show-result";
import {
  isFrameBudgetWorkQueueDisposedError,
  scheduleFrameBudgetWork,
  type FrameBudgetWorkLane,
  type FrameBudgetWorkScheduler,
} from "../frame-budget-work-queue";

const MAX_INSTANCES = 1000;

export class ChestManager {
  private scene: THREE.Scene;
  private chestModel?: RewardTileModel;
  private modelLoadPromise?: Promise<void>;
  private chestTransitions?: ChestTransitions;
  private renderedChunk: string | null = null;
  private renderChunkSize: RenderChunkSize;
  private hexagonScene?: HexagonScene;
  private dummy: THREE.Object3D = new THREE.Object3D();
  private visibleChests: readonly ChestSpatialRenderable[] = [];
  private currentChunkKey: string | null = MANAGER_UNCOMMITTED_CHUNK;
  private entityIdLabels: Map<ID, CSS2DObject> = new Map();
  private labelsGroup: THREE.Group;
  private entityIdMap: Map<number, ID> = new Map();
  private chestInstanceOrder: ID[] = [];
  private chestInstanceIndices: Map<ID, number> = new Map();
  private chunkSize: number;
  private currentCameraView: CameraView;
  private contentLadder: WorldmapContentLadder;
  private chunkSwitchPromise: Promise<void> | null = null; // Track ongoing chunk switches
  private latestTransitionToken = 0;
  private transitionChunkByToken: Map<number, string> = new Map();
  private pointsRenderer?: PointsLabelRenderer; // Points-based icon renderer
  private readonly worldSpatialProjection: WorldSpatialProjection;
  private unsubscribeProjection: () => void;
  private isDestroyed = false;

  constructor(
    scene: THREE.Scene,
    renderChunkSize: RenderChunkSize,
    worldSpatialProjection: WorldSpatialProjection,
    labelsGroup?: THREE.Group,
    hexagonScene?: HexagonScene,
    chunkSize: number = Math.max(1, Math.floor(renderChunkSize.width / 2)),
    private readonly chunkWorkScheduler?: FrameBudgetWorkScheduler,
    private readonly compilePipelines: PipelineCompiler = async () => {},
  ) {
    this.scene = scene;
    this.worldSpatialProjection = worldSpatialProjection;
    this.hexagonScene = hexagonScene;
    this.labelsGroup = labelsGroup || new THREE.Group();
    this.renderChunkSize = renderChunkSize;
    this.chunkSize = chunkSize;
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;
    this.contentLadder = resolveWorldmapContentLadder(this.currentCameraView);

    // Initialize points-based icon renderer
    this.initializePointsRenderer();

    if (hexagonScene) {
      hexagonScene.addCameraViewListener(this.handleCameraViewChange);
    }

    this.unsubscribeProjection = worldSpatialProjection.subscribeChests((changes) => this.onChestChanges(changes));
  }

  public hasActiveLabelAnimations(): boolean {
    return this.chestTransitions?.hasRelicReveals() ?? false;
  }

  public getVisibleCount(): number {
    return this.visibleChests.length;
  }

  private handleCameraViewChange = (view: CameraView) => {
    const shadowsEnabled = this.hexagonScene?.getShadowsEnabled() ?? true;
    const enableContactShadows = !(view === CameraView.Close && shadowsEnabled);

    // Cheap grounding in zoomed-out views (and as a fallback if shadows are disabled).
    if (this.chestModel) {
      this.chestModel.setContactShadowsEnabled(enableContactShadows);
    }

    this.applyContentLadder(resolveWorldmapContentLadder(view));
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

  private applyContentLadder(ladder: WorldmapContentLadder): void {
    this.contentLadder = ladder;
    if (this.chestModel) this.chestModel.group.visible = ladder.structureModels;
    if (this.chestTransitions) this.chestTransitions.group.visible = ladder.structureModels;
    this.pointsRenderer?.setEnabled(ladder.entityIcons);
    this.labelsGroup.visible = ladder.textLabels !== "none";
  }

  private initializePointsRenderer(): void {
    // Load chest icon texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "/images/labels/chest.png",
      (texture) => {
        if (this.isDestroyed) {
          texture.dispose();
          return;
        }
        // Texture loaded successfully
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = resolvePointLabelTextureFlipY(snapshotRendererDiagnostics().activeMode);

        // Create points renderer with loaded texture
        this.pointsRenderer = new PointsLabelRenderer(
          this.scene,
          texture,
          MAX_INSTANCES, // Max points same as max chest instances
          resolveChestPointLabelSize(),
          0, // Hover scale multiplier
          1.3, // Hover brightness multiplier
          false, // sizeAttenuation: false = fixed screen size (avoids WebGPU squish)
        );
        this.pointsRenderer.setEnabled(this.contentLadder.entityIcons);

        // Re-render visible chests to populate points
        if (isCommittedManagerChunk(this.currentChunkKey)) {
          void this.requestVisibleChestsRefresh(this.currentChunkKey);
        }
      },
      undefined,
      (error) => {
        console.error("[ChestManager] Failed to load chest icon texture:", error);
      },
    );
  }

  public destroy() {
    // Guard the async loadModel completion from re-adding resources after teardown.
    this.isDestroyed = true;
    this.unsubscribeProjection();

    // Clean up camera view listener
    if (this.hexagonScene) {
      this.hexagonScene.removeCameraViewListener(this.handleCameraViewChange);
    }

    this.chestTransitions?.dispose();

    // Clean up points renderer
    if (this.pointsRenderer) {
      this.pointsRenderer.dispose();
    }

    this.chestModel?.dispose();

    // Remove and clear entity labels from the label group.
    this.entityIdLabels.forEach((label) => this.labelsGroup.remove(label));
    this.entityIdLabels.clear();

    this.entityIdMap.clear();
    this.chestInstanceIndices.clear();
    this.chestInstanceOrder = [];
    this.visibleChests = [];
    this.transitionChunkByToken.clear();
  }

  private prepareModel(): Promise<void> {
    if (this.chestModel || this.isDestroyed) return Promise.resolve();
    // Chest geometry and effects belong to the noncritical chunk stage. Eager
    // compilation competes with the structures that gate the first visible map.
    return (this.modelLoadPromise ??= this.loadModel().finally(() => {
      this.modelLoadPromise = undefined;
    }));
  }

  private async loadModel(): Promise<void> {
    let model: RewardTileModel | undefined;
    let transitions: ChestTransitions | undefined;
    try {
      const gltf = await gltfLoader.loadAsync(ChestModelPath);
      model = new RewardTileModel(gltf, MAX_INSTANCES);
      transitions = new ChestTransitions(gltf);
      await this.compilePipelines(model.group, this.scene);
      await transitions.prepare(this.compilePipelines, this.scene);
      if (this.isDestroyed) {
        transitions.dispose();
        model.dispose();
        return;
      }
      this.chestModel = model;
      this.chestTransitions = transitions;
      this.scene.add(model.group, transitions.group);
      this.applyContentLadder(this.contentLadder);
    } catch (error) {
      transitions?.dispose();
      model?.dispose();
      throw error;
    }
  }

  private onChestChanges(changes: readonly ChestSpatialProjectionChange[]): void {
    if (!isCommittedManagerChunk(this.currentChunkKey) || this.isDestroyed) return;
    if (this.chestModel && this.chestTransitions) {
      const [row, col] = this.currentChunkKey.split(",").map(Number);
      const visibleIds = new Set(this.getVisibleChestsForChunk(row, col).map((chest) => chest.entityId));
      for (const change of changes) {
        const kind = resolveChestTransition({
          change,
          syncStatus: getActiveGameSyncRuntime()?.getStatus(),
          isVisible: visibleIds.has(change.entityId),
          wasVisible: this.chestInstanceIndices.has(change.entityId),
        });
        const chest = change.current ?? change.previous;
        if (kind && chest)
          this.chestTransitions.start(
            this.transitionKey(chest),
            kind,
            this.chestPlacement(chest),
            this.chestModel.time,
          );
      }
    }
    // A live logical change is applied together; chunk browsing never creates FX.
    this.renderVisibleChests(this.currentChunkKey);
  }

  public revealRelics(hexCoords: { col: number; row: number }, relics: readonly number[]): boolean {
    if (!this.chestModel || !this.chestTransitions || !this.contentLadder.structureModels) return false;
    const tile = { hexCoords };
    const key = this.transitionKey(tile);
    const opened = this.chestTransitions.start(key, "open", this.chestPlacement(tile), this.chestModel.time);
    if (!opened) return false;
    this.chestTransitions.revealRelics(key, relics);
    const chest = this.worldSpatialProjection.getChestsAtHex(hexCoords)[0];
    const instance = chest ? this.chestInstanceIndices.get(chest.entityId) : undefined;
    if (instance !== undefined) this.chestModel.removeInstance(instance);
    this.updateChestMarkers();
    return true;
  }

  private transitionKey(chest: Pick<ChestSpatialRenderable, "hexCoords">): string {
    return `${chest.hexCoords.col},${chest.hexCoords.row}`;
  }

  async updateChunk(chunkKey: string, options?: ManagerChunkUpdateOptions) {
    await runManagerChunkUpdateRuntime({
      chunkKey,
      isDestroyed: () => this.isDestroyed,
      prepareForUpdate: () => this.prepareModel(),
      executeChunkUpdate: (nextChunkKey, nextOptions) => {
        if (
          !shouldRunManagerChunkUpdate({
            chunkKey: nextChunkKey,
            currentChunk: this.currentChunkKey,
            transitionToken: nextOptions?.transitionToken,
            latestTransitionToken: this.latestTransitionToken,
          })
        ) {
          return false;
        }

        return this.requestVisibleChestsRefresh(nextChunkKey);
      },
      onPreviousUpdateFailed: (error) => {
        console.warn(`Previous chest chunk switch failed:`, error);
      },
      options,
      shouldAcceptRequest: shouldAcceptManagerChunkRequest,
      state: this.resolveChunkUpdateRuntimeState(),
      waitForSettle: waitForVisualSettle,
    });
  }

  recoverChunkUpdateAfterStall(input: RecoverManagerChunkRuntimeAfterStallInput): void {
    recoverManagerChunkRuntimeAfterStall(this.resolveChunkUpdateRuntimeState(), input);
  }

  private resolveChunkUpdateRuntimeState() {
    return bindManagerChunkRuntimeState({
      getCurrentChunk: () => this.currentChunkKey,
      setCurrentChunk: (chunkKey) => {
        this.currentChunkKey = chunkKey;
      },
      getInFlightPromise: () => this.chunkSwitchPromise,
      setInFlightPromise: (promise) => {
        this.chunkSwitchPromise = promise;
      },
      getLatestTransitionToken: () => this.latestTransitionToken,
      setLatestTransitionToken: (transitionToken) => {
        this.latestTransitionToken = transitionToken;
      },
      transitionChunkByToken: this.transitionChunkByToken,
    });
  }

  private getChestWorldPosition = (chest: Pick<ChestSpatialRenderable, "hexCoords">) => {
    const { x: hexCoordsX, y: hexCoordsY } = new Position({
      x: chest.hexCoords.col,
      y: chest.hexCoords.row,
    }).getNormalized();
    const basePosition = getWorldPositionForHex({ col: hexCoordsX, row: hexCoordsY });
    return placePositionOnTerrain(basePosition, this.hexagonScene?.getTerrainSurface() ?? FLAT_TERRAIN_SURFACE, 0.03);
  };

  private getVisibleChestsForChunk(startRow: number, startCol: number): readonly ChestSpatialRenderable[] {
    const bounds = getRenderBounds(startRow, startCol, this.renderChunkSize, this.chunkSize);
    const center = FELT_CENTER();
    return this.worldSpatialProjection.getChestsInBounds({
      minCol: bounds.minCol + center,
      maxCol: bounds.maxCol + center,
      minRow: bounds.minRow + center,
      maxRow: bounds.maxRow + center,
    });
  }

  private requestVisibleChestsRefresh(chunkKey: string, workLane: FrameBudgetWorkLane = "visible"): Promise<void> {
    return scheduleFrameBudgetWork(
      this.chunkWorkScheduler,
      workLane,
      () => this.renderVisibleChests(chunkKey),
      "manager:chest-visibility",
    ).catch((error) => {
      if (isFrameBudgetWorkQueueDisposedError(error)) {
        return;
      }
      console.error("[ChestManager] Failed to refresh visible chests", error);
    });
  }

  private renderVisibleChests(chunkKey: string) {
    if (this.isDestroyed || !this.chestModel) {
      return;
    }

    if (this.renderedChunk !== chunkKey) this.chestTransitions?.clear();
    this.renderedChunk = chunkKey;
    const [startRow, startCol] = chunkKey.split(",").map(Number);
    const visibleChests = this.getVisibleChestsForChunk(startRow, startCol);
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

    this.entityIdLabels.forEach((label, entityId) => {
      if (!visibleChestIds.has(entityId)) {
        this.removeEntityIdLabel(entityId);
      }
    });

    this.updateChestMarkers();
  }

  private updateChestMarkers(): void {
    if (!this.pointsRenderer) return;
    const revealed = this.visibleChests.filter(
      (chest) => (this.chestTransitions?.revealProgress(this.transitionKey(chest)) ?? 1) > 0,
    );
    const revealedIds = new Set(revealed.map((chest) => chest.entityId));
    this.pointsRenderer.setMany(
      revealed.map((chest) => {
        const progress = this.chestTransitions?.revealProgress(this.transitionKey(chest)) ?? 1;
        const position = this.getChestWorldPosition(chest);
        position.y += 2 - (1 - progress) * 0.5 + Math.sin(progress * Math.PI) * 0.14;
        return { entityId: chest.entityId, position };
      }),
    );
    this.pointsRenderer.removeMany(this.pointsRenderer.getEntityIds().filter((entityId) => !revealedIds.has(entityId)));
  }

  private addChestInstance(chest: ChestSpatialRenderable) {
    const index = this.chestInstanceOrder.length;
    this.chestInstanceOrder.push(chest.entityId);
    this.chestInstanceIndices.set(chest.entityId, index);
    this.entityIdMap.set(index, chest.entityId);
    this.writeChestInstance(chest, index);
    this.updateChestLabelPosition(chest);
  }

  private updateChestInstance(chest: ChestSpatialRenderable) {
    const index = this.chestInstanceIndices.get(chest.entityId);
    if (index === undefined) {
      return;
    }
    this.writeChestInstance(chest, index);
    this.entityIdMap.set(index, chest.entityId);
    this.updateChestLabelPosition(chest);
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
      const lastChest = this.worldSpatialProjection.getChest(lastEntityId);
      if (lastChest) {
        this.writeChestInstance(lastChest, index);
      }
      this.entityIdMap.set(index, lastEntityId);
    }

    this.chestInstanceOrder.pop();
    this.chestInstanceIndices.delete(entityId);
    this.entityIdMap.delete(lastIndex);
    this.removeEntityIdLabel(entityId);
  }

  private writeChestInstance(chest: ChestSpatialRenderable, index: number) {
    if (this.chestTransitions?.has(this.transitionKey(chest))) {
      this.chestModel?.removeInstance(index);
      return;
    }
    this.chestModel?.setMatrixAt(index, this.chestPlacement(chest));
  }

  private chestPlacement(chest: Pick<ChestSpatialRenderable, "hexCoords">): THREE.Matrix4 {
    this.dummy.position.copy(this.getChestWorldPosition(chest));
    this.dummy.position.y += 0.05;
    this.dummy.rotation.y = 0;
    this.dummy.updateMatrix();
    return this.dummy.matrix;
  }

  private updateChestLabelPosition(chest: ChestSpatialRenderable) {
    const existingLabel = this.entityIdLabels.get(chest.entityId);
    if (!existingLabel) {
      return;
    }
    const updatedPosition = this.getChestWorldPosition(chest);
    updatedPosition.y += 1.5;
    existingLabel.position.copy(updatedPosition);
  }

  private removeEntityIdLabel(entityId: number) {
    const label = this.entityIdLabels.get(entityId);
    if (label) {
      this.labelsGroup.remove(label);
      this.entityIdLabels.delete(entityId);
    }
  }

  private addEntityIdLabel(chest: ChestSpatialRenderable, position: THREE.Vector3) {
    // Use centralized chest label creation
    const labelDiv = createChestLabel(
      {
        entityId: chest.entityId,
        hexCoords: new Position({ x: chest.hexCoords.col, y: chest.hexCoords.row }),
      },
      this.currentCameraView,
    );

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

  public showLabel(entityId: ID): HoverLabelShowResult {
    const chest = this.worldSpatialProjection.getChest(entityId);
    if (!chest) {
      return { status: "missing" };
    }

    const position = this.getChestWorldPosition(chest);
    position.y += 0.05;

    const existingLabel = this.entityIdLabels.get(entityId);
    if (existingLabel) {
      const wasDetached = existingLabel.parent !== this.labelsGroup;
      const wasHidden = existingLabel.visible !== true || existingLabel.element.style.display === "none";
      const updatedPosition = this.getChestWorldPosition(chest);
      updatedPosition.y += 1.5;
      existingLabel.position.copy(updatedPosition);
      if (wasDetached) {
        this.labelsGroup.add(existingLabel);
      }
      existingLabel.visible = true;
      existingLabel.element.style.display = "";
      // Highlight point icon on hover
      if (this.pointsRenderer) {
        this.pointsRenderer.setHover(entityId);
      }
      return wasDetached || wasHidden ? { status: "reattached" } : { status: "unchanged" };
    }

    this.addEntityIdLabel(chest, position);

    // Highlight point icon on hover
    if (this.pointsRenderer) {
      this.pointsRenderer.setHover(entityId);
    }
    return { status: "shown" };
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

  public update(deltaTime: number) {
    const cameraPosition = this.hexagonScene?.getCamera().position;
    const nightAmount = resolveRewardNightAmount(useUIStore.getState().cycleProgress);
    this.chestModel?.updatePresentation(nightAmount, cameraPosition);
    this.chestModel?.updateAnimations(deltaTime);
    if (
      this.chestModel &&
      this.chestTransitions?.update(deltaTime, this.chestModel.time, cameraPosition, nightAmount)
    ) {
      for (const chest of this.visibleChests) this.updateChestInstance(chest);
      this.updateChestMarkers();
    }
  }
}
