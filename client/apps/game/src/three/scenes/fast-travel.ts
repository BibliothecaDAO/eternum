import type { SetupResult } from "@bibliothecadao/dojo";
import { PathRenderer } from "../managers/path-renderer";
import { SelectedHexManager } from "../managers/selected-hex-manager";
import { SelectionPulseManager } from "../managers/selection-pulse-manager";
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  ShapeGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import type { MapControls } from "three/examples/jsm/controls/MapControls.js";

import { HEX_SIZE } from "../constants";
import { createHexagonShape } from "../geometry/hexagon-geometry";
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
import {
  buildFastTravelEntityAnchors,
  type FastTravelEntityAnchor,
} from "./fast-travel-entity-anchors";
import {
  resolveFastTravelMovement,
  type FastTravelMovementResolution,
} from "./fast-travel-movement-policy";
import { prepareFastTravelRenderState, type FastTravelRenderState } from "./fast-travel-rendering";
import { WarpTravel, type WarpTravelLifecycleAdapter } from "./warp-travel";

const FAST_TRAVEL_CHUNK_RADIUS = 4;

export default class FastTravelScene extends WarpTravel {
  private readonly travelLabelGroup = new Group();
  private readonly travelSurfaceGroup = new Group();
  private readonly travelContentGroup = new Group();
  private readonly selectedHexManager: SelectedHexManager;
  private readonly selectionPulseManager: SelectionPulseManager;
  private readonly pathRenderer: PathRenderer;
  private currentHydratedChunk: FastTravelChunkHydrationResult | null = null;
  private currentRenderState: FastTravelRenderState | null = null;
  private currentEntityAnchors: FastTravelEntityAnchor[] = [];
  private sceneArmies: FastTravelArmyHydrationInput[] = [];
  private sceneSpires: FastTravelSpireHydrationInput[] = [];
  private selectedArmyEntityId: string | null = null;
  private previewTargetHexKey: string | null = null;

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
    this.pathRenderer = PathRenderer.getInstance();
    this.pathRenderer.initialize(this.scene);
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

  private setupFastTravelCameraZoomHandler(): void {}

  private async refreshFastTravelScene(): Promise<void> {
    if (this.isSwitchedOff) {
      return;
    }

    const focusHex = this.resolveFastTravelFocusHex();
    const startCol = focusHex.col - FAST_TRAVEL_CHUNK_RADIUS;
    const startRow = focusHex.row - FAST_TRAVEL_CHUNK_RADIUS;

    this.currentHydratedChunk = hydrateFastTravelChunkState({
      chunkKey: `${startCol},${startRow}`,
      startCol,
      startRow,
      width: FAST_TRAVEL_CHUNK_RADIUS * 2 + 1,
      height: FAST_TRAVEL_CHUNK_RADIUS * 2 + 1,
      armies: this.resolveSceneArmies(focusHex),
      spires: this.resolveSceneSpires(focusHex),
    });

    this.currentRenderState = prepareFastTravelRenderState({
      visibleHexWindow: this.currentHydratedChunk.visibleHexWindow,
    });

    this.syncFastTravelSceneVisuals();
  }

  private reportFastTravelRefreshError(error: unknown, phase: "initial" | "resume"): void {
    const message =
      phase === "initial"
        ? "[FastTravelScene] Failed to refresh initial scene state"
        : "[FastTravelScene] Failed to refresh resumed scene state";
    console.error(message, error);
  }

  private disposeFastTravelStoreSubscriptions(): void {}

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

  public onSwitchOff(): void {
    this.runWarpTravelSwitchOffLifecycle();
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

    void this.refreshFastTravelScene();
  }

  public destroy(): void {
    this.clearTravelVisualGroups();
    this.clearFastTravelMovementPreview();
    this.selectionPulseManager.dispose();
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

  private syncFastTravelSceneVisuals(): void {
    this.clearTravelVisualGroups();
    this.currentEntityAnchors = [];

    if (!this.currentHydratedChunk || !this.currentRenderState) {
      return;
    }

    this.scene.background = new Color(this.currentRenderState.surface.palette.backgroundColor);
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
    this.interactiveHexManager.updateVisibleHexes(
      centerRow,
      centerCol,
      field.bounds.size.cols,
      field.bounds.size.rows,
    );
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

  private clearTravelVisualGroups(): void {
    this.disposeGroupChildren(this.travelSurfaceGroup);
    this.disposeGroupChildren(this.travelContentGroup);
  }

  private disposeGroupChildren(group: Group): void {
    group.children.slice().forEach((child) => {
      group.remove(child);
      if (child instanceof Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      } else {
        child.traverse((node) => {
          if (node instanceof Mesh) {
            node.geometry.dispose();
            if (Array.isArray(node.material)) {
              node.material.forEach((material) => material.dispose());
            } else {
              node.material.dispose();
            }
          }
        });
      }
    });
  }

  private createFastTravelHexMesh(hexCoords: FastTravelHexCoords): Group {
    const palette = this.currentRenderState?.surface.palette;
    const hexShape = createHexagonShape(HEX_SIZE * 0.96);
    const fillGeometry = new ShapeGeometry(hexShape);

    const edgeGeometry = new EdgesGeometry(fillGeometry);
    const edgeMaterial = new LineBasicMaterial({
      color: palette?.edgeColor ?? "#ff4fd8",
      opacity: palette?.edgeOpacity ?? 0.92,
      transparent: true,
    });
    const edgeMesh = new LineSegments(edgeGeometry, edgeMaterial);
    edgeMesh.rotation.x = -Math.PI / 2;
    edgeMesh.position.y = 0.03;
    edgeMesh.renderOrder = 3;

    const { x, y, z } = getWorldPositionForHex(hexCoords);
    const group = new Group();
    group.position.set(x, y, z);
    group.add(edgeMesh);
    return group;
  }

  private createArmyMarkerMesh(anchor: FastTravelEntityAnchor): Mesh {
    const material = new MeshStandardMaterial({
      color: this.currentRenderState?.surface.palette.accentColor ?? "#ffd6f7",
      emissive: this.currentRenderState?.surface.palette.glowColor ?? "#ff92ea",
      emissiveIntensity: 0.8,
    });
    const mesh = new Mesh(new SphereGeometry(0.35, 18, 18), material);
    mesh.position.set(anchor.worldPosition.x, anchor.worldPosition.y + 0.55, anchor.worldPosition.z);
    return mesh;
  }

  private createSpireAnchorMesh(anchor: FastTravelEntityAnchor): Group {
    const spireGroup = new Group();
    const column = new Mesh(
      new CylinderGeometry(0.18, 0.28, 1.6, 6),
      new MeshStandardMaterial({
        color: this.currentRenderState?.surface.palette.edgeColor ?? "#ff4fd8",
        emissive: this.currentRenderState?.surface.palette.glowColor ?? "#ff92ea",
        emissiveIntensity: 1.2,
      }),
    );
    const crown = new Mesh(
      new ConeGeometry(0.42, 0.8, 6),
      new MeshStandardMaterial({
        color: this.currentRenderState?.surface.palette.accentColor ?? "#ffd6f7",
        emissive: this.currentRenderState?.surface.palette.accentColor ?? "#ffd6f7",
        emissiveIntensity: 1.3,
      }),
    );

    column.position.set(0, 0.8, 0);
    crown.position.set(0, 1.9, 0);
    spireGroup.position.set(anchor.worldPosition.x, anchor.worldPosition.y, anchor.worldPosition.z);
    spireGroup.add(column);
    spireGroup.add(crown);

    return spireGroup;
  }
}
