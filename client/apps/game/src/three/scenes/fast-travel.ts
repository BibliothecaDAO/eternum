import type { SetupResult } from "@bibliothecadao/dojo";
import { PathRenderer } from "../managers/path-renderer";
import { SelectedHexManager } from "../managers/selected-hex-manager";
import { SelectionPulseManager } from "../managers/selection-pulse-manager";
import { Color, Group, Mesh, Raycaster, Vector2, Vector3 } from "three";
import type { MapControls } from "three/examples/jsm/controls/MapControls.js";

import type { SceneManager } from "../scene-manager";
import { SceneName } from "../types";
import { getWorldPositionForHex } from "../utils";
import {
  hydrateFastTravelChunkState,
  type FastTravelArmyHydrationInput,
  type FastTravelChunkHydrationResult,
  type FastTravelHexCoords,
  type FastTravelSpireHydrationInput,
} from "./fast-travel-hydration";
import { buildFastTravelEntityAnchors, type FastTravelEntityAnchor } from "./fast-travel-entity-anchors";
import { resolveFastTravelMovement, type FastTravelMovementResolution } from "./fast-travel-movement-policy";
import { prepareFastTravelRenderState, type FastTravelRenderState } from "./fast-travel-rendering";
import {
  FAST_TRAVEL_CHUNK_POLICY,
  resolveFastTravelChunkHydrationPlan,
  resolveFastTravelVisibleChunkDecision,
} from "./fast-travel-chunk-loading-runtime";
import { createFastTravelRenderAssets, type FastTravelRenderAssets } from "./fast-travel-render-assets";
import { resetFastTravelRuntimeState } from "./fast-travel-runtime-lifecycle";
import { WarpTravel, type WarpTravelLifecycleAdapter } from "./warp-travel";

export default class FastTravelScene extends WarpTravel {
  private readonly travelLabelGroup = new Group();
  private readonly travelSurfaceGroup = new Group();
  private readonly travelContentGroup = new Group();
  private readonly selectedHexManager: SelectedHexManager;
  private readonly selectionPulseManager: SelectionPulseManager;
  private readonly pathRenderer: PathRenderer;
  private readonly renderAssets: FastTravelRenderAssets;
  private currentHydratedChunk: FastTravelChunkHydrationResult | null = null;
  private currentRenderState: FastTravelRenderState | null = null;
  private currentEntityAnchors: FastTravelEntityAnchor[] = [];
  private sceneArmies: FastTravelArmyHydrationInput[] = [];
  private sceneSpires: FastTravelSpireHydrationInput[] = [];
  private selectedArmyEntityId: string | null = null;
  private previewTargetHexKey: string | null = null;
  private currentChunk: string = "null";
  private chunkRefreshTimeout: number | null = null;
  private pendingChunkRefreshForce = false;
  private hasCompletedSwitchOffCleanup = false;
  private hasDisposedFastTravelOwnedResources = false;
  private readonly chunkRefreshDebounceMs = FAST_TRAVEL_CHUNK_POLICY.refreshDebounceMs;
  private handleFastTravelControlsChange = (): void => {
    if (this.isSwitchedOff || this.sceneManager.getCurrentScene() !== SceneName.FastTravel) {
      return;
    }

    this.requestChunkRefresh();
  };

  constructor(
    dojoContext: SetupResult,
    raycaster: Raycaster,
    controls: MapControls,
    mouse: Vector2,
    sceneManager: SceneManager,
  ) {
    super(SceneName.FastTravel, controls, dojoContext, mouse, raycaster, sceneManager);
    this.travelLabelGroup.name = "FastTravelLabelsGroup";
    this.travelSurfaceGroup.name = "FastTravelSurfaceGroup";
    this.travelContentGroup.name = "FastTravelContentGroup";
    this.selectedHexManager = new SelectedHexManager(this.scene);
    this.selectionPulseManager = new SelectionPulseManager(this.scene);
    this.pathRenderer = new PathRenderer();
    this.renderAssets = createFastTravelRenderAssets();
    this.pathRenderer.initialize(this.scene);
    this.pathRenderer.setVisibilityManager(this.visibilityManager);
    this.scene.add(this.travelSurfaceGroup);
    this.scene.add(this.travelContentGroup);
  }

