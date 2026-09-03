import { AudioManager } from "@/audio/core/AudioManager";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { getCurrentPlayRouteBootToken, usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { VERBOSE_LOGS_ENABLED } from "@/utils/dev-mode";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { resolveStoredLocalCameraDistance, useCameraZoomStore } from "@/hooks/store/use-camera-zoom-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { isVillageLikeStructureCategory } from "@/lib/structure-type-utils";
import { resolvePlayRouteTarget } from "@/play/navigation/play-route-target";
import { getGameModeConfig } from "@/config/game-modes";
import type { GameModeConfig } from "@/config/game-modes";
import {
  BUILDINGS_CATEGORIES_TYPES,
  BUILDINGS_GROUPS,
  HEX_SIZE,
  LOCAL_CAMERA_ZOOM,
  MinesMaterialsParams,
  WONDER_REALM,
  castleLevelToRealmCastle,
  hyperstructureStageToModel,
  structureTypeToBuildingType,
} from "@/three/constants";
import {
  BuildingPreview,
  applyPendingBuildingMaterials,
  disposeClonedBuildingMaterials,
} from "@/three/managers/building-preview";
import { SMALL_DETAILS_NAME } from "@/three/managers/instanced-model";
import { SceneManager } from "@/three/scene-manager";
import { HexagonScene } from "@/three/scenes/hexagon-scene";
import { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import type { TerrainSurface } from "@/three/terrain/terrain-surface";
import type { TerrainCellInput, TerrainSettlementAnchor } from "@/three/terrain/terrain-types";
import {
  buildingKey,
  reconcileBuildingUpdate,
  resolveBuildingInstanceAction,
  runOwnedBuildingWorkAfterModelsLoad,
  type TargetedBuildingReconciliation,
} from "@/three/scenes/hexception-building-reconciliation";
import { playBuildingSound } from "@/three/sound/utils";
import { MatrixPool } from "@/three/utils/matrix-pool";
import {
  navigateToStructure,
  toggleMapHexView,
  selectNextStructure as utilSelectNextStructure,
} from "@/three/utils/navigation";
import { SceneShortcutManager } from "@/three/utils/shortcuts";
import { runWithFrameWorkOwner } from "@/three/frame-work-owner";
import { createPausedLabel, gltfLoader } from "@/three/utils/utils";
import { LeftView } from "@/types";
import {
  BuildingSystemUpdate,
  NEUTRAL_BIOME_CLIMATE,
  StructureProgress,
  getBlockTimestamp,
} from "@bibliothecadao/eternum";

import { HexceptionAmbienceSystem } from "@/three/systems/hexception-ambience-system";
import { IS_FLAT_MODE } from "@/ui/config";

import { ProductionModal } from "@/ui/features/settlement";
import { resolveConstructionBuildability } from "@/ui/features/settlement/construction/construction-buildability";
import { SetupResult } from "@bibliothecadao/dojo";
import {
  ActionType,
  ResourceIdToMiningType,
  ResourceManager,
  TileManager,
  configManager,
  divideByPrecision,
  getBalance,
  getBuildingCosts,
  getRealmInfo,
  getStructureStage,
} from "@bibliothecadao/eternum";
import {
  BUILDINGS_CENTER,
  BiomeType,
  BuildingType,
  BuildingTypeToString,
  HexPosition,
  RealmLevels,
  ResourceMiningTypes,
  ResourcesIds,
  Structure,
  StructureType,
  findResourceById,
  getNeighborHexes,
  getProducedResource,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import gsap from "gsap";
import { toast } from "@/ui/features/event-feed/notify";
import {
  AnimationClip,
  AnimationMixer,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { MapControls } from "three/addons/controls/MapControls.js";
import { SceneName } from "../types";
import { getHexForWorldPosition, getWorldPositionForHex } from "../utils";
import { HexHoverLabel } from "../utils/labels/hex-hover-label";
import { gameEntityKey, buildingEntityKey } from "@/sync/game-scope";

const loader = gltfLoader;
const BUILDING_RENDER_SIGNATURE = "eternumBuildingRenderSignature";

interface HexceptionBuilding {
  category: BUILDINGS_CATEGORIES_TYPES;
  col: number;
  matrix: Matrix4;
  paused: boolean;
  pending?: boolean;
  resource?: ResourcesIds;
  row: number;
  structureType?: StructureType | null;
}

interface BuildingModelSelection {
  group: BUILDINGS_GROUPS;
  type: BUILDINGS_CATEGORIES_TYPES;
}

const generateHexPositions = (center: HexPosition, radius: number) => {
  const color = new Color("gray");
  const positions: any[] = [];
  const positionSet = new Set(); // To track existing positions

  // Helper function to add position if not already added
  const addPosition = (col: number, row: number, isBorder: boolean) => {
    const key = `${col},${row}`;
    if (!positionSet.has(key)) {
      const position = {
        ...getWorldPositionForHex({ col, row }, false),
        color,
        col,
        row,
        isBorder,
      };
      positions.push(position);
      positionSet.add(key);
    }
  };

  // Add center position
  addPosition(center.col, center.row, false);

  // Generate positions in expanding hexagonal layers
  let currentLayer = [center];
  for (let i = 0; i < radius; i++) {
    const nextLayer: any = [];
    currentLayer.forEach((pos) => {
      getNeighborHexes(pos.col, pos.row).forEach((neighbor) => {
        if (!positionSet.has(`${neighbor.col},${neighbor.row}`)) {
          addPosition(neighbor.col, neighbor.row, i === radius - 1);
          nextLayer.push({ col: neighbor.col, row: neighbor.row });
        }
      });
    });
    currentLayer = nextLayer; // Move to the next layer
  }

  return positions;
};

export default class HexceptionScene extends HexagonScene {
  private hexceptionRadius = 4;
  private buildingModels: Map<
    BUILDINGS_GROUPS,
    Map<BUILDINGS_CATEGORIES_TYPES, { model: Group; animations: AnimationClip[] }>
  > = new Map();
  private buildingInstances: Map<string, Group> = new Map();
  private pendingBuildingKeys: Set<string> = new Set();
  private wonderInstances: Map<string, Group> = new Map();
  private buildingMixers: Map<string, AnimationMixer> = new Map();
  private buildings: HexceptionBuilding[] = [];
  centerColRow: number[] = [0, 0];
  private highlights: { col: number; row: number }[] = [];
  private buildingPreview: BuildingPreview | null = null;
  private tileManager: TileManager;
  private labels: {
    col: number;
    row: number;
    label: CSS2DObject;
  }[] = [];
  private hoverLabelManager: HexHoverLabel;
  private structureStage: RealmLevels | StructureProgress = RealmLevels.Settlement;
  private minesMaterials: Map<number, MeshStandardMaterial> = new Map();
  private structureIndex: number = 0;
  private playerStructures: Structure[] = [];
  private mode: GameModeConfig;
  private ambienceSystem: HexceptionAmbienceSystem | null = null;
  private readonly proceduralTerrain: ProceduralTerrain;
  private structureUpdateSubscription: any | null = null;
  private buildingUpdateUnsubscribe: (() => void) | null = null;
  private isInitialized = false;
  private lastRealmKey?: string;
  private activeRealmGeneration = 0;
  // Store Zustand unsubscribe functions to clean up on destroy
  private storeUnsubscribes: (() => void)[] = [];
  // True from setup until switch-off. Store subscriptions fire in every scene, so a grid rebuild (and the
  // hex-ready mark it ends with) only counts while this scene is the one being entered or shown.
  private isEntered = false;
  private readonly localZoomPersistDebounceMs = 500;
  private localZoomPersistTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly handleLocalZoomControlsChange = () => {
    if (this.sceneManager.getCurrentScene() !== SceneName.Hexception) return;
    // Programmatic camera transitions (scene entry, camera-view resets) must
    // not overwrite the player's chosen zoom; only interactive zooms persist.
    if (this.isCameraTransitionInProgress()) return;
    this.scheduleLocalZoomPersist();
  };

  constructor(
    controls: MapControls,
    dojo: SetupResult,
    mouse: Vector2,
    raycaster: Raycaster,
    sceneManager: SceneManager,
  ) {
    super(SceneName.Hexception, controls, dojo, mouse, raycaster, sceneManager);

    this.proceduralTerrain = new ProceduralTerrain();
    this.scene.add(this.proceduralTerrain.object3d);
    void this.proceduralTerrain.loadProps().catch((error) => {
      console.warn("[Hexception] Optional procedural terrain props failed to load", error);
    });
    void this.proceduralTerrain.loadGroundTextures().catch((error) => {
      console.warn("[Hexception] Procedural ground textures failed; retaining flat terrain", error);
    });
    this.mode = getGameModeConfig();
    this.hoverLabelManager = new HexHoverLabel(this.scene);
    this.interactiveHexManager.setSurfaceVisibility(false);

    this.ambienceSystem = new HexceptionAmbienceSystem(this.scene);

    this.loadBuildingModels();

    this.tileManager = new TileManager(this.dojo.components, this.dojo.systemCalls, { col: 0, row: 0 });

    this.inputManager.addListener("contextmenu", (raycaster) => {
      this.clearBuildingMode();
    });

    this.state = useUIStore.getState();

    this.shortcutManager = new SceneShortcutManager("hexception", this.sceneManager);

    // Only register shortcuts if they haven't been registered already
    if (!this.shortcutManager.hasShortcuts()) {
      const shouldCycleRealmsForTab = () => useUIStore.getState().leftNavigationView === LeftView.MilitaryView;
      const getRealmStructuresForTab = () =>
        this.playerStructures.filter((structure) => structure.category === StructureType.Realm);

      this.shortcutManager.registerShortcut({
        id: "cycle-structures",
        key: "Tab",
        description: "Cycle through structures",
        sceneRestriction: SceneName.Hexception,
        condition: () => {
          if (shouldCycleRealmsForTab()) {
            return getRealmStructuresForTab().length > 0;
          }
          return this.playerStructures.length > 0;
        },
        action: () => {
          if (shouldCycleRealmsForTab()) {
            this.selectNextRealmStructure();
            return;
          }
          this.selectNextStructure();
        },
      });

      this.shortcutManager.registerShortcut({
        id: "toggle-view",
        key: "v",
        description: "Toggle between world and local view",
        sceneRestriction: SceneName.Hexception,
        action: () => toggleMapHexView(),
      });

      this.shortcutManager.registerShortcut({
        id: "escape-handler",
        key: "Escape",
        description: "Return to world view from local view",
        sceneRestriction: SceneName.Hexception,
        action: () => {
          if (this.isNavigationViewOpen()) {
            this.closeNavigationViews();
          } else {
            this.clearBuildingMode();
          }
        },
      });
    }

    if (this.GUIFolder) {
      this.GUIFolder.add(this, "structureStage", 0, 3).onFinishChange((value: RealmLevels) => {
        this.structureStage = value;
        this.removeCastleFromScene();
        this.updateHexceptionGrid(this.hexceptionRadius);
      });
    }

    // Store all Zustand subscriptions for cleanup on destroy
    this.storeUnsubscribes.push(
      useUIStore.subscribe(
        (state) => state.playerStructures,
        (playerStructures) => {
          this.updatePlayerStructures(playerStructures);
        },
      ),
    );

    this.storeUnsubscribes.push(
      useUIStore.subscribe(
        (state) => state.previewBuilding,
        (building) => {
          if (building) {
            this.interactiveHexManager.setAuraVisibility(false);
            this.getOrCreateBuildingPreview().setPreviewBuilding(building as any);
            this.renderBuildingPlacementHighlights();
          } else {
            this.interactiveHexManager.setAuraVisibility(true);
            this.clearBuildingMode();
          }
        },
      ),
    );

    this.storeUnsubscribes.push(
      useUIStore.subscribe(
        (state) => state.useSimpleCost,
        (useSimpleCost) => {
          this.state.useSimpleCost = useSimpleCost;
        },
      ),
    );

    // Subscribe to structureEntityId changes
    this.storeUnsubscribes.push(
      useUIStore.subscribe(
        (state) => state.structureEntityId,
        (structureEntityId) => {
          // Clean up previous subscription if it exists
          if (this.structureUpdateSubscription) {
            this.structureUpdateSubscription.unsubscribe();
            this.structureUpdateSubscription = null;
          }

          // Only create a new subscription if we have a valid entity ID
          if (structureEntityId && structureEntityId !== 0) {
            if (VERBOSE_LOGS_ENABLED) console.log(`Setting up Structure listener for entity ID: ${structureEntityId}`);

            this.structureUpdateSubscription = this.worldUpdateListener.StructureEntityListener.onLevelUpdate(
              structureEntityId,
              (update) => {
                this.structureStage = update.level as RealmLevels;
                this.removeCastleFromScene();
                this.updateHexceptionGrid(this.hexceptionRadius);
              },
            );
          }
        },
      ),
    );

    // Re-render the hex grid when the loading overlay dismisses.
    // Buildings may not be in RECS when the scene first sets up;
    // once showBlankOverlay becomes false, structures are synced.
    this.storeUnsubscribes.push(
      useUIStore.subscribe(
        (state) => state.showBlankOverlay,
        (showBlankOverlay) => {
          if (!showBlankOverlay) {
            this.removeCastleFromScene();
            this.updateHexceptionGrid(this.hexceptionRadius);
          }
        },
      ),
    );

    // Persist the player's interactive zoom once it settles (debounced).
    this.controls.addEventListener("change", this.handleLocalZoomControlsChange);

    // Apply zoom-preference changes coming from the settings UI while this scene is active.
    this.storeUnsubscribes.push(
      useCameraZoomStore.subscribe(
        (state) => state.localDistance,
        () => this.applyLocalZoomPreferenceLive(),
      ),
    );
  }

  public override getTerrainSurface(): TerrainSurface {
    return this.proceduralTerrain;
  }

  private alignLocalCameraToPreferredZoom(): void {
    this.cameraAngle = LOCAL_CAMERA_ZOOM.pitchRadians;
    this.animateCameraToLocalZoomDistance(this.resolvePreferredLocalZoomDistance());
  }

  private applyLocalZoomPreferenceLive(): void {
    if (this.sceneManager.getCurrentScene() !== SceneName.Hexception) {
      return;
    }

    const preferredDistance = this.resolvePreferredLocalZoomDistance();
    const currentDistance = this.controls.object.position.distanceTo(this.controls.target);
    if (Math.abs(preferredDistance - currentDistance) < 0.1) {
      return;
    }

    this.animateCameraToLocalZoomDistance(preferredDistance);
  }

  private resolvePreferredLocalZoomDistance(): number {
    const range = { min: this.controls.minDistance, max: this.controls.maxDistance };
    return resolveStoredLocalCameraDistance(range) ?? Math.min(LOCAL_CAMERA_ZOOM.defaultDistance, range.max);
  }

  private animateCameraToLocalZoomDistance(distance: number): void {
    const target = this.controls.target;
    const cameraHeight = Math.sin(this.cameraAngle) * distance;
    const cameraDepth = Math.cos(this.cameraAngle) * distance;
    const newPosition = new Vector3(target.x, target.y + cameraHeight, target.z + cameraDepth);
    this.cameraAnimate(newPosition, target.clone(), 0.6);
  }

  private scheduleLocalZoomPersist(): void {
    this.cancelPendingLocalZoomPersist();
    this.localZoomPersistTimeout = setTimeout(() => {
      this.localZoomPersistTimeout = null;
      this.persistSettledLocalZoom();
    }, this.localZoomPersistDebounceMs);
  }

  private cancelPendingLocalZoomPersist(): void {
    if (this.localZoomPersistTimeout) {
      clearTimeout(this.localZoomPersistTimeout);
      this.localZoomPersistTimeout = null;
    }
  }

  private flushPendingLocalZoomPersist(): void {
    if (!this.localZoomPersistTimeout) {
      return;
    }

    this.cancelPendingLocalZoomPersist();
    this.persistSettledLocalZoom();
  }

  private persistSettledLocalZoom(): void {
    if (this.sceneManager.getCurrentScene() !== SceneName.Hexception) return;
    if (this.isCameraTransitionInProgress()) return;

    const distance = Math.round(this.controls.object.position.distanceTo(this.controls.target) * 100) / 100;
    const storedDistance = useCameraZoomStore.getState().localDistance;
    if (storedDistance !== null && Math.abs(storedDistance - distance) < 0.05) {
      return;
    }

    useCameraZoomStore.getState().setLocalDistance(distance);
  }

  private clearBuildingMode() {
    this.buildingPreview?.clearPreviewBuilding();
    this.highlightHexManager.highlightHexes([]);
    this.state.setPreviewBuilding(null);
  }

  private loadBuildingModels() {
    const modelLoadsByPath = new Map<string, Promise<{ model: Group; animations: AnimationClip[] }>>();
    for (const category of Object.values(BUILDINGS_GROUPS)) {
      const categoryPaths = this.mode.assets.buildingModelPaths[category];
      if (!this.buildingModels.has(category)) {
        this.buildingModels.set(category, new Map());
      }
      const categoryMap = this.buildingModels.get(category)!;

      for (const [building, path] of Object.entries(categoryPaths)) {
        let sourceLoad = modelLoadsByPath.get(path);
        if (!sourceLoad) {
          sourceLoad = this.loadBuildingModel(path, building);
          modelLoadsByPath.set(path, sourceLoad);
        }
        const loadPromise = sourceLoad.then((modelData) => {
          categoryMap.set(building as BUILDINGS_CATEGORIES_TYPES, modelData);
        });
        this.modelLoadPromises.push(loadPromise);
      }
    }
  }

  private loadBuildingModel(path: string, building: string): Promise<{ model: Group; animations: AnimationClip[] }> {
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        (gltf) => {
          const model = gltf.scene as Group;
          model.position.set(0, 0, 0);
          model.rotation.y = Math.PI;
          model.traverse((child) => {
            if (
              child instanceof Mesh &&
              !child.name.includes(SMALL_DETAILS_NAME) &&
              !child.parent?.name.includes(SMALL_DETAILS_NAME)
            ) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          resolve({ model, animations: gltf.animations });
        },
        undefined,
        (error) => {
          console.error(`Error loading ${building} model:`, error);
          reject(error);
        },
      );
    });
  }

  private getOrCreateBuildingPreview(): BuildingPreview {
    if (!this.buildingPreview) {
      this.buildingPreview = new BuildingPreview(this.scene, (group, building) => {
        const groupPaths = this.mode.assets.buildingModelPaths[group] as Record<string, string>;
        const path = groupPaths[building.toString()];
        if (!path) {
          return null;
        }

        return {
          cacheKey: path,
          load: async () => {
            await Promise.allSettled(this.modelLoadPromises);
            return (
              this.buildingModels.get(group)?.get(building.toString() as BUILDINGS_CATEGORIES_TYPES)?.model ?? null
            );
          },
        };
      });
    }

    return this.buildingPreview;
  }

  setup() {
    this.isEntered = true;
    this.bootstrapSceneOwnership();
    const routeTarget = resolvePlayRouteTarget(window.location, { fastTravelEnabled: true });
    const routeWorldPosition = routeTarget.routeWorldPosition;
    const contractPosition = routeTarget.hexRealmPosition;

    if (routeWorldPosition == null || contractPosition == null) {
      return;
    }

    const { col, row } = routeWorldPosition;
    const realmKey = `${contractPosition.col},${contractPosition.row}`;
    const realmChanged = !this.isInitialized || this.lastRealmKey !== realmKey;

    if (realmChanged) {
      this.labels.forEach((label) => {
        this.scene.remove(label.label);
      });
      this.labels = [];
    } else {
      this.labels.forEach((label) => {
        if (label.label.parent !== this.scene) {
          this.scene.add(label.label);
        }
      });
    }

    if (realmChanged) {
      const realmGeneration = this.advanceRealmGeneration();
      this.centerColRow = [contractPosition.col, contractPosition.row];
      this.tileManager.setTile({ col, row });

      // remove all previous building instances
      this.buildingInstances.forEach((instance, key) => {
        this.scene.remove(instance);
        if (this.pendingBuildingKeys.delete(key)) {
          disposeClonedBuildingMaterials(instance);
        }
      });
      this.buildingInstances.clear();

      // remove all previous wonder instances
      this.wonderInstances.forEach((instance) => {
        this.scene.remove(instance);
      });
      this.wonderInstances.clear();

      // clear all animation mixers
      this.buildingMixers.clear();

      // Unsubscribe previous building update listener before re-registering
      this.buildingUpdateUnsubscribe?.();

      // subscribe to building updates (create and destroy)
      this.buildingUpdateUnsubscribe = this.worldUpdateListener.Buildings.onBuildingUpdate(
        { col: this.centerColRow[0], row: this.centerColRow[1] },
        (update: BuildingSystemUpdate) => this.handleBuildingUpdate(update, realmGeneration),
      );

      this.removeCastleFromScene();
      this.updateHexceptionGrid(this.hexceptionRadius);
    }

    // Setup ambience system at grid center (origin for the main hex)
    this.ambienceSystem?.setup(new Vector3(0, 0, 0), this.hexceptionRadius);

    this.controls.maxDistance = LOCAL_CAMERA_ZOOM.maxDistance;
    this.controls.enablePan = false;
    this.controls.enableZoom = true;
    this.controls.zoomToCursor = false;

    this.moveCameraToURLLocation();
    this.alignLocalCameraToPreferredZoom();

    // Configure thunder bolts for hexception - focused storm effect
    this.getThunderBoltManager().setConfig({
      radius: 6, // Medium spread around the hex settlement
      count: 4, // Moderate number of bolts for hex view
      duration: 400, // Longer duration for better visibility in close view
      persistent: false, // Auto-fade for production use
      debug: false, // Disable logging for performance
    });

    // select center hex
    this.state.setSelectedBuildingHex({
      outerCol: col,
      outerRow: row,
      innerCol: BUILDINGS_CENTER[0],
      innerRow: BUILDINGS_CENTER[1],
    });

    this.isInitialized = true;
    this.lastRealmKey = realmKey;
  }

  onSwitchOff(_nextSceneName?: SceneName) {
    this.isEntered = false;
    // Capture a zoom still waiting on its debounce so quick scene switches keep it.
    this.flushPendingLocalZoomPersist();

    this.labels.forEach((label) => {
      this.scene.remove(label.label);
    });

    this.clearHoverLabel();

    // Note: Don't clean up shortcuts here - they should persist across scene switches
    // Shortcuts will be cleaned up when the scene is actually destroyed
  }

  destroy() {
    this.advanceRealmGeneration();
    this.clearHoverLabel();
    this.hoverLabelManager.dispose();

    this.controls.removeEventListener("change", this.handleLocalZoomControlsChange);
    this.cancelPendingLocalZoomPersist();

    // Clean up building update subscription
    this.buildingUpdateUnsubscribe?.();
    this.buildingUpdateUnsubscribe = null;

    // CRITICAL: Clean up all Zustand store subscriptions to prevent memory leaks
    this.storeUnsubscribes.forEach((unsubscribe) => unsubscribe());
    this.storeUnsubscribes = [];

    // Clean up structure update subscription
    if (this.structureUpdateSubscription) {
      this.structureUpdateSubscription.unsubscribe();
      this.structureUpdateSubscription = null;
    }

    // CRITICAL: Clean up animation mixers to prevent memory leaks
    this.buildingMixers.forEach((mixer, key) => {
      mixer.stopAllAction();
      mixer.uncacheRoot(mixer.getRoot());
    });
    this.buildingMixers.clear();

    // Clean up mines materials
    this.minesMaterials.forEach((material, resourceId) => {
      material.dispose();
    });
    this.minesMaterials.clear();

    // Clean up building instances
    this.buildingInstances.forEach((instance, key) => {
      if (this.pendingBuildingKeys.delete(key)) {
        disposeClonedBuildingMaterials(instance);
      }
    });
    this.buildingInstances.clear();
    this.wonderInstances.clear();

    // Dispose of loaded building models (geometries and materials)
    const disposedBuildingModels = new Set<Group>();
    this.buildingModels.forEach((categoryMap) => {
      categoryMap.forEach((data) => {
        if (disposedBuildingModels.has(data.model)) {
          return;
        }
        disposedBuildingModels.add(data.model);
        data.model.traverse((child: any) => {
          if (child.isMesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m: any) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      });
      categoryMap.clear();
    });
    this.buildingModels.clear();

    // OPTIMIZED: Release any matrices back to the pool

    if (this.buildingPreview) {
      this.buildingPreview.dispose();
    }

    // Dispose ambience system
    this.ambienceSystem?.dispose();
    this.ambienceSystem = null;
    this.proceduralTerrain.dispose();

    super.destroy();
  }

  protected async onHexagonClick(hexCoords: HexPosition | null): Promise<void> {
    if (hexCoords === null) return;

    const normalizedCoords = { col: hexCoords.col, row: hexCoords.row };
    const buildingType = this.buildingPreview?.getPreviewBuilding();

    // Check if account exists before allowing actions
    const account = useAccountStore.getState().account;
    if (buildingType) {
      const useSimpleCost = this.state.useSimpleCost;
      const structureEntityId = useUIStore.getState().structureEntityId;
      const realm = getRealmInfo(gameEntityKey([BigInt(structureEntityId)]), this.dojo.components);
      const buildability = resolveConstructionBuildability({
        entityId: structureEntityId,
        buildingType: buildingType.type,
        useSimpleCost,
        components: this.dojo.components,
        realm,
        mode: this.mode,
        targetSpot: normalizedCoords,
        tileManager: this.tileManager,
      });

      if (!buildability.canSubmit) {
        toast.error(buildability.reason ?? "Building cannot be submitted.");
        AudioManager.getInstance().play("ui.build_invalid");
        this.updateHexceptionGrid(this.hexceptionRadius);
        return;
      }

      if (!this.canAffordPreviewBuilding(structureEntityId, buildingType.type, useSimpleCost)) {
        toast.error("Insufficient resources to build here.");
        AudioManager.getInstance().play("ui.build_invalid");
        this.updateHexceptionGrid(this.hexceptionRadius);
        return;
      }

      this.clearBuildingMode();
      try {
        await this.tileManager.placeBuilding(
          account!,
          structureEntityId,
          buildingType.type,
          normalizedCoords,
          useSimpleCost,
        );
        AudioManager.getInstance().play("ui.build_place");
      } catch (error) {
        console.error("[Hexception] building placement failed; removing provisional building", error);
        this.removeBuilding(normalizedCoords.col, normalizedCoords.row);
        this.updateBuildingHighlight(normalizedCoords, false);
      }
    } else {
      // if not building mode
      const { col: outerCol, row: outerRow } = this.tileManager.getHexCoords();

      if (BUILDINGS_CENTER[0] === hexCoords.col && BUILDINGS_CENTER[1] === hexCoords.row) {
        const building = getComponentValue(
          this.dojo.components.Building,
          buildingEntityKey(outerCol, outerRow, hexCoords.col, hexCoords.row),
        );

        // AudioManager handles muted state internally
        playBuildingSound(building?.category as BuildingType);

        this.state.setSelectedBuildingHex({
          outerCol,
          outerRow,
          innerCol: hexCoords.col,
          innerRow: hexCoords.row,
        });
        this.state.setLeftNavigationView(LeftView.EntityView);
      } else if (this.tileManager.isHexOccupied(normalizedCoords)) {
        const building = getComponentValue(
          this.dojo.components.Building,
          buildingEntityKey(outerCol, outerRow, hexCoords.col, hexCoords.row),
        );

        // AudioManager handles muted state internally
        playBuildingSound(building?.category as BuildingType);

        this.state.setSelectedBuildingHex({
          outerCol,
          outerRow,
          innerCol: normalizedCoords.col,
          innerRow: normalizedCoords.row,
        });
        this.state.setLeftNavigationView(LeftView.EntityView);
      } else {
        this.state.setSelectedBuildingHex({
          outerCol,
          outerRow,
          innerCol: normalizedCoords.col,
          innerRow: normalizedCoords.row,
        });
        this.state.setLeftNavigationView(LeftView.ConstructionView);
      }
    }
  }

  private canAffordPreviewBuilding(
    structureEntityId: number,
    buildingType: BuildingType,
    useSimpleCost: boolean,
  ): boolean {
    const buildingCosts = getBuildingCosts(structureEntityId, this.dojo.components, buildingType, useSimpleCost);
    if (!buildingCosts?.length) {
      return false;
    }

    const { currentDefaultTick } = getBlockTimestamp();
    return buildingCosts.every((resourceCost) =>
      this.hasEnoughResourceForPreviewCost(structureEntityId, resourceCost, currentDefaultTick),
    );
  }

  private hasEnoughResourceForPreviewCost(
    structureEntityId: number,
    resourceCost: { resource: ResourcesIds; amount: number },
    currentDefaultTick: number,
  ): boolean {
    const balance = getBalance(structureEntityId, resourceCost.resource, currentDefaultTick, this.dojo.components);
    return divideByPrecision(balance.balance) >= resourceCost.amount;
  }

  protected onHexagonMouseMove(hex: { position: Vector3; hexCoords: HexPosition } | null): void {
    // Always clear the tooltip first to prevent it from persisting when other elements overlap
    useTooltipStore.getState().setTooltip(null);

    if (hex === null) {
      this.clearHoverLabel();
      return;
    }

    const { position, hexCoords } = hex;
    const normalizedCoords = { col: hexCoords.col, row: hexCoords.row };
    //check if it on main hex

    this.buildingPreview?.setBuildingPosition(position);

    if (
      this.tileManager.isHexOccupied(normalizedCoords) ||
      (normalizedCoords.col === BUILDINGS_CENTER[0] && normalizedCoords.row === BUILDINGS_CENTER[1])
    ) {
      this.buildingPreview?.setBuildingColor(new Color(0xff0000));
    } else {
      this.buildingPreview?.resetBuildingColor();
    }
    const building = this.tileManager.getBuilding(normalizedCoords) as
      | { category: BuildingType; structureType?: StructureType }
      | undefined;

    if (!building || building.category === BuildingType.None) {
      this.clearHoverLabel();
      return;
    }

    const buildingName = this.getBuildingDisplayName(building);
    const producedResource = getProducedResource(building.category as BuildingType);

    if (producedResource) {
      const productionManager = this.state.structureEntityId
        ? new ResourceManager(this.dojo.components, this.state.structureEntityId)
        : undefined;
      const productionEndsAt = productionManager?.getProductionEndsAt(producedResource as ResourcesIds);
      const currentTick = getBlockTimestamp().currentDefaultTick;
      const isActive =
        (productionEndsAt ?? 0) > currentTick || productionManager?.isFood(producedResource as ResourcesIds);
      const resourceInfo = findResourceById(producedResource as ResourcesIds);
      const resourceName = resourceInfo?.trait ?? "Unknown resource";

      this.hoverLabelManager.update(position, {
        kind: "resource",
        buildingName,
        resourceId: producedResource as ResourcesIds,
        resourceName,
        isActive: !!isActive,
      });
      return;
    }

    this.hoverLabelManager.update(position, {
      kind: "building",
      buildingName,
    });
  }

  private getBuildingDisplayName(building: { category: BuildingType; structureType?: StructureType }): string {
    const buildingType = building.category as BuildingType;

    if (buildingType === BuildingType.None) {
      return "Empty";
    }

    if (buildingType === BuildingType.ResourceAncientFragment) {
      return this.mode.labels.fragmentMine;
    }

    if (buildingType === BuildingType.ResourceLabor) {
      switch (building.structureType) {
        case StructureType.Realm: {
          const stage = this.structureStage as RealmLevels;
          const castleName = castleLevelToRealmCastle[stage];
          return castleName ?? "Castle";
        }
        case StructureType.Bank:
          return "Bank";
        case StructureType.Hyperstructure:
          return "Hyperstructure";
        case StructureType.Village:
        case StructureType.Camp:
          return this.mode.labels.village;
        default:
          return "Castle";
      }
    }

    const baseName = BuildingTypeToString[buildingType];
    if (!baseName) {
      return "Building";
    }

    if (baseName.endsWith(" Resource")) {
      return baseName.replace(" Resource", "");
    }

    return baseName;
  }

  private clearHoverLabel(): void {
    this.hoverLabelManager.clear();
  }
  protected onHexagonRightClick(event: MouseEvent, hexCoords: HexPosition | null): void {
    void event;
    void hexCoords;
  }
  protected onHexagonDoubleClick(hexCoords: HexPosition): void {
    if (!hexCoords) {
      return;
    }

    const buildingType = this.buildingPreview?.getPreviewBuilding();
    if (buildingType) {
      return;
    }

    const normalizedCoords = { col: hexCoords.col, row: hexCoords.row };
    const isCentralHex = normalizedCoords.col === BUILDINGS_CENTER[0] && normalizedCoords.row === BUILDINGS_CENTER[1];
    if (!this.tileManager.isHexOccupied(normalizedCoords) && !isCentralHex) {
      return;
    }

    const { col: outerCol, row: outerRow } = this.tileManager.getHexCoords();
    const structureEntityId = this.state.structureEntityId;
    if (!structureEntityId) {
      return;
    }

    const building = getComponentValue(
      this.dojo.components.Building,
      buildingEntityKey(outerCol, outerRow, normalizedCoords.col, normalizedCoords.row),
    );
    if (!building || building.category === BuildingType.None) {
      return;
    }

    this.state.setSelectedBuildingHex({
      outerCol,
      outerRow,
      innerCol: normalizedCoords.col,
      innerRow: normalizedCoords.row,
    });

    const producedResource = getProducedResource(building.category as BuildingType);
    usePopoverStore.getState().openSurface({
      id: "production",
      content: (
        <ProductionModal preSelectedResource={producedResource === ResourcesIds.Labor ? undefined : producedResource} />
      ),
    });
  }

  public moveCameraToURLLocation() {
    this.moveCameraToColRow(BUILDINGS_CENTER[0], BUILDINGS_CENTER[1], 0);
  }

  updateCastleLevel() {
    const structureType = this.tileManager.structureType();
    if (structureType === StructureType.Realm || structureType === StructureType.Village) {
      this.structureStage = this.tileManager.getRealmLevel(this.state.structureEntityId);
    } else if (structureType === StructureType.Hyperstructure) {
      this.structureStage = getStructureStage(
        structureType,
        useUIStore.getState().structureEntityId,
        this.dojo.components,
      );
    }
  }

  private handleBuildingUpdate(update: BuildingSystemUpdate, realmGeneration: number): void {
    if (!this.ownsRealmGeneration(realmGeneration)) return;

    if (update.buildingType !== BuildingType.None) {
      playBuildingSound(update.buildingType);
    }

    reconcileBuildingUpdate({
      applyFullFallback: () => this.updateHexceptionGrid(this.hexceptionRadius),
      applyTargeted: (reconciliation) => this.applyTargetedBuildingReconciliation(reconciliation, realmGeneration),
      buildings: this.buildings,
      reportMissingIdentity: () => {
        console.warn("[Hexception] Building update lacked inner coordinates; running full grid reconciliation.");
      },
      resolveBuilding: (position) => this.resolveBuildingFromRecs(position),
      update,
    });
  }

  private applyTargetedBuildingReconciliation(
    reconciliation: TargetedBuildingReconciliation<HexceptionBuilding>,
    realmGeneration: number,
  ): void {
    if (!this.ownsRealmGeneration(realmGeneration)) return;

    this.buildings = reconciliation.buildings;

    const key = buildingKey(reconciliation.position);
    void runOwnedBuildingWorkAfterModelsLoad({
      apply: () =>
        runWithFrameWorkOwner("scene:hexception:building", () => {
          const latestBuilding = this.buildings.find((building) => buildingKey(building) === key);
          this.updateBuildingHighlight(reconciliation.position, Boolean(latestBuilding));
          this.reconcileBuildingInstance(reconciliation.position, latestBuilding, this.tileManager.structureType());
        }),
      isOwned: () => this.ownsRealmGeneration(realmGeneration),
      modelLoadPromises: this.modelLoadPromises,
    });
  }

  private advanceRealmGeneration(): number {
    this.activeRealmGeneration += 1;
    return this.activeRealmGeneration;
  }

  private ownsRealmGeneration(realmGeneration: number): boolean {
    return realmGeneration === this.activeRealmGeneration;
  }

  private resolveBuildingFromRecs(position: HexPosition): HexceptionBuilding | undefined {
    const building = this.tileManager
      .existingBuildings()
      .find((candidate) => candidate.col === position.col && candidate.row === position.row);
    if (!building) return;

    return {
      ...building,
      category: building.category as BUILDINGS_CATEGORIES_TYPES,
      matrix: this.createBuildingMatrix(position),
    };
  }

  private createBuildingMatrix(position: HexPosition): Matrix4 {
    const building = new Object3D();
    const worldPosition = getWorldPositionForHex(position, false);
    building.position.set(worldPosition.x, 0.05, worldPosition.z);
    building.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
    building.rotation.y = (Math.floor(this.hashCoordinates(position.col, position.row) * 6) * Math.PI) / 3;
    building.updateMatrix();
    return building.matrix.clone();
  }

  private updateBuildingHighlight(position: HexPosition, occupied: boolean): void {
    const highlightIndex = this.highlights.findIndex(
      (highlight) => highlight.col === position.col && highlight.row === position.row,
    );
    if (occupied && highlightIndex >= 0) {
      this.highlights.splice(highlightIndex, 1);
    } else if (!occupied && highlightIndex < 0) {
      this.highlights.push(position);
    }

    if (this.buildingPreview?.getPreviewBuilding()) {
      this.renderBuildingPlacementHighlights();
    }
  }

  private renderBuildingPlacementHighlights(): void {
    this.highlightHexManager.highlightHexes(
      this.highlights.map((hex) => ({
        hex: { col: hex.col, row: hex.row },
        actionType: ActionType.Build,
        kind: "destination",
        isEndpoint: true,
        isSharedRoute: false,
        pathDepth: 1,
      })),
    );
  }

  updateHexceptionGrid(radius: number) {
    if (!this.isEntered) return;
    const realmGeneration = this.activeRealmGeneration;
    const dummy = new Object3D();
    const mainStructureType = this.tileManager.structureType();
    this.updateCastleLevel();

    const terrainMatricesByBiome: Record<BiomeType | "Empty" | string, Matrix4[]> = {
      None: [],
      Ocean: [],
      DeepOcean: [],
      Beach: [],
      Scorched: [],
      Bare: [],
      Tundra: [],
      Snow: [],
      TemperateDesert: [],
      Shrubland: [],
      ShrublandAlt: [],
      Taiga: [],
      Grassland: [],
      GrasslandAlt: [],
      TemperateDeciduousForest: [],
      TemperateDeciduousForestAlt: [],
      TemperateRainForest: [],
      SubtropicalDesert: [],
      TropicalSeasonalForest: [],
      TropicalRainForest: [],
      Empty: [],
    };

    // The whole grid build runs as one macrotask once models resolve; the
    // frame-owner marker is what attributes the local-view freeze to it.
    void runOwnedBuildingWorkAfterModelsLoad({
      apply: () =>
        runWithFrameWorkOwner("scene:hexception:grid", () => {
          const centers = [
            [0, 0], //0, 0 (Main hex)
            [-6, 5], //-1, 1
            [7, 4], //1, 0
            [1, 9], //0, 1
            [-7, -4], //-1, 0
            [0, -9], //0, -1
            [7, -5], //1, -1
          ];
          const neighbors = getNeighborHexes(this.centerColRow[0], this.centerColRow[1]);
          this.highlights = [];

          // compute matrices to update biome models for each of the large hexes
          for (const center in centers) {
            const isMainHex = centers[center][0] === 0 && centers[center][1] === 0;
            if (isMainHex) {
              this.computeMainHexMatrices(
                radius,
                dummy,
                centers[center],
                this.tileManager.getHexCoords(),
                terrainMatricesByBiome,
              );
            } else {
              this.computeNeighborHexMatrices(
                radius,
                dummy,
                centers[center],
                neighbors[Number(center) - 1],
                terrainMatricesByBiome,
              );
            }
          }

          this.presentProceduralTerrain(terrainMatricesByBiome);
          this.reconcileAllBuildingInstances(mainStructureType);
          this.interactiveHexManager.renderAllHexes();

          // CRITICAL: Release all matrices back to the pool to prevent memory leaks
          const matrixPool = MatrixPool.getInstance();
          let totalMatricesReleased = 0;
          for (const matrices of Object.values(terrainMatricesByBiome)) {
            matrixPool.releaseAll(matrices);
            totalMatricesReleased += matrices.length;
            // Clear the array to prevent accidental reuse of released matrices
            matrices.length = 0;
          }
          if (VERBOSE_LOGS_ENABLED) console.log(`🧹 Released ${totalMatricesReleased} matrices back to pool`);

          if (typeof window !== "undefined" && this.isEntered) {
            usePlayRouteReadinessStore.getState().markHexReady(getCurrentPlayRouteBootToken(), {
              col: this.centerColRow[0],
              row: this.centerColRow[1],
            });
          }
        }),
      isOwned: () => this.ownsRealmGeneration(realmGeneration),
      modelLoadPromises: this.modelLoadPromises,
    });
  }

  private presentProceduralTerrain(terrainMatricesByBiome: Record<BiomeType | "Empty" | string, Matrix4[]>): void {
    const fallbackBiome = configManager.getBiome(this.centerColRow[0], this.centerColRow[1]);
    const cellsByKey = new Map<string, TerrainCellInput>();
    const worldPosition = new Vector3();

    Object.entries(terrainMatricesByBiome).forEach(([biomeKey, matrices]) => {
      const biome = resolveHexceptionBiome(biomeKey, fallbackBiome);
      matrices.forEach((matrix) => {
        worldPosition.setFromMatrixPosition(matrix);
        const coordinate = getHexForWorldPosition(worldPosition);
        const key = `${coordinate.col}:${coordinate.row}`;
        cellsByKey.set(key, {
          biome,
          col: coordinate.col,
          explored: true,
          occupied: biomeKey === "Empty",
          previewBiome: biome,
          row: coordinate.row,
        });
      });
    });

    const prepared = this.proceduralTerrain.preparePage({
      cells: Array.from(cellsByKey.values()).toSorted((left, right) => left.row - right.row || left.col - right.col),
      climate: configManager.getBiomeClimateConfig() ?? NEUTRAL_BIOME_CLIMATE,
      halo: [],
      mapCenter: 0,
      pageKey: `hexception:${this.centerColRow[0]},${this.centerColRow[1]}`,
      roadSegments: [],
      settlementAnchors: createHexceptionSettlementAnchors(cellsByKey.values()),
      strictBiomeParity: false,
      subdivisions: 2,
    });
    this.proceduralTerrain.present([prepared]);
    this.buildings.forEach((building) => {
      worldPosition.setFromMatrixPosition(building.matrix);
      worldPosition.y = this.proceduralTerrain.sampleSurface(worldPosition.x, worldPosition.z).height;
      building.matrix.setPosition(worldPosition);
    });
  }

  private reconcileAllBuildingInstances(mainStructureType: StructureType | undefined): void {
    const nextKeys = new Set(this.buildings.map((building) => buildingKey(building)));
    const renderedKeys = new Set([
      ...this.buildingInstances.keys(),
      ...[...this.wonderInstances.keys()].map((key) => key.replace(/_wonder$/, "")),
    ]);
    renderedKeys.forEach((key) => {
      if (nextKeys.has(key)) return;
      const [col, row] = key.split(",").map(Number);
      this.reconcileBuildingInstance({ col, row }, undefined, mainStructureType);
    });

    this.buildings.forEach((building) => this.reconcileBuildingInstance(building, building, mainStructureType));
  }

  private reconcileBuildingInstance(
    position: HexPosition,
    building: HexceptionBuilding | undefined,
    mainStructureType: StructureType | undefined,
  ): void {
    const key = buildingKey(position);
    const selection = building ? this.resolveBuildingModelSelection(building, mainStructureType) : undefined;
    const signature = building && selection ? this.resolveBuildingRenderSignature(building, selection) : undefined;
    const currentInstance = this.buildingInstances.get(key);
    const currentSignature =
      currentInstance?.userData[BUILDING_RENDER_SIGNATURE] ??
      (this.wonderInstances.has(`${key}_wonder`) ? "wonder-only" : undefined);
    const action = resolveBuildingInstanceAction(currentSignature, signature);

    if (action === "remove" || action === "replace") {
      this.removeBuilding(position.col, position.row);
    }
    if (building && selection && signature !== undefined && (action === "create" || action === "replace")) {
      this.addBuildingInstance(building, selection, signature);
    }

    if (building) {
      this.reconcilePausedBuildingLabel(building);
    }
  }

  private resolveBuildingModelSelection(
    building: HexceptionBuilding,
    mainStructureType: StructureType | undefined,
  ): BuildingModelSelection {
    let group: BUILDINGS_GROUPS;
    let type: BUILDINGS_CATEGORIES_TYPES;

    if (building.resource && (building.resource < 23 || building.resource === ResourcesIds.AncientFragment)) {
      group = BUILDINGS_GROUPS.RESOURCES_MINING;
      type = ResourceIdToMiningType[building.resource] as ResourceMiningTypes;
    } else {
      group = BUILDINGS_GROUPS.BUILDINGS;
      type = building.category;
    }

    if (group === BUILDINGS_GROUPS.BUILDINGS && type === BuildingType.ResourceLabor) {
      group = BUILDINGS_GROUPS.REALMS;
      type = castleLevelToRealmCastle[this.structureStage];
    }

    const isCenterBuilding = building.col === BUILDINGS_CENTER[0] && building.row === BUILDINGS_CENTER[1];
    if (isCenterBuilding && isVillageLikeStructureCategory(mainStructureType)) {
      group = BUILDINGS_GROUPS.VILLAGE;
      type = mainStructureType as StructureType.Village | StructureType.Camp;
    }

    if (building.structureType === StructureType.Hyperstructure) {
      group = BUILDINGS_GROUPS.HYPERSTRUCTURE;
      type = hyperstructureStageToModel[this.structureStage as StructureProgress];
    }

    return { group, type };
  }

  private resolveBuildingRenderSignature(building: HexceptionBuilding, selection: BuildingModelSelection): string {
    return [selection.group, selection.type, building.resource ?? "none", building.pending ? "pending" : "ready"].join(
      ":",
    );
  }

  private addBuildingInstance(
    building: HexceptionBuilding,
    selection: BuildingModelSelection,
    signature: string,
  ): void {
    const key = buildingKey(building);
    this.addWonderInstance(building, key);

    const buildingData = this.buildingModels
      .get(selection.group)
      ?.get(selection.type.toString() as BUILDINGS_CATEGORIES_TYPES);
    if (!buildingData) return;

    const instance = buildingData.model.clone();
    instance.applyMatrix4(building.matrix);
    instance.scale.set(0.01, 0.01, 0.01);
    instance.userData[BUILDING_RENDER_SIGNATURE] = signature;
    this.applyMiningBuildingMaterial(instance, building, selection.type);

    if (building.pending) {
      applyPendingBuildingMaterials(instance);
      this.pendingBuildingKeys.add(key);
    }

    this.scene.add(instance);
    this.buildingInstances.set(key, instance);
    this.animateBuildingScale(instance);
    this.startBuildingAnimations(key, instance, buildingData.animations);
  }

  private addWonderInstance(building: HexceptionBuilding, key: string): void {
    const isCenterBuilding = building.col === BUILDINGS_CENTER[0] && building.row === BUILDINGS_CENTER[1];
    if (
      !isCenterBuilding ||
      building.structureType === StructureType.Hyperstructure ||
      !this.tileManager.getWonder(this.state.structureEntityId)
    ) {
      return;
    }

    const wonderData = this.buildingModels
      .get(BUILDINGS_GROUPS.WONDER)
      ?.get(WONDER_REALM.toString() as BUILDINGS_CATEGORIES_TYPES);
    if (!wonderData) return;

    const wonderKey = `${key}_wonder`;
    const wonderInstance = wonderData.model.clone();
    wonderInstance.applyMatrix4(building.matrix);
    wonderInstance.scale.set(0.01, 0.01, 0.01);
    this.scene.add(wonderInstance);
    this.wonderInstances.set(wonderKey, wonderInstance);
    this.animateBuildingScale(wonderInstance);
    this.startBuildingAnimations(wonderKey, wonderInstance, wonderData.animations);
  }

  private applyMiningBuildingMaterial(
    instance: Group,
    building: HexceptionBuilding,
    buildingType: BUILDINGS_CATEGORIES_TYPES,
  ): void {
    const resource = building.resource;
    if (resource === undefined) return;

    if (buildingType === ResourceMiningTypes.Forge) {
      instance.traverse((child) => {
        if (child.name === "Grassland003_1" && child instanceof Mesh) {
          child.material = this.getOrCreateMineMaterial(resource);
        }
      });
    }
    if (buildingType === ResourceMiningTypes.Mine) {
      instance.traverse((child) => {
        if (child instanceof Mesh && !Array.isArray(child.material) && child.material.name === "crystal") {
          child.material = this.getOrCreateMineMaterial(resource);
        }
      });
    }
  }

  private getOrCreateMineMaterial(resource: ResourcesIds): MeshStandardMaterial {
    let material = this.minesMaterials.get(resource);
    if (!material) {
      material = new MeshStandardMaterial(MinesMaterialsParams[resource]);
      this.minesMaterials.set(resource, material);
    }
    return material;
  }

  private animateBuildingScale(instance: Group): void {
    gsap.to(instance.scale, {
      duration: 0.5,
      x: 1,
      y: 1,
      z: 1,
      ease: "power2.out",
    });
  }

  private startBuildingAnimations(key: string, instance: Group, animations: AnimationClip[]): void {
    if (animations.length === 0) return;

    const mixer = new AnimationMixer(instance);
    animations.forEach((clip) => mixer.clipAction(clip).play());
    this.buildingMixers.set(key, mixer);
  }

  private reconcilePausedBuildingLabel(building: HexceptionBuilding): void {
    const hasPausedLabel = this.labels.some((label) => label.col === building.col && label.row === building.row);
    if (building.paused && !hasPausedLabel) {
      this.addPausedLabelToBuilding(building);
      return;
    }
    if (!building.paused) {
      this.removePausedLabelFromBuilding(building);
    }
  }

  addPausedLabelToBuilding(building: { col: number; row: number; matrix: any }) {
    const pausedDiv = createPausedLabel();
    const pausedLabel = new CSS2DObject(pausedDiv);
    pausedLabel.position.setFromMatrixPosition(building.matrix);
    pausedLabel.position.y += 1;
    this.scene.add(pausedLabel);
    this.labels.push({ col: building.col, row: building.row, label: pausedLabel });
  }

  removePausedLabelFromBuilding(building: { col: number; row: number }) {
    const index = this.labels.findIndex((label) => label.col === building.col && label.row === building.row);
    if (index >= 0) {
      this.scene.remove(this.labels[index].label);
      this.labels.splice(index, 1);
    }
  }

  removeCastleFromScene() {
    const key = `${BUILDINGS_CENTER[0]},${BUILDINGS_CENTER[1]}`;
    const instance = this.buildingInstances.get(key);
    if (instance) {
      this.scene.remove(instance);
      this.buildingInstances.delete(key);
    }

    // Also remove any associated wonder instance
    const wonderKey = `${key}_wonder`;
    const wonderInstance = this.wonderInstances.get(wonderKey);
    if (wonderInstance) {
      this.scene.remove(wonderInstance);
      this.wonderInstances.delete(wonderKey);
    }

    // Properly dispose of mixers before removing
    const mixer = this.buildingMixers.get(key);
    if (mixer) {
      mixer.stopAllAction();
      mixer.uncacheRoot(mixer.getRoot());
      this.buildingMixers.delete(key);
    }

    const wonderMixer = this.buildingMixers.get(wonderKey);
    if (wonderMixer) {
      wonderMixer.stopAllAction();
      wonderMixer.uncacheRoot(wonderMixer.getRoot());
      this.buildingMixers.delete(wonderKey);
    }
  }

  computeHexMatrices = (
    radius: number,
    dummy: Object3D,
    center: number[],
    targetHex: HexPosition,
    isMainHex: boolean,
    existingBuildings: any[],
    terrainMatricesByBiome: Record<BiomeType | "Empty" | string, Matrix4[]>,
  ) => {
    const biome = configManager.getBiome(targetHex.col, targetHex.row);
    const biomeVariant = biome;
    const buildableAreaBiome = "Empty";
    const isFlat = biome === "Ocean" || biome === "DeepOcean" || isMainHex;

    // reset buildings
    if (isMainHex) {
      this.buildings = [];
    }

    let positions = generateHexPositions(
      { col: center[0] + BUILDINGS_CENTER[0], row: center[1] + BUILDINGS_CENTER[1] },
      radius,
    );

    if (isMainHex) {
      const buildablePositions = generateHexPositions(
        { col: center[0] + BUILDINGS_CENTER[0], row: center[1] + BUILDINGS_CENTER[1] },
        this.structureStage + 1,
      );

      positions = positions.filter(
        (position) =>
          !buildablePositions.some(
            (buildablePosition) => buildablePosition.col === position.col && buildablePosition.row === position.row,
          ),
      );

      buildablePositions.forEach((position) => {
        dummy.position.x = position.x;
        dummy.position.z = position.z;
        dummy.position.y = isMainHex || isFlat || position.isBorder ? 0.05 : 0.05 + position.y / 2;
        dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
        dummy.updateMatrix();

        this.interactiveHexManager.addHex({ col: position.col, row: position.row });

        const building = existingBuildings.find((value) => value.col === position.col && value.row === position.row);

        if (building) {
          this.buildings.push({ ...building, matrix: this.createBuildingMatrix(position) });
        } else {
          this.highlights.push(getHexForWorldPosition(dummy.position));
        }

        const tempMatrix = MatrixPool.getInstance().getMatrix();
        tempMatrix.copy(dummy.matrix);
        terrainMatricesByBiome[buildableAreaBiome as BiomeType].push(tempMatrix);
      });
    }

    positions.forEach((position) => {
      dummy.position.x = position.x;
      dummy.position.z = position.z;
      dummy.position.y = isMainHex || isFlat || position.isBorder || IS_FLAT_MODE ? 0.05 : 0.05 + position.y / 2;
      dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
      const rotationSeed = this.hashCoordinates(position.col, position.row);
      const rotationIndex = Math.floor(rotationSeed * 6);
      const randomRotation = (rotationIndex * Math.PI) / 3;
      if (!IS_FLAT_MODE) {
        dummy.rotation.y = randomRotation;
      } else {
        dummy.rotation.y = 0;
      }
      dummy.updateMatrix();
      // OPTIMIZED: Use matrix pool instead of clone()
      const tempMatrix = MatrixPool.getInstance().getMatrix();
      tempMatrix.copy(dummy.matrix);
      terrainMatricesByBiome[biomeVariant].push(tempMatrix);
    });
  };

  computeMainHexMatrices = (
    radius: number,
    dummy: Object3D,
    center: number[],
    targetHex: HexPosition,
    terrainMatricesByBiome: Record<BiomeType | "Empty" | string, Matrix4[]>,
  ) => {
    const existingBuildings: any[] = this.tileManager.existingBuildings();
    const structureType = this.tileManager.structureType();

    if (structureType && structureType !== StructureType.Realm && structureType !== StructureType.Village) {
      existingBuildings.push({
        col: BUILDINGS_CENTER[0],
        row: BUILDINGS_CENTER[1],
        structureType,
        category: BuildingType[structureTypeToBuildingType[structureType]],
        resource: undefined,
        paused: false,
      });
    }
    this.computeHexMatrices(radius, dummy, center, targetHex, true, existingBuildings, terrainMatricesByBiome);
  };

  computeNeighborHexMatrices = (
    radius: number,
    dummy: Object3D,
    center: number[],
    targetHex: HexPosition,
    terrainMatricesByBiome: Record<BiomeType | "Empty" | string, Matrix4[]>,
  ) => {
    this.computeHexMatrices(radius, dummy, center, targetHex, false, [], terrainMatricesByBiome);
  };

  removeBuilding(innerCol: number, innerRow: number) {
    const key = `${innerCol},${innerRow}`;
    this.removePausedLabelFromBuilding({ col: innerCol, row: innerRow });
    const instance = this.buildingInstances.get(key);
    if (instance) {
      this.scene.remove(instance);
      if (this.pendingBuildingKeys.delete(key)) {
        disposeClonedBuildingMaterials(instance);
      }
      this.buildingInstances.delete(key);
    }

    // Also remove any associated wonder instance
    const wonderKey = `${key}_wonder`;
    const wonderInstance = this.wonderInstances.get(wonderKey);
    if (wonderInstance) {
      this.scene.remove(wonderInstance);
      this.wonderInstances.delete(wonderKey);
    }

    // Properly dispose of mixers before removing
    const mixer = this.buildingMixers.get(key);
    if (mixer) {
      mixer.stopAllAction();
      mixer.uncacheRoot(mixer.getRoot());
      this.buildingMixers.delete(key);
    }

    const wonderMixer = this.buildingMixers.get(wonderKey);
    if (wonderMixer) {
      wonderMixer.stopAllAction();
      wonderMixer.uncacheRoot(wonderMixer.getRoot());
      this.buildingMixers.delete(wonderKey);
    }
  }

  private selectNextStructure() {
    this.structureIndex = utilSelectNextStructure(this.playerStructures, this.structureIndex, "hex");
    if (this.playerStructures.length > 0) {
      const structure = this.playerStructures[this.structureIndex];
      // Set the structure entity ID in the UI store
      this.state.setStructureEntityId(structure.entityId);
    }
  }

  private selectNextRealmStructure() {
    const realmStructures = this.playerStructures.filter((structure) => structure.category === StructureType.Realm);
    if (realmStructures.length === 0) {
      return;
    }

    const currentId = this.state.structureEntityId;
    const currentIndex = realmStructures.findIndex((structure) => structure.entityId === currentId);
    const nextIndex = (currentIndex + 1) % realmStructures.length;
    const structure = realmStructures[nextIndex];

    const fullIndex = this.playerStructures.findIndex((candidate) => candidate.entityId === structure.entityId);
    if (fullIndex >= 0) {
      this.structureIndex = fullIndex;
    }

    navigateToStructure(structure.position.x, structure.position.y, "hex");
    this.state.setStructureEntityId(structure.entityId);
  }

  public updatePlayerStructures(structures: Structure[]) {
    this.playerStructures = structures;
    if (this.structureIndex >= structures.length) {
      this.structureIndex = 0;
    }
  }

  update(deltaTime: number) {
    super.update(deltaTime);
    this.buildingMixers.forEach((mixer) => {
      mixer.update(deltaTime);
    });

    // Update ambience system with time progress and delta
    const cycleProgress = this.state.cycleProgress || 0;
    this.ambienceSystem?.setTimeProgress(cycleProgress);
    this.ambienceSystem?.update(deltaTime);
  }

  public hasActiveLabelAnimations(): boolean {
    return this.hoverLabelManager.hasActiveLabel();
  }
}

function createHexceptionSettlementAnchors(cells: Iterable<TerrainCellInput>): TerrainSettlementAnchor[] {
  return Array.from(cells)
    .filter(({ occupied }) => occupied)
    .map(({ col, row }) => ({
      col,
      level: 1,
      row,
      structureId: `hexception:${col}:${row}`,
      structureType: StructureType.Village,
    }));
}

function resolveHexceptionBiome(biomeKey: string, fallback: BiomeType): BiomeType {
  if (biomeKey === "Empty" || biomeKey === BiomeType.None) return fallback;
  const normalized = biomeKey.endsWith("Alt") ? biomeKey.slice(0, -3) : biomeKey;
  return Object.values(BiomeType).includes(normalized as BiomeType) ? (normalized as BiomeType) : fallback;
}
