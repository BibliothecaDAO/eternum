import { getCurrentPlayRouteBootToken, usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getEntitiesFromTorii, getExplorerTroopsFromToriiExact, getMapFromToriiExact } from "@/dojo/queries";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { resolvePlayRouteWorldPosition } from "@/play/navigation/play-route-target";
import { navigateToStructure } from "@/three/utils/navigation";
import { ChestModal, HelpModal } from "@/ui/features/military";
import { QuickAttackPreview } from "@/ui/features/military/battle/quick-attack-preview";
import { SpireTravelModal } from "@/ui/features/world/components/actions/spire-travel-modal";
import { FAST_TRAVEL_SCENE_READY_EVENT } from "@/ui/layouts/game-loading-overlay.utils";
import { FELT_CENTER } from "@/ui/config";
import type { SetupResult } from "@bibliothecadao/dojo";
import {
  ActionPath,
  ActionPaths,
  ActionType,
  ArmyActionManager,
  getBlockTimestamp,
  getExplorerInfoFromTileOccupier,
  getTileAt,
  isTileOccupierChest,
  isTileOccupierStructure,
  Position,
} from "@bibliothecadao/eternum";
import {
  ActorType,
  BiomeIdToType,
  BiomeType,
  ContractAddress,
  HexEntityInfo,
  HexPosition,
  ID,
  TileOccupier,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { PathRenderer } from "../managers/path-renderer";
import { SelectedHexManager } from "../managers/selected-hex-manager";
import { SelectionPulseManager } from "../managers/selection-pulse-manager";
import { createElement } from "react";
import { toast } from "sonner";
import { Color, type Fog, type FogExp2, Group, Mesh, Raycaster, type Texture, Vector2, Vector3 } from "three";
import type { MapControls } from "three/examples/jsm/controls/MapControls.js";

import type { SceneManager } from "../scene-manager";
import { SceneName } from "../types";
import { getWorldPositionForHex, isAddressEqualToAccount } from "../utils";
import {
  hydrateFastTravelChunkState,
  type FastTravelArmyHydrationInput,
  type FastTravelChunkHydrationResult,
  type FastTravelEntityId,
  type FastTravelHexCoords,
  type FastTravelSpireHydrationInput,
} from "./fast-travel-hydration";
import { buildFastTravelEntityAnchors, type FastTravelEntityAnchor } from "./fast-travel-entity-anchors";
import { prepareFastTravelRenderState, type FastTravelRenderState } from "./fast-travel-rendering";
import {
  FAST_TRAVEL_CHUNK_POLICY,
  resolveFastTravelChunkHydrationPlan,
  resolveFastTravelVisibleChunkDecision,
  type FastTravelChunkHydrationPlan,
} from "./fast-travel-chunk-loading-runtime";
import { createFastTravelRenderAssets, type FastTravelRenderAssets } from "./fast-travel-render-assets";
import { resetFastTravelRuntimeState } from "./fast-travel-runtime-lifecycle";
import { resolveSpireTraversalAction, resolveSpireTraversalDestinationHex } from "./worldmap-spire-travel-policy";
import { WarpTravel, type WarpTravelLifecycleAdapter } from "./warp-travel";

interface FastTravelLayerState {
  armies: FastTravelArmyHydrationInput[];
  spires: FastTravelSpireHydrationInput[];
  exploredTiles: Map<number, Map<number, BiomeType>>;
  armyHexes: Map<number, Map<number, HexEntityInfo>>;
  structureHexes: Map<number, Map<number, HexEntityInfo>>;
  chestHexes: Map<number, Map<number, HexEntityInfo>>;
}

function resolveFastTravelTileBiomeType(biomeId: number): BiomeType {
  const biome = BiomeIdToType[biomeId];
  return biome === BiomeType.None ? BiomeType.Grassland : biome || BiomeType.Grassland;
}

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
  private fastTravelExploredTiles: Map<number, Map<number, BiomeType>> = new Map();
  private fastTravelArmyHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  private fastTravelStructureHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  private fastTravelChestHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  private selectedArmyActionPaths: Map<string, ActionPath[]> = new Map();
  private selectedArmyEntityId: ID | null = null;
  private previewTargetHexKey: string | null = null;
  private currentChunk: string = "null";
  private chunkRefreshTimeout: number | null = null;
  private pendingChunkRefreshForce = false;
  private hasCompletedSwitchOffCleanup = false;
  private hasDisposedFastTravelOwnedResources = false;
  private savedBackground: Color | Texture | null = null;
  private savedFog: Fog | FogExp2 | null = null;
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
      onInitialSetupComplete: () => this.announceFastTravelSceneReady(),
      onResumeComplete: () => this.announceFastTravelSceneReady(),
      reportSetupError: (error, phase) => this.reportFastTravelRefreshError(error, phase),
      disposeStoreSubscriptions: () => this.disposeFastTravelStoreSubscriptions(),
      detachLabelGroupsFromScene: () => this.detachFastTravelLabelGroupsFromScene(),
      detachManagerLabels: () => this.detachFastTravelManagerLabels(),
    };
  }

  private announceFastTravelSceneReady(): void {
    usePlayRouteReadinessStore.getState().markFastTravelReady(getCurrentPlayRouteBootToken());

    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(new Event(FAST_TRAVEL_SCENE_READY_EVENT));
  }

  private configureFastTravelSetupStart(): void {
    this.hasCompletedSwitchOffCleanup = false;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.interactiveHexManager.setSurfaceVisibility(false);
    this.interactiveHexManager.setHoverVisualMode("outline");
    this.savedBackground = this.scene.background;
    this.savedFog = this.scene.fog;
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
      this.clearFastTravelSelection();
      return;
    }

    const clickedArmy = this.currentEntityAnchors.find(
      (anchor) =>
        anchor.kind === "army" && anchor.hexCoords.col === hexCoords.col && anchor.hexCoords.row === hexCoords.row,
    );

    if (clickedArmy) {
      this.selectFastTravelArmy(clickedArmy);
      return;
    }

    const clickedSpire = this.currentEntityAnchors.find(
      (anchor) =>
        anchor.kind === "spire" && anchor.hexCoords.col === hexCoords.col && anchor.hexCoords.row === hexCoords.row,
    );

    if (clickedSpire) {
      this.selectedHexManager.setPosition(clickedSpire.worldPosition.x, clickedSpire.worldPosition.z);
      return;
    }

    if (!this.selectedArmyEntityId) {
      return;
    }

    this.commitFastTravelMovement(hexCoords);
  }

  protected onHexagonRightClick(_event: MouseEvent, hexCoords: FastTravelHexCoords | null): void {
    this.clearFastTravelSelection();
  }

  public moveCameraToURLLocation(): void {
    const routeWorldPosition = resolvePlayRouteWorldPosition(window.location);
    if (!routeWorldPosition) {
      return;
    }

    const { col, row } = routeWorldPosition;
    this.moveCameraToColRow(col, row, 0);
  }

  public onSwitchOff(_nextSceneName?: SceneName): void {
    if (this.hasCompletedSwitchOffCleanup) {
      return;
    }

    this.runWarpTravelSwitchOffLifecycle();
    this.resetFastTravelRuntimeState();
    this.restoreSavedSceneEnvironment();
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

    const chunkPlan = resolveFastTravelChunkHydrationPlan({
      startCol: chunkDecision.startCol,
      startRow: chunkDecision.startRow,
    });

    await this.syncFastTravelLayerChunk(chunkPlan);
    this.applyFastTravelVisibleChunk(chunkDecision.chunkKey, chunkDecision.startCol, chunkDecision.startRow);
    return true;
  }

  private applyFastTravelVisibleChunk(chunkKey: string, startCol: number, startRow: number): void {
    const chunkPlan = resolveFastTravelChunkHydrationPlan({
      startCol,
      startRow,
    });
    const layerState = this.resolveFastTravelLayerState(chunkPlan);

    this.currentHydratedChunk = hydrateFastTravelChunkState({
      chunkKey: chunkPlan.chunkKey,
      startCol: chunkPlan.startCol,
      startRow: chunkPlan.startRow,
      width: chunkPlan.width,
      height: chunkPlan.height,
      armies: layerState.armies,
      spires: layerState.spires,
    });

    this.sceneArmies = layerState.armies;
    this.sceneSpires = layerState.spires;
    this.fastTravelExploredTiles = layerState.exploredTiles;
    this.fastTravelArmyHexes = layerState.armyHexes;
    this.fastTravelStructureHexes = layerState.structureHexes;
    this.fastTravelChestHexes = layerState.chestHexes;

    this.currentRenderState = prepareFastTravelRenderState({
      visibleHexWindow: this.currentHydratedChunk.visibleHexWindow,
    });
    this.currentChunk = chunkKey;
    this.syncFastTravelSceneVisuals();
  }

  private async syncFastTravelLayerChunk(chunkPlan: FastTravelChunkHydrationPlan): Promise<void> {
    const minCol = chunkPlan.startCol + FELT_CENTER();
    const maxCol = chunkPlan.startCol + chunkPlan.width - 1 + FELT_CENTER();
    const minRow = chunkPlan.startRow + FELT_CENTER();
    const maxRow = chunkPlan.startRow + chunkPlan.height - 1 + FELT_CENTER();

    await Promise.all([
      getMapFromToriiExact(
        this.dojo.network.toriiClient,
        this.dojo.network.contractComponents as unknown as Parameters<typeof getMapFromToriiExact>[1],
        minCol,
        maxCol,
        minRow,
        maxRow,
        true,
      ),
      getExplorerTroopsFromToriiExact(
        this.dojo.network.toriiClient,
        this.dojo.network.contractComponents as unknown as Parameters<typeof getExplorerTroopsFromToriiExact>[1],
        minCol,
        maxCol,
        minRow,
        maxRow,
        true,
      ),
    ]);

    await this.syncFastTravelArmyOwnerStructures(chunkPlan);
  }

  private async syncFastTravelArmyOwnerStructures(chunkPlan: FastTravelChunkHydrationPlan): Promise<void> {
    const ownerStructureIds = this.collectVisibleFastTravelArmyOwnerStructureIds(chunkPlan);
    const visibleStructureIds = this.collectVisibleFastTravelStructureIds(chunkPlan);
    const structureIdsToHydrate = new Set<ID>([...ownerStructureIds, ...visibleStructureIds]);

    if (structureIdsToHydrate.size === 0) {
      return;
    }

    await getEntitiesFromTorii(
      this.dojo.network.toriiClient,
      this.dojo.network.contractComponents as unknown as Parameters<typeof getEntitiesFromTorii>[1],
      [...structureIdsToHydrate],
      ["s1_eternum-Structure"],
    );
  }

  private collectVisibleFastTravelArmyOwnerStructureIds(chunkPlan: FastTravelChunkHydrationPlan): ID[] {
    const ownerStructureIds = new Set<ID>();

    this.iterateChunkWindow(chunkPlan, (normalizedHex) => {
      const contractHex = this.toContractHex(normalizedHex);
      const tile = getTileAt(this.dojo.components, true, contractHex.col, contractHex.row);
      if (!tile || !this.isExplorerOccupier(tile.occupier_type)) {
        return;
      }

      const explorerTroops = this.getExplorerTroops(tile.occupier_id);
      const ownerStructureId = Number(explorerTroops?.owner ?? 0);
      if (Number.isFinite(ownerStructureId) && ownerStructureId > 0) {
        ownerStructureIds.add(ownerStructureId);
      }
    });

    return [...ownerStructureIds];
  }

  private collectVisibleFastTravelStructureIds(chunkPlan: FastTravelChunkHydrationPlan): ID[] {
    const structureIds = new Set<ID>();

    this.iterateChunkWindow(chunkPlan, (normalizedHex) => {
      const contractHex = this.toContractHex(normalizedHex);
      const tile = getTileAt(this.dojo.components, true, contractHex.col, contractHex.row);
      if (!tile || (!tile.occupier_is_structure && !isTileOccupierStructure(tile.occupier_type as TileOccupier))) {
        return;
      }

      if (Number(tile.occupier_id) > 0) {
        structureIds.add(tile.occupier_id);
      }
    });

    return [...structureIds];
  }

  private resolveFastTravelLayerState(chunkPlan: FastTravelChunkHydrationPlan): FastTravelLayerState {
    const layerState: FastTravelLayerState = {
      armies: [],
      spires: [],
      exploredTiles: new Map(),
      armyHexes: new Map(),
      structureHexes: new Map(),
      chestHexes: new Map(),
    };

    this.iterateChunkWindow(chunkPlan, (normalizedHex) => {
      const contractHex = this.toContractHex(normalizedHex);
      const tile = getTileAt(this.dojo.components, true, contractHex.col, contractHex.row);
      if (!tile || Number(tile.biome) === 0) {
        return;
      }

      this.setNestedMapValue(
        layerState.exploredTiles,
        normalizedHex.col,
        normalizedHex.row,
        resolveFastTravelTileBiomeType(tile.biome),
      );
      this.applyFastTravelOccupierState(layerState, normalizedHex, tile);
    });

    return layerState;
  }

  private applyFastTravelOccupierState(
    layerState: FastTravelLayerState,
    normalizedHex: FastTravelHexCoords,
    tile: NonNullable<ReturnType<typeof getTileAt>>,
  ): void {
    if (Number(tile.occupier_id) === 0 || tile.occupier_type === TileOccupier.None) {
      return;
    }

    if (tile.occupier_type === TileOccupier.Spire) {
      layerState.spires.push({
        entityId: tile.occupier_id,
        label: `Spire #${tile.occupier_id}`,
        worldHexCoords: normalizedHex,
        travelHexCoords: normalizedHex,
      });
      return;
    }

    if (this.isExplorerOccupier(tile.occupier_type)) {
      const owner = this.resolveArmyOwnerAddress(tile.occupier_id);
      this.setNestedMapValue(layerState.armyHexes, normalizedHex.col, normalizedHex.row, {
        id: tile.occupier_id,
        owner,
      });
      layerState.armies.push({
        entityId: tile.occupier_id,
        hexCoords: normalizedHex,
        ownerName: `Army #${tile.occupier_id}`,
      });
      return;
    }

    if (isTileOccupierChest(tile.occupier_type as TileOccupier)) {
      this.setNestedMapValue(layerState.chestHexes, normalizedHex.col, normalizedHex.row, {
        id: tile.occupier_id,
        owner: 0n,
      });
      return;
    }

    if (tile.occupier_is_structure || isTileOccupierStructure(tile.occupier_type as TileOccupier)) {
      this.setNestedMapValue(layerState.structureHexes, normalizedHex.col, normalizedHex.row, {
        id: tile.occupier_id,
        owner: this.resolveStructureOwnerAddress(tile.occupier_id),
      });
    }
  }

  private iterateChunkWindow(
    chunkPlan: FastTravelChunkHydrationPlan,
    visitHex: (hexCoords: FastTravelHexCoords) => void,
  ): void {
    for (let row = chunkPlan.startRow; row < chunkPlan.startRow + chunkPlan.height; row += 1) {
      for (let col = chunkPlan.startCol; col < chunkPlan.startCol + chunkPlan.width; col += 1) {
        visitHex({ col, row });
      }
    }
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
    if (this.selectedArmyEntityId !== null) {
      this.refreshSelectedArmyActionPaths(this.selectedArmyEntityId);
    }
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

  private previewFastTravelMovement(targetHexCoords: FastTravelHexCoords): void {
    const actionPath = this.resolveFastTravelActionPath(targetHexCoords);
    if (!actionPath) {
      this.clearFastTravelMovementPreview();
      return;
    }

    const targetHexKey = `${targetHexCoords.col},${targetHexCoords.row}`;
    if (this.previewTargetHexKey === targetHexKey) {
      return;
    }

    this.previewTargetHexKey = targetHexKey;
    this.pathRenderer.createPath(
      this.resolvePathEntityId(this.selectedArmyEntityId),
      this.resolveFastTravelWorldPath(actionPath, 0.18),
      new Color(this.currentRenderState?.surface.palette.edgeColor ?? "#ff4fd8"),
      "hover",
    );
  }

  private commitFastTravelMovement(targetHexCoords: FastTravelHexCoords): void {
    if (!this.selectedArmyEntityId) {
      return;
    }

    const actionPath = this.resolveFastTravelActionPath(targetHexCoords);
    if (!actionPath) {
      this.clearFastTravelSelection();
      return;
    }

    const pathEntityId = this.resolvePathEntityId(this.selectedArmyEntityId);
    this.pathRenderer.createPath(
      pathEntityId,
      this.resolveFastTravelWorldPath(actionPath, 0.18),
      new Color(this.currentRenderState?.surface.palette.accentColor ?? "#ffd6f7"),
      "selected",
    );
    this.pathRenderer.setSelectedPath(pathEntityId);
    this.previewTargetHexKey = null;

    const targetPoint = this.resolveFastTravelWorldPath(actionPath, 0).at(-1);
    if (!targetPoint) {
      return;
    }

    this.selectedHexManager.setPosition(targetPoint.x, targetPoint.z);
    this.selectionPulseManager.hideSelection();

    const actionType = ActionPaths.getActionType(actionPath);
    if (actionType === ActionType.Attack) {
      this.openFastTravelAttackPreview(actionPath, this.selectedArmyEntityId);
      return;
    }

    if (actionType === ActionType.Help) {
      this.openFastTravelHelp(actionPath, this.selectedArmyEntityId);
      return;
    }

    if (actionType === ActionType.Chest) {
      this.openFastTravelChest(actionPath, this.selectedArmyEntityId);
      return;
    }

    if (actionType === ActionType.SpireTravel) {
      this.openFastTravelSpireTravel(actionPath, this.selectedArmyEntityId);
      return;
    }

    this.commitFastTravelArmyAction(actionPath, this.selectedArmyEntityId);
  }

  private clearFastTravelMovementPreview(): void {
    if (!this.selectedArmyEntityId) {
      this.previewTargetHexKey = null;
      return;
    }

    this.pathRenderer.removePath(this.resolvePathEntityId(this.selectedArmyEntityId));
    this.previewTargetHexKey = null;
  }

  private resolveFastTravelActionPath(targetHexCoords: FastTravelHexCoords): ActionPath[] | null {
    if (!this.selectedArmyEntityId) {
      return null;
    }

    const contractHex = this.toContractHex(targetHexCoords);
    return this.selectedArmyActionPaths.get(ActionPaths.posKey(contractHex)) ?? null;
  }

  private resolveFastTravelWorldPath(actionPath: ActionPath[], yOffset: number): Vector3[] {
    return actionPath.map((step) => {
      const normalizedHex = this.toNormalizedHex(step.hex);
      const point = getWorldPositionForHex(normalizedHex);
      return new Vector3(point.x, point.y + yOffset, point.z);
    });
  }

  private selectFastTravelArmy(anchor: FastTravelEntityAnchor): void {
    const selectedArmyId = this.resolveNumericEntityId(anchor.entityId);
    if (selectedArmyId === null) {
      return;
    }

    const armyOwner = this.resolveArmyOwnerAddress(selectedArmyId);
    if (!isAddressEqualToAccount(armyOwner)) {
      return;
    }

    this.clearFastTravelMovementPreview();
    this.selectedArmyEntityId = selectedArmyId;
    this.previewTargetHexKey = null;
    this.syncSelectedArmyFeedback();
    this.refreshSelectedArmyActionPaths(selectedArmyId);

    const selectedArmy = this.sceneArmies.find((army) => this.resolveNumericEntityId(army.entityId) === selectedArmyId);
    if (selectedArmy) {
      const selectedHex = this.toContractHex(selectedArmy.hexCoords);
      useUIStore.getState().setSelectedHex({ col: selectedHex.col, row: selectedHex.row });
    }
  }

  private refreshSelectedArmyActionPaths(selectedArmyId: ID): void {
    const account = useAccountStore.getState().account;
    if (!account) {
      this.selectedArmyActionPaths.clear();
      this.highlightHexManager.highlightHexes([]);
      return;
    }

    try {
      const armyActionManager = new ArmyActionManager(
        this.dojo.components,
        this.dojo.systemCalls,
        selectedArmyId,
        "ethereal",
      );
      const { currentDefaultTick, currentArmiesTick } = getBlockTimestamp();
      const playerAddress = ContractAddress(account.address);
      const selectedArmy = this.sceneArmies.find(
        (army) => this.resolveNumericEntityId(army.entityId) === selectedArmyId,
      );
      const startPositionOverride = selectedArmy ? this.toContractHex(selectedArmy.hexCoords) : undefined;
      const actionPaths = armyActionManager.findActionPaths(
        this.fastTravelStructureHexes,
        this.fastTravelArmyHexes,
        this.fastTravelExploredTiles,
        this.fastTravelChestHexes,
        currentDefaultTick,
        currentArmiesTick,
        playerAddress,
        startPositionOverride,
      );

      this.selectedArmyActionPaths = actionPaths.getPaths();
      this.highlightHexManager.highlightHexes(actionPaths.getHighlightDescriptors());
    } catch (error) {
      console.warn("[FastTravelScene] Failed to resolve ethereal army action paths", error);
      this.selectedArmyActionPaths.clear();
      this.highlightHexManager.highlightHexes([]);
    }
  }

  private openFastTravelAttackPreview(actionPath: ActionPath[], selectedArmyId: ID): void {
    const selectedPath = actionPath.map((path) => path.hex);
    const selectedHex = selectedPath[0];
    const targetHex = selectedPath[selectedPath.length - 1];
    const targetTile = getTileAt(this.dojo.components, true, targetHex.col, targetHex.row);

    if (!selectedHex || !targetHex || !targetTile) {
      return;
    }

    useUIStore.getState().setSelectedHex({ col: selectedHex.col, row: selectedHex.row });
    const targetActorType = targetTile.occupier_is_structure
      ? ActorType.Structure
      : isTileOccupierStructure(targetTile.occupier_type as TileOccupier)
        ? ActorType.Structure
        : ActorType.Explorer;

    this.state.toggleModal(
      createElement(QuickAttackPreview, {
        attacker: {
          type: ActorType.Explorer,
          id: selectedArmyId,
          hex: new Position({ x: selectedHex.col, y: selectedHex.row }).getContract(),
          alt: true,
        },
        target: {
          type: targetActorType,
          id: targetTile.occupier_id,
          hex: new Position({ x: targetHex.col, y: targetHex.row }).getContract(),
          alt: true,
        },
      }),
    );
  }

  private openFastTravelHelp(actionPath: ActionPath[], selectedArmyId: ID): void {
    const selectedPath = actionPath.map((path) => path.hex);
    const selectedHex = selectedPath[0];
    const targetHex = selectedPath[selectedPath.length - 1];
    const targetTile = targetHex ? getTileAt(this.dojo.components, true, targetHex.col, targetHex.row) : undefined;

    if (!selectedHex || !targetHex || !targetTile) {
      return;
    }

    useUIStore.getState().setSelectedHex({ col: selectedHex.col, row: selectedHex.row });
    const targetActorType =
      targetTile.occupier_is_structure || isTileOccupierStructure(targetTile.occupier_type as TileOccupier)
        ? ActorType.Structure
        : ActorType.Explorer;

    this.state.toggleModal(
      createElement(HelpModal, {
        selected: {
          type: ActorType.Explorer,
          id: selectedArmyId,
          hex: new Position({ x: selectedHex.col, y: selectedHex.row }).getContract(),
        },
        target: {
          type: targetActorType,
          id: targetTile.occupier_id,
          hex: new Position({ x: targetHex.col, y: targetHex.row }).getContract(),
        },
        allowBothDirections: true,
      }),
    );
  }

  private openFastTravelChest(actionPath: ActionPath[], selectedArmyId: ID): void {
    const selectedPath = actionPath.map((path) => path.hex);
    const selectedHex = selectedPath[0];
    const targetHex = selectedPath[selectedPath.length - 1];

    if (!selectedHex || !targetHex) {
      return;
    }

    useUIStore.getState().setSelectedHex({ col: selectedHex.col, row: selectedHex.row });
    this.state.toggleModal(
      createElement(ChestModal, {
        selected: {
          type: ActorType.Explorer,
          id: selectedArmyId,
          hex: { x: selectedHex.col, y: selectedHex.row },
        },
        chestHex: { x: targetHex.col, y: targetHex.row },
        chestAlt: true,
      }),
    );
  }

  private openFastTravelSpireTravel(
    actionPath: ActionPath[],
    selectedArmyId: ID,
    options: { hasSyncedPairedWorldTile?: boolean } = {},
  ): void {
    const selectedPath = actionPath.map((path) => path.hex);
    const selectedHex = selectedPath[0];
    const targetHex = selectedPath[selectedPath.length - 1];
    const destinationHex = resolveSpireTraversalDestinationHex(actionPath);
    if (!selectedHex || !targetHex || !destinationHex) {
      return;
    }

    useUIStore.getState().setSelectedHex({ col: selectedHex.col, row: selectedHex.row });
    const pairedWorldTile = getTileAt(this.dojo.components, false, destinationHex.col, destinationHex.row);
    if (this.shouldSyncPairedWorldSpireTraversalTile(pairedWorldTile) && !options.hasSyncedPairedWorldTile) {
      void this.syncPairedWorldSpireTile(destinationHex)
        .then(() =>
          this.openFastTravelSpireTravel(actionPath, selectedArmyId, {
            hasSyncedPairedWorldTile: true,
          }),
        )
        .catch((error) => {
          console.warn("[FastTravelScene] Failed to sync paired world Spire tile", error);
          toast.error("Unable to verify the linked world tile right now.");
        });
      return;
    }

    if (!pairedWorldTile) {
      toast.error("Unable to verify the linked world tile right now.");
      return;
    }

    const traversalAction = resolveSpireTraversalAction({
      targetHex: destinationHex,
      etherealTile: pairedWorldTile,
      isOpposingArmy: (targetArmyId) => this.canAttackSpireTraversalArmy(selectedArmyId, targetArmyId),
    });

    if (traversalAction.kind === "attack") {
      this.state.toggleModal(
        createElement(QuickAttackPreview, {
          attacker: {
            type: ActorType.Explorer,
            id: selectedArmyId,
            hex: new Position({ x: selectedHex.col, y: selectedHex.row }).getContract(),
            alt: true,
          },
          target: {
            type: ActorType.Explorer,
            id: traversalAction.targetArmyId,
            hex: new Position({ x: traversalAction.targetHex.col, y: traversalAction.targetHex.row }).getContract(),
            directionHex: { x: targetHex.col, y: targetHex.row },
            alt: false,
          },
        }),
      );
      return;
    }

    if (traversalAction.kind === "blocked") {
      toast.error("Another allied army already occupies the linked world tile.");
      return;
    }

    this.state.toggleModal(
      createElement(SpireTravelModal, {
        onTravelThroughSpire: () =>
          this.commitFastTravelArmyAction(actionPath, selectedArmyId, {
            destinationHex,
            navigateToLayer: "world",
          }),
      }),
    );
  }

  private shouldSyncPairedWorldSpireTraversalTile(pairedWorldTile: ReturnType<typeof getTileAt> | undefined): boolean {
    if (!pairedWorldTile) {
      return true;
    }

    if (
      pairedWorldTile.occupier_is_structure ||
      Number(pairedWorldTile.occupier_id) === 0 ||
      !this.isExplorerOccupier(pairedWorldTile.occupier_type)
    ) {
      return false;
    }

    const ownerAddress = this.resolveArmyOwnerAddress(pairedWorldTile.occupier_id);
    return ownerAddress === 0n;
  }

  private async syncPairedWorldSpireTile(targetHex: HexPosition): Promise<void> {
    await Promise.all([
      getMapFromToriiExact(
        this.dojo.network.toriiClient,
        this.dojo.network.contractComponents as unknown as Parameters<typeof getMapFromToriiExact>[1],
        targetHex.col,
        targetHex.col,
        targetHex.row,
        targetHex.row,
        false,
      ),
      getExplorerTroopsFromToriiExact(
        this.dojo.network.toriiClient,
        this.dojo.network.contractComponents as unknown as Parameters<typeof getExplorerTroopsFromToriiExact>[1],
        targetHex.col,
        targetHex.col,
        targetHex.row,
        targetHex.row,
        false,
      ),
    ]);

    const pairedWorldTile = getTileAt(this.dojo.components, false, targetHex.col, targetHex.row);
    if (!pairedWorldTile || !this.isExplorerOccupier(pairedWorldTile.occupier_type)) {
      return;
    }

    const explorerTroops = this.getExplorerTroops(pairedWorldTile.occupier_id);
    const ownerStructureId = Number(explorerTroops?.owner ?? 0);
    if (!Number.isFinite(ownerStructureId) || ownerStructureId <= 0) {
      return;
    }

    await getEntitiesFromTorii(
      this.dojo.network.toriiClient,
      this.dojo.network.contractComponents as unknown as Parameters<typeof getEntitiesFromTorii>[1],
      [ownerStructureId],
      ["s1_eternum-Structure"],
    );
  }

  private commitFastTravelArmyAction(
    actionPath: ActionPath[],
    selectedArmyId: ID,
    options: { destinationHex?: HexPosition; navigateToLayer?: "world" } = {},
  ): void {
    const account = useAccountStore.getState().account;
    if (!account) {
      return;
    }

    const actionType = ActionPaths.getActionType(actionPath);
    const isTravelAction = actionType === ActionType.Move || actionType === ActionType.SpireTravel;
    const currentArmiesTick = getBlockTimestamp().currentArmiesTick;
    const armyActionManager = new ArmyActionManager(this.dojo.components, this.dojo.systemCalls, selectedArmyId, true);
    const targetHex = actionPath[actionPath.length - 1]?.hex;
    const destinationHex = options.destinationHex ?? targetHex;

    armyActionManager
      .moveArmy(account, actionPath, isTravelAction, currentArmiesTick)
      .then(() => {
        if (options.navigateToLayer === "world" && destinationHex) {
          navigateToStructure(destinationHex.col, destinationHex.row, "map");
          return;
        }

        this.requestSceneRefresh();
      })
      .catch((error) => {
        console.error("[FastTravelScene] Army action failed:", error);
      });

    this.clearFastTravelSelection();
  }

  private syncSelectedArmyFeedback(): void {
    if (!this.selectedArmyEntityId) {
      this.selectionPulseManager.hideSelection();
      return;
    }

    const selectedArmy = this.currentEntityAnchors.find(
      (anchor) => anchor.kind === "army" && this.resolveNumericEntityId(anchor.entityId) === this.selectedArmyEntityId,
    );
    if (!selectedArmy) {
      this.selectionPulseManager.hideSelection();
      return;
    }

    this.selectedHexManager.setPosition(selectedArmy.worldPosition.x, selectedArmy.worldPosition.z);
    this.selectionPulseManager.hideSelection();
  }

  private clearFastTravelSelection(): void {
    this.clearFastTravelMovementPreview();
    this.selectedArmyEntityId = null;
    this.selectedArmyActionPaths.clear();
    this.selectedHexManager.resetPosition();
    useUIStore.getState().setSelectedHex(null);
    this.selectionPulseManager.hideSelection();
    this.highlightHexManager.highlightHexes([]);
    this.pathRenderer.setSelectedPath(null);
  }

  private resolvePathEntityId(entityId: FastTravelEntityId | null): number {
    if (typeof entityId === "number") {
      return entityId;
    }

    if (entityId === null) {
      return 0;
    }

    return entityId.split("").reduce((hash, character) => hash * 31 + character.charCodeAt(0), 17);
  }

  private isOpposingArmy(selectedArmyId: ID, targetArmyId: ID): boolean {
    const selectedOwner = this.resolveArmyOwnerAddress(selectedArmyId);
    const targetOwner = this.resolveArmyOwnerAddress(targetArmyId);

    return selectedOwner !== 0n && targetOwner !== 0n && selectedOwner !== targetOwner;
  }

  private canAttackSpireTraversalArmy(selectedArmyId: ID, targetArmyId: ID): boolean {
    const selectedOwner = this.resolveArmyOwnerAddress(selectedArmyId);
    const targetOwner = this.resolveArmyOwnerAddress(targetArmyId);

    return selectedOwner === 0n || targetOwner === 0n || this.isOpposingArmy(selectedArmyId, targetArmyId);
  }

  private resolveArmyOwnerAddress(armyId: ID): ContractAddress {
    const explorerTroops = this.getExplorerTroops(armyId);
    const ownerStructureId = Number(explorerTroops?.owner ?? 0);
    if (!Number.isFinite(ownerStructureId) || ownerStructureId <= 0) {
      return 0n;
    }

    return this.resolveStructureOwnerAddress(ownerStructureId);
  }

  private resolveStructureOwnerAddress(structureId: ID): ContractAddress {
    const structure = getComponentValue(this.dojo.components.Structure, getEntityIdFromKeys([BigInt(structureId)]));
    return structure?.owner ? BigInt(structure.owner) : 0n;
  }

  private getExplorerTroops(armyId: ID): { owner?: number } | undefined {
    return getComponentValue(this.dojo.components.ExplorerTroops, getEntityIdFromKeys([BigInt(armyId)])) as
      | { owner?: number }
      | undefined;
  }

  private isExplorerOccupier(occupierType: number): boolean {
    return getExplorerInfoFromTileOccupier(occupierType) !== undefined;
  }

  private toContractHex(hexCoords: FastTravelHexCoords): HexPosition {
    const contractPosition = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
    return {
      col: contractPosition.x,
      row: contractPosition.y,
    };
  }

  private toNormalizedHex(hexCoords: HexPosition): FastTravelHexCoords {
    const normalizedPosition = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();
    return {
      col: normalizedPosition.x,
      row: normalizedPosition.y,
    };
  }

  private resolveNumericEntityId(entityId: FastTravelEntityId): ID | null {
    const numericId = typeof entityId === "number" ? entityId : Number(entityId);
    return Number.isFinite(numericId) ? numericId : null;
  }

  private setNestedMapValue<T>(target: Map<number, Map<number, T>>, col: number, row: number, value: T): void {
    const rowMap = target.get(col) ?? new Map<number, T>();
    rowMap.set(row, value);
    target.set(col, rowMap);
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
    this.fastTravelExploredTiles = new Map();
    this.fastTravelArmyHexes = new Map();
    this.fastTravelStructureHexes = new Map();
    this.fastTravelChestHexes = new Map();
    this.selectedArmyActionPaths.clear();
    this.selectedArmyEntityId = null;
    this.previewTargetHexKey = nextState.previewTargetHexKey;
    this.currentChunk = nextState.currentChunk;
    this.chunkRefreshTimeout = nextState.chunkRefreshTimeout;
    this.pendingChunkRefreshForce = nextState.pendingChunkRefreshForce;
  }

  private restoreSavedSceneEnvironment(): void {
    if (this.savedBackground !== null) {
      this.scene.background = this.savedBackground;
      this.savedBackground = null;
    }
    if (this.savedFog !== null) {
      this.scene.fog = this.savedFog;
      this.savedFog = null;
    }
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