  protected shouldCreateGroundMesh(): boolean {
    return false;
  }

  protected shouldEnableStormEffects(): boolean {
    return false;
  }

  protected getWarpTravelLifecycleAdapter(): WarpTravelLifecycleAdapter {
    return {
      onSetupStart: () => this.configureFastTravelSetupStart(),
      onInitialSetupStart: () => this.prepareFastTravelInitialSetup(),
      moveCameraToSceneLocation: () => this.moveCameraToURLLocation(),
      attachLabelGroupsToScene: () => this.attachFastTravelLabelGroupsToScene(),
      attachManagerLabels: () => this.attachFastTravelManagerLabels(),
      registerStoreSubscriptions: () => this.registerFastTravelStoreSubscriptions(),
      setupCameraZoomHandler: () => this.setupFastTravelCameraZoomHandler(),
      refreshScene: () => this.refreshFastTravelScene(),
      reportSetupError: (error, phase) => this.reportFastTravelRefreshError(error, phase),
      disposeStoreSubscriptions: () => this.disposeFastTravelStoreSubscriptions(),
      detachLabelGroupsFromScene: () => this.detachFastTravelLabelGroupsFromScene(),
      detachManagerLabels: () => this.detachFastTravelManagerLabels(),
    };
  }

  private configureFastTravelSetupStart(): void {
    this.hasCompletedSwitchOffCleanup = false;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.interactiveHexManager.setSurfaceVisibility(false);
    this.interactiveHexManager.setHoverVisualMode("outline");
    this.scene.background = new Color("#000000");
    this.scene.fog = null;
  }

  private prepareFastTravelInitialSetup(): void {
    this.travelLabelGroup.clear();
    this.clearTravelVisualGroups();
    this.clearFastTravelMovementPreview();
    this.selectionPulseManager.hideSelection();
  }

  private attachFastTravelLabelGroupsToScene(): void {
    this.attachWarpTravelLabelGroupsToScene([this.travelLabelGroup]);
  }

  private attachFastTravelManagerLabels(): void {}

  private registerFastTravelStoreSubscriptions(): void {}

  private setupFastTravelCameraZoomHandler(): void {
    this.controls.removeEventListener("change", this.handleFastTravelControlsChange);
    this.controls.addEventListener("change", this.handleFastTravelControlsChange);
  }

  private async refreshFastTravelScene(): Promise<void> {
    if (this.isSwitchedOff) {
      return;
    }

    await this.updateVisibleChunks(true);
  }

  private reportFastTravelRefreshError(error: unknown, phase: "initial" | "resume"): void {
    const message =
      phase === "initial"
        ? "[FastTravelScene] Failed to refresh initial scene state"
        : "[FastTravelScene] Failed to refresh resumed scene state";
    console.error(message, error);
  }

  private disposeFastTravelStoreSubscriptions(): void {
    this.controls.removeEventListener("change", this.handleFastTravelControlsChange);
    if (this.chunkRefreshTimeout !== null) {
      window.clearTimeout(this.chunkRefreshTimeout);
      this.chunkRefreshTimeout = null;
    }
    this.pendingChunkRefreshForce = false;
  }

  private detachFastTravelLabelGroupsFromScene(): void {
    this.detachWarpTravelLabelGroupsFromScene([this.travelLabelGroup]);
  }

  private detachFastTravelManagerLabels(): void {}

  protected onHexagonMouseMove(hex: { hexCoords: FastTravelHexCoords } | null): void {
    if (!hex || !this.selectedArmyEntityId) {
      this.clearFastTravelMovementPreview();
      return;
    }

    this.previewFastTravelMovement(hex.hexCoords);
  }

  protected onHexagonDoubleClick(): void {}

