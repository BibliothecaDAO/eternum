import type { SetupResult } from "@bibliothecadao/dojo";
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  SphereGeometry,
  Vector2,
} from "three";
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
import { prepareFastTravelRenderState, type FastTravelRenderState } from "./fast-travel-rendering";
import { WarpTravel, type WarpTravelLifecycleAdapter } from "./warp-travel";

const FAST_TRAVEL_CHUNK_RADIUS = 4;

export default class FastTravelScene extends WarpTravel {
  private readonly travelLabelGroup = new Group();
  private readonly travelContentGroup = new Group();
  private currentHydratedChunk: FastTravelChunkHydrationResult | null = null;
  private currentRenderState: FastTravelRenderState | null = null;

  constructor(
    dojoContext: SetupResult,
    raycaster: Raycaster,
    controls: MapControls,
    mouse: Vector2,
    sceneManager: SceneManager,
  ) {
    super(SceneName.FastTravel, controls, dojoContext, mouse, raycaster, sceneManager);
    this.travelLabelGroup.name = "FastTravelLabelsGroup";
    this.travelContentGroup.name = "FastTravelContentGroup";
    this.scene.add(this.travelContentGroup);
  }

  protected shouldCreateGroundMesh(): boolean {
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
  }

  private prepareFastTravelInitialSetup(): void {
    this.travelLabelGroup.clear();
    this.clearTravelContentMeshes();
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
      armies: this.buildDemoArmies(focusHex),
      spires: this.buildDemoSpires(focusHex),
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

  protected onHexagonMouseMove(): void {}

  protected onHexagonDoubleClick(): void {}

  protected onHexagonClick(): void {}

  protected onHexagonRightClick(): void {}

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
    this.clearTravelContentMeshes();
    super.destroy();
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
    this.clearTravelContentMeshes();

    if (!this.currentHydratedChunk || !this.currentRenderState) {
      return;
    }

    this.scene.background = new Color(this.currentRenderState.shader.uniforms.baseColor);

    this.currentHydratedChunk.spireAnchors.forEach((spire) => {
      const spireMesh = this.createSpireAnchorMesh(spire.travelHexCoords);
      this.travelContentGroup.add(spireMesh);
    });

    this.currentHydratedChunk.armies.forEach((army) => {
      const armyMesh = this.createArmyMarkerMesh(army.hexCoords);
      this.travelContentGroup.add(armyMesh);
    });
  }

  private clearTravelContentMeshes(): void {
    this.travelContentGroup.children.slice().forEach((child) => {
      this.travelContentGroup.remove(child);
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

  private createArmyMarkerMesh(hexCoords: FastTravelHexCoords): Mesh {
    const { x, y, z } = getWorldPositionForHex(hexCoords);
    const material = new MeshStandardMaterial({
      color: this.currentRenderState?.shader.uniforms.accentColor ?? "#ffd6f7",
      emissive: this.currentRenderState?.shader.uniforms.glowColor ?? "#ff92ea",
      emissiveIntensity: 0.8,
    });
    const mesh = new Mesh(new SphereGeometry(0.35, 18, 18), material);
    mesh.position.set(x, y + 0.55, z);
    return mesh;
  }

  private createSpireAnchorMesh(hexCoords: FastTravelHexCoords): Group {
    const { x, y, z } = getWorldPositionForHex(hexCoords);
    const spireGroup = new Group();
    const column = new Mesh(
      new CylinderGeometry(0.18, 0.28, 1.6, 6),
      new MeshStandardMaterial({
        color: this.currentRenderState?.shader.uniforms.baseColor ?? "#ff4fd8",
        emissive: this.currentRenderState?.shader.uniforms.glowColor ?? "#ff92ea",
        emissiveIntensity: 1.2,
      }),
    );
    const crown = new Mesh(
      new ConeGeometry(0.42, 0.8, 6),
      new MeshStandardMaterial({
        color: this.currentRenderState?.shader.uniforms.accentColor ?? "#ffd6f7",
        emissive: this.currentRenderState?.shader.uniforms.accentColor ?? "#ffd6f7",
        emissiveIntensity: 1.3,
      }),
    );

    column.position.set(0, 0.8, 0);
    crown.position.set(0, 1.9, 0);
    spireGroup.position.set(x, y, z);
    spireGroup.add(column);
    spireGroup.add(crown);

    return spireGroup;
  }
}