  protected onHexagonClick(hexCoords: FastTravelHexCoords | null): void {
    if (!hexCoords) {
      this.clearFastTravelMovementPreview();
      return;
    }

    const clickedArmy = this.currentEntityAnchors.find(
      (anchor) =>
        anchor.kind === "army" && anchor.hexCoords.col === hexCoords.col && anchor.hexCoords.row === hexCoords.row,
    );

    if (clickedArmy) {
      this.selectedArmyEntityId = clickedArmy.entityId;
      this.previewTargetHexKey = null;
      this.clearFastTravelMovementPreview();
      this.syncSelectedArmyFeedback();
      return;
    }

    if (!this.selectedArmyEntityId) {
      return;
    }

    this.commitFastTravelMovement(hexCoords);
  }

  protected onHexagonRightClick(): void {
    this.clearFastTravelMovementPreview();
    this.selectedArmyEntityId = null;
    this.selectedHexManager.resetPosition();
    this.selectionPulseManager.hideSelection();
    this.pathRenderer.setSelectedPath(null);
  }

  public moveCameraToURLLocation(): void {
    const url = new URL(window.location.href);
    const col = Number(url.searchParams.get("col"));
    const row = Number(url.searchParams.get("row"));

    if (!Number.isFinite(col) || !Number.isFinite(row)) {
      return;
    }

    this.moveCameraToColRow(col, row, 0);
  }

  public onSwitchOff(_nextSceneName?: SceneName): void {
    if (this.hasCompletedSwitchOffCleanup) {
      return;
    }

    this.runWarpTravelSwitchOffLifecycle();
    this.resetFastTravelRuntimeState();
    this.hasCompletedSwitchOffCleanup = true;
  }

  public hasActiveLabelAnimations(): boolean {
    return false;
  }

  public getHexEntitiesAt(hexCoords: FastTravelHexCoords) {
    return this.currentHydratedChunk?.hexEntityLookup.get(`${hexCoords.col},${hexCoords.row}`) ?? [];
  }

  public getCurrentHydratedChunk(): FastTravelChunkHydrationResult | null {
    return this.currentHydratedChunk;
  }

  public getCurrentRenderState(): FastTravelRenderState | null {
    return this.currentRenderState;
  }

  public requestSceneRefresh(): void {
    if (this.isSwitchedOff) {
      return;
    }

    void this.updateVisibleChunks(true);
  }

  public destroy(): void {
    this.onSwitchOff();

    if (!this.hasDisposedFastTravelOwnedResources) {
      this.renderAssets.dispose();
      this.selectedHexManager.dispose();
      this.selectionPulseManager.dispose();
      this.hasDisposedFastTravelOwnedResources = true;
    }

    super.destroy();
  }

  public update(deltaTime: number): void {
    super.update(deltaTime);
    this.selectedHexManager.update(deltaTime);
    this.selectionPulseManager.update(deltaTime);
    this.pathRenderer.update(deltaTime);
  }

  private resolveFastTravelFocusHex(): FastTravelHexCoords {
    const url = new URL(window.location.href);
    const col = Number(url.searchParams.get("col"));
    const row = Number(url.searchParams.get("row"));

    if (Number.isFinite(col) && Number.isFinite(row)) {
      return {
        col,
        row,
      };
    }

    return this.getCameraTargetHex();
  }

  private resolveFastTravelFocusPoint(): { x: number; z: number } {
    if (Number.isFinite(this.controls.target.x) && Number.isFinite(this.controls.target.z)) {
      return {
        x: this.controls.target.x,
        z: this.controls.target.z,
      };
    }

    const focusHex = this.resolveFastTravelFocusHex();
    const worldPosition = getWorldPositionForHex(focusHex);
    return {
      x: worldPosition.x,
      z: worldPosition.z,
    };
  }

  private buildDemoArmies(focusHex: FastTravelHexCoords): FastTravelArmyHydrationInput[] {
    return [
      {
        entityId: "fast-travel-army",
        hexCoords: focusHex,
        ownerName: "Warp Vanguard",
      },
    ];
  }

  private buildDemoSpires(focusHex: FastTravelHexCoords): FastTravelSpireHydrationInput[] {
    return [
      {
        entityId: "fast-travel-spire-west",
        label: "Western Spire",
        worldHexCoords: { col: 400, row: 120 },
        travelHexCoords: { col: focusHex.col - 2, row: focusHex.row + 1 },
      },
      {
        entityId: "fast-travel-spire-east",
        label: "Eastern Spire",
        worldHexCoords: { col: 520, row: 240 },
        travelHexCoords: { col: focusHex.col + 2, row: focusHex.row - 1 },
      },
    ];
  }

  private requestChunkRefresh(force: boolean = false): void {
    if (this.isSwitchedOff) {
      return;
    }

    if (force) {
      this.pendingChunkRefreshForce = true;
    }

    if (this.chunkRefreshTimeout !== null) {
      return;
    }

    this.chunkRefreshTimeout = window.setTimeout(() => {
      const shouldForce = this.pendingChunkRefreshForce;
      this.pendingChunkRefreshForce = false;
      this.chunkRefreshTimeout = null;
      void this.updateVisibleChunks(shouldForce).catch((error) => {
        console.error("[FastTravelScene] Failed to refresh visible chunk:", error);
      });
    }, this.chunkRefreshDebounceMs);
  }

  private async updateVisibleChunks(force: boolean = false): Promise<boolean> {
    const chunkDecision = resolveFastTravelVisibleChunkDecision({
      isSwitchedOff: this.isSwitchedOff,
      focusPoint: this.resolveFastTravelFocusPoint(),
      currentChunk: this.currentChunk,
      force,
    });

    if (chunkDecision.action === "noop") {
      return false;
    }

    if (chunkDecision.chunkKey === null || chunkDecision.startCol === null || chunkDecision.startRow === null) {
      return false;
    }

    this.applyFastTravelVisibleChunk(chunkDecision.chunkKey, chunkDecision.startCol, chunkDecision.startRow);
    return true;
  }

  private applyFastTravelVisibleChunk(chunkKey: string, startCol: number, startRow: number): void {
    const focusHex = this.resolveFastTravelFocusHex();
    const chunkPlan = resolveFastTravelChunkHydrationPlan({
      startCol,
      startRow,
    });

    this.currentHydratedChunk = hydrateFastTravelChunkState({
      chunkKey: chunkPlan.chunkKey,
      startCol: chunkPlan.startCol,
      startRow: chunkPlan.startRow,
      width: chunkPlan.width,
      height: chunkPlan.height,
      armies: this.resolveSceneArmies(focusHex),
      spires: this.resolveSceneSpires(focusHex),
    });

    this.currentRenderState = prepareFastTravelRenderState({
      visibleHexWindow: this.currentHydratedChunk.visibleHexWindow,
    });
    this.currentChunk = chunkKey;
    this.syncFastTravelSceneVisuals();
  }

  private syncFastTravelSceneVisuals(): void {
    this.clearTravelVisualGroups();
    this.currentEntityAnchors = [];

    if (!this.currentHydratedChunk || !this.currentRenderState) {
      return;
    }

    this.scene.background = new Color(this.currentRenderState.surface.palette.backgroundColor);
    this.renderAssets.syncPalette(this.currentRenderState.surface.palette);
    this.syncFastTravelSurfaceMeshes();
    this.syncFastTravelInteractiveHexes();
    this.currentEntityAnchors = buildFastTravelEntityAnchors({
      visibleHexWindow: this.currentHydratedChunk.visibleHexWindow,
      armies: this.currentHydratedChunk.armies,
      spireAnchors: this.currentHydratedChunk.spireAnchors,
    });

    this.currentEntityAnchors
      .filter((anchor) => anchor.kind === "spire")
      .forEach((anchor) => {
        this.travelContentGroup.add(this.createSpireAnchorMesh(anchor));
      });

    this.currentEntityAnchors
      .filter((anchor) => anchor.kind === "army")
      .forEach((anchor) => {
        this.travelContentGroup.add(this.createArmyMarkerMesh(anchor));
      });

    this.syncSelectedArmyFeedback();
  }

  private syncFastTravelSurfaceMeshes(): void {
    this.currentRenderState?.surface.field.tiles.forEach((tile) => {
      this.travelSurfaceGroup.add(this.createFastTravelHexMesh(tile.hexCoords));
    });
  }

  private syncFastTravelInteractiveHexes(): void {
    const field = this.currentRenderState?.surface.field;
    if (!field) {
      return;
    }

    this.interactiveHexManager.clearHexes();
    field.tiles.forEach((tile) => {
      this.interactiveHexManager.addHex(tile.hexCoords);
    });

    const centerCol = field.bounds.origin.col + Math.floor(field.bounds.size.cols / 2);
    const centerRow = field.bounds.origin.row + Math.floor(field.bounds.size.rows / 2);
    this.interactiveHexManager.updateVisibleHexes(centerRow, centerCol, field.bounds.size.cols, field.bounds.size.rows);
  }

  private resolveSceneArmies(focusHex: FastTravelHexCoords): FastTravelArmyHydrationInput[] {
    if (this.sceneArmies.length === 0) {
      this.sceneArmies = this.buildDemoArmies(focusHex);
    }

    return this.sceneArmies;
  }

  private resolveSceneSpires(focusHex: FastTravelHexCoords): FastTravelSpireHydrationInput[] {
    if (this.sceneSpires.length === 0) {
      this.sceneSpires = this.buildDemoSpires(focusHex);
    }

    return this.sceneSpires;
  }

  private previewFastTravelMovement(targetHexCoords: FastTravelHexCoords): void {
    const movement = this.resolveFastTravelMovement(targetHexCoords);
    if (!movement) {
      this.clearFastTravelMovementPreview();
      return;
    }

    const targetHexKey = `${targetHexCoords.col},${targetHexCoords.row}`;
    if (this.previewTargetHexKey === targetHexKey) {
      return;
    }

    this.previewTargetHexKey = targetHexKey;
    this.pathRenderer.createPath(
      this.resolvePathEntityId(movement.selectedArmyEntityId),
      movement.worldPath.map((point) => new Vector3(point.x, point.y + 0.18, point.z)),
      new Color(this.currentRenderState?.surface.palette.edgeColor ?? "#ff4fd8"),
      "hover",
    );
  }

  private commitFastTravelMovement(targetHexCoords: FastTravelHexCoords): void {
    const movement = this.resolveFastTravelMovement(targetHexCoords);
    if (!movement) {
      return;
    }

    this.sceneArmies = this.sceneArmies.map((army) =>
      army.entityId === movement.selectedArmyEntityId ? { ...army, hexCoords: movement.targetHexCoords } : army,
    );

    const pathEntityId = this.resolvePathEntityId(movement.selectedArmyEntityId);
    this.pathRenderer.createPath(
      pathEntityId,
      movement.worldPath.map((point) => new Vector3(point.x, point.y + 0.18, point.z)),
      new Color(this.currentRenderState?.surface.palette.accentColor ?? "#ffd6f7"),
      "selected",
    );
    this.pathRenderer.setSelectedPath(pathEntityId);
    this.previewTargetHexKey = null;

    const targetPoint = movement.worldPath[movement.worldPath.length - 1];
    this.selectedHexManager.setPosition(targetPoint.x, targetPoint.z);
    this.selectionPulseManager.hideSelection();

    void this.refreshFastTravelScene();
  }

  private clearFastTravelMovementPreview(): void {
    if (!this.selectedArmyEntityId) {
      this.previewTargetHexKey = null;
      return;
    }

    this.pathRenderer.removePath(this.resolvePathEntityId(this.selectedArmyEntityId));
    this.previewTargetHexKey = null;
  }

  private resolveFastTravelMovement(targetHexCoords: FastTravelHexCoords): FastTravelMovementResolution | null {
    if (!this.selectedArmyEntityId || !this.currentHydratedChunk) {
      return null;
    }

    return resolveFastTravelMovement({
      selectedArmyEntityId: this.selectedArmyEntityId,
      targetHexCoords,
      visibleHexWindow: this.currentHydratedChunk.visibleHexWindow,
      armies: this.sceneArmies,
      spireAnchors: this.sceneSpires,
    });
  }

  private syncSelectedArmyFeedback(): void {
    if (!this.selectedArmyEntityId) {
      this.selectionPulseManager.hideSelection();
      return;
    }

    const selectedArmy = this.currentEntityAnchors.find(
      (anchor) => anchor.kind === "army" && anchor.entityId === this.selectedArmyEntityId,
    );
    if (!selectedArmy) {
      this.selectionPulseManager.hideSelection();
      return;
    }

    this.selectedHexManager.setPosition(selectedArmy.worldPosition.x, selectedArmy.worldPosition.z);
    this.selectionPulseManager.hideSelection();
  }

  private resolvePathEntityId(entityId: string): number {
    return entityId.split("").reduce((hash, character) => hash * 31 + character.charCodeAt(0), 17);
  }

  private resetFastTravelRuntimeState(): void {
    const nextState = resetFastTravelRuntimeState({
      currentHydratedChunk: this.currentHydratedChunk,
      currentRenderState: this.currentRenderState,
      currentEntityAnchors: this.currentEntityAnchors,
      sceneArmies: this.sceneArmies,
      sceneSpires: this.sceneSpires,
      selectedArmyEntityId: this.selectedArmyEntityId,
      previewTargetHexKey: this.previewTargetHexKey,
      currentChunk: this.currentChunk,
      chunkRefreshTimeout: this.chunkRefreshTimeout,
      clearTravelVisualGroups: () => this.clearTravelVisualGroups(),
      interactiveHexManager: this.interactiveHexManager,
      selectionPulseManager: this.selectionPulseManager,
      selectedHexManager: this.selectedHexManager,
      pathRenderer: this.pathRenderer,
      clearTimeout: (timeoutId) => window.clearTimeout(timeoutId),
      resolvePathEntityId: (entityId) => this.resolvePathEntityId(entityId),
    });

    this.currentHydratedChunk = nextState.currentHydratedChunk;
    this.currentRenderState = nextState.currentRenderState;
    this.currentEntityAnchors = nextState.currentEntityAnchors;
    this.sceneArmies = nextState.sceneArmies;
    this.sceneSpires = nextState.sceneSpires;
    this.selectedArmyEntityId = nextState.selectedArmyEntityId;
    this.previewTargetHexKey = nextState.previewTargetHexKey;
    this.currentChunk = nextState.currentChunk;
    this.chunkRefreshTimeout = nextState.chunkRefreshTimeout;
    this.pendingChunkRefreshForce = nextState.pendingChunkRefreshForce;
  }

  private clearTravelVisualGroups(): void {
    this.travelSurfaceGroup.clear();
    this.travelContentGroup.clear();
  }

  private createFastTravelHexMesh(hexCoords: FastTravelHexCoords): Group {
    const { x, y, z } = getWorldPositionForHex(hexCoords);
    const group = new Group();
    group.position.set(x, y, z);
    group.add(this.renderAssets.createHexEdgeMesh());
    return group;
  }

  private createArmyMarkerMesh(anchor: FastTravelEntityAnchor): Mesh {
    const mesh = this.renderAssets.createArmyMarkerMesh();
    mesh.position.set(anchor.worldPosition.x, anchor.worldPosition.y + 0.55, anchor.worldPosition.z);
    return mesh;
  }

  private createSpireAnchorMesh(anchor: FastTravelEntityAnchor): Group {
    const spireGroup = new Group();
    const column = this.renderAssets.createSpireColumnMesh();
    const crown = this.renderAssets.createSpireCrownMesh();

    column.position.set(0, 0.8, 0);
    crown.position.set(0, 1.9, 0);
    spireGroup.position.set(anchor.worldPosition.x, anchor.worldPosition.y, anchor.worldPosition.z);
    spireGroup.add(column);
    spireGroup.add(crown);

    return spireGroup;
  }
}
