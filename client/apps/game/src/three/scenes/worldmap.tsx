import { AudioManager } from "@/audio/core/AudioManager";
import { toast } from "sonner";

import { getMapFromToriiExact, getStructuresDataFromTorii } from "@/dojo/queries";
import { ToriiStreamManager } from "@/dojo/torii-stream-manager";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { getBiomeVariant, HEX_SIZE } from "@/three/constants";
import { ArmyManager } from "@/three/managers/army-manager";
import { BattleDirectionManager } from "@/three/managers/battle-direction-manager";
import { ChestManager } from "@/three/managers/chest-manager";
import InstancedBiome from "@/three/managers/instanced-biome";
import { SelectedHexManager } from "@/three/managers/selected-hex-manager";
import { SelectionPulseManager } from "@/three/managers/selection-pulse-manager";
import { RelicSource, StructureManager } from "@/three/managers/structure-manager";
import { SceneManager } from "@/three/scene-manager";
import { CameraView, HexagonScene } from "@/three/scenes/hexagon-scene";
import { playResourceSound } from "@/three/sound/utils";
import { LeftView } from "@/types";
import { Position } from "@bibliothecadao/eternum";
import { gameWorkerManager } from "../../managers/game-worker-manager";

import { FELT_CENTER, IS_FLAT_MODE } from "@/ui/config";
import { ChestModal, HelpModal } from "@/ui/features/military";
import { QuickAttackPreview } from "@/ui/features/military/battle/quick-attack-preview";
import { UnifiedArmyCreationModal } from "@/ui/features/military/components/unified-army-creation-modal";
import { QuestModal } from "@/ui/features/progression";
import { SetupResult } from "@bibliothecadao/dojo";
import {
  ActionPath,
  ActionPaths,
  ActionType,
  ArmyActionManager,
  BattleEventSystemUpdate,
  ChestSystemUpdate,
  ExplorerMoveSystemUpdate,
  ExplorerTroopsTileSystemUpdate,
  getBlockTimestamp,
  isRelicActive,
  QuestSystemUpdate,
  RelicEffectSystemUpdate,
  SelectableArmy,
  StructureActionManager,
  TileSystemUpdate,
} from "@bibliothecadao/eternum";
import {
  ActorType,
  BiomeType,
  ContractAddress,
  Direction,
  DUMMY_HYPERSTRUCTURE_ENTITY_ID,
  findResourceById,
  getDirectionBetweenAdjacentHexes,
  HexEntityInfo,
  HexPosition,
  ID,
  RelicEffect,
  Structure,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import throttle from "lodash/throttle";
import { Account, AccountInterface } from "starknet";
import {
  Box3,
  Color,
  Group,
  InstancedBufferAttribute,
  Matrix4,
  Object3D,
  Raycaster,
  Sphere,
  Vector2,
  Vector3,
} from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { env } from "../../../env";
import { preloadAllCosmeticAssets } from "../cosmetics";
import { FXManager } from "../managers/fx-manager";
import { HoverLabelManager } from "../managers/hover-label-manager";
import { QuestManager } from "../managers/quest-manager";
import { ResourceFXManager } from "../managers/resource-fx-manager";
import { SceneName } from "../types/common";
import { getWorldPositionForHex, isAddressEqualToAccount } from "../utils";
import { getChunkCenter as getChunkCenterAligned, getRenderBounds } from "../utils/chunk-geometry";
import { InstancedMatrixAttributePool } from "../utils/instanced-matrix-attribute-pool";
import { MatrixPool } from "../utils/matrix-pool";
import { MemoryMonitor } from "../utils/memory-monitor";
import {
  navigateToStructure,
  toggleMapHexView,
  selectNextStructure as utilSelectNextStructure,
} from "../utils/navigation";
import { SceneShortcutManager } from "../utils/shortcuts";
import { openStructureContextMenu } from "./context-menu/structure-context-menu";

interface CachedMatrixEntry {
  matrices: InstancedBufferAttribute | null;
  count: number;
  box?: Box3;
  sphere?: Sphere;
}

//const dummyObject = new Object3D();
const dummy = new Object3D();
const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;
// const GLOBAL_STREAM_MODELS: GlobalModelStreamConfig[] = [
//   { model: "s1_eternum-BattleEvent" },
//   { model: "s1_eternum-ExplorerMoveEvent" }, // rewards
//   { model: "s1_eternum-StoryEvent" },
//   { model: "s1_eternum-StructureBuildings" },
//   { model: "s1_eternum-ProductionBoostBonus" },
//   { model: "s1_eternum-Building" },
//   { model: "s1_eternum-OpenRelicChestEvent" }, // get relic crate output
// ];

export default class WorldmapScene extends HexagonScene {
  // Single source of truth for chunk geometry to avoid drift across fetch/render/visibility.
  private readonly chunkGeometry = {
    size: 24, // Smaller stride to reduce edge gaps
    renderSize: {
      width: 64,
      height: 64,
    },
    overlap: 0,
  };
  private chunkSize = this.chunkGeometry.size;
  private chunkSwitchPadding = 0.05; // switch earlier when crossing boundaries
  private lastChunkSwitchPosition?: Vector3;
  private hasChunkSwitchAnchor: boolean = false;
  private currentChunkBounds?: { box: Box3; sphere: Sphere };
  private readonly prefetchedAhead: string[] = [];
  private readonly maxPrefetchedAhead = 8;
  private wheelHandler: ((event: WheelEvent) => void) | null = null;
  private wheelAccumulator = 0;
  private wheelResetTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly wheelThreshold = 10;
  private wheelDirection: -1 | 0 | 1 = 0;
  private wheelStepsThisGesture = 0;
  private readonly wheelGestureTimeoutMs = 50;
  private renderChunkSize = this.chunkGeometry.renderSize;

  private totalStructures: number = 0;

  private currentChunk: string = "null";
  private isChunkTransitioning: boolean = false;
  private chunkRefreshTimeout: number | null = null;
  private pendingChunkRefreshForce = false;
  private readonly chunkRefreshDebounceMs = 200; // Increased from 120ms to reduce chunk switches during fast scrolling
  private toriiLoadingCounter = 0;
  private readonly chunkRowsAhead = 2;
  private readonly chunkRowsBehind = 2;
  private readonly chunkColsEachSide = 2;
  private hydratedChunkRefreshes: Set<string> = new Set();
  private hydratedRefreshScheduled = false;
  private cameraPositionScratch: Vector3 = new Vector3();
  private cameraDirectionScratch: Vector3 = new Vector3();
  private cameraGroundIntersectionScratch: Vector3 = new Vector3();

  private armyManager: ArmyManager;
  private pendingArmyMovements: Set<ID> = new Set();
  private structureManager: StructureManager;
  private memoryMonitor?: MemoryMonitor;
  private chestManager: ChestManager;
  private exploredTiles: Map<number, Map<number, BiomeType>> = new Map();
  // normalized positions and if they are allied or not
  private armyHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // normalized positions and if they are allied or not
  private structureHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // normalized positions and if they are allied or not
  private questHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // normalized positions and if they are allied or not
  private chestHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // store armies positions by ID, to remove previous positions when army moves
  // normalized coordinates
  private armiesPositions: Map<ID, HexPosition> = new Map();
  private armyLastUpdateAt: Map<ID, number> = new Map();
  // normalized coordinates
  private structuresPositions: Map<ID, HexPosition> = new Map();

  // Battle direction manager for tracking attacker/defender relationships
  private battleDirectionManager: BattleDirectionManager;

  private selectedHexManager: SelectedHexManager;
  private selectionPulseManager: SelectionPulseManager;
  private structurePulseColorCache: Map<string, { base: Color; pulse: Color }> = new Map();
  private armyStructureOwners: Map<ID, ID> = new Map();
  private updateCameraTargetHexThrottled?: ReturnType<typeof throttle>;
  private updateCameraTargetHex = () => {
    const normalizedHex = this.getCameraTargetHex();
    const contractHex = new Position({ x: normalizedHex.col, y: normalizedHex.row }).getContract();
    const nextHex = { col: Number(contractHex.x), row: Number(contractHex.y) };
    const state = useUIStore.getState();
    const currentHex = state.cameraTargetHex;
    const hexChanged = !currentHex || currentHex.col !== nextHex.col || currentHex.row !== nextHex.row;
    const nextCameraDistance = Math.round(this.controls.object.position.distanceTo(this.controls.target) * 100) / 100;
    const distanceChanged = state.cameraDistance === null || Math.abs(state.cameraDistance - nextCameraDistance) > 0.01;

    if (!hexChanged && !distanceChanged) return;

    const nextState: { cameraTargetHex?: typeof nextHex; cameraDistance?: number } = {};
    if (hexChanged) nextState.cameraTargetHex = nextHex;
    if (distanceChanged) nextState.cameraDistance = nextCameraDistance;
    useUIStore.setState(nextState);
  };
  private minimapCameraMoveTarget: { col: number; row: number } | null = null;
  private minimapCameraMoveThrottled?: ReturnType<typeof throttle>;
  private minimapCameraMoveHandler = (event: Event) => {
    if (this.sceneManager.getCurrentScene() !== SceneName.WorldMap) return;
    const detail = (event as CustomEvent<{ col: number; row: number }>).detail;
    if (!detail) return;
    this.minimapCameraMoveTarget = detail;
    this.minimapCameraMoveThrottled?.();
  };
  private minimapZoomHandler = (event: Event) => {
    if (this.sceneManager.getCurrentScene() !== SceneName.WorldMap) return;
    const detail = (event as CustomEvent<{ zoomOut: boolean }>).detail;
    if (!detail) return;

    const enableSmoothZoom = useUIStore.getState().enableMapZoom;
    if (!enableSmoothZoom) {
      this.stepCameraView(detail.zoomOut);
      return;
    }

    const camera = this.controls.object;
    const target = this.controls.target;
    const currentDistance = camera.position.distanceTo(target);
    if (!Number.isFinite(currentDistance) || currentDistance <= 0) return;

    const zoomFactor = detail.zoomOut ? 1.1 : 0.9;
    const minDistance = this.controls.minDistance || this.getTargetDistanceForCameraView(CameraView.Close);
    const maxDistance = this.controls.maxDistance || this.getTargetDistanceForCameraView(CameraView.Far);
    const nextDistance = Math.min(maxDistance, Math.max(minDistance, currentDistance * zoomFactor));

    const direction = new Vector3().subVectors(camera.position, target);
    const length = direction.length();
    if (length < 1e-6) return;
    direction.multiplyScalar(nextDistance / length);
    camera.position.copy(target).add(direction);

    this.controls.update();
    this.controls.dispatchEvent({ type: "change" });
    this.frustumManager?.forceUpdate();
    this.visibilityManager?.markDirty();
  };
  private handleControlsChangeForMinimap = () => {
    if (this.sceneManager.getCurrentScene() !== SceneName.WorldMap) return;
    this.updateCameraTargetHexThrottled?.();
  };
  private followCameraTimeout: ReturnType<typeof setTimeout> | null = null;
  private notifiedBattleEvents = new Set<string>();
  private previouslyHoveredHex: HexPosition | null = null;
  private async ensureStructureSynced(structureId: ID, hexCoords: HexPosition) {
    const components = this.dojo.components as SetupResult["components"];
    const toriiClient = this.dojo.network?.toriiClient;
    const contractComponents = this.dojo.network?.contractComponents;

    const contractCoords = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();

    if (!components?.Structure || !toriiClient || !contractComponents) {
      return;
    }

    let entityKey: string | undefined;
    try {
      entityKey = getEntityIdFromKeys([BigInt(structureId)]) as string;
    } catch (error) {
      console.warn("[WorldmapScene] Unable to build entity key for structure", structureId, error);
      return;
    }

    const existing = getComponentValue(components.Structure, entityKey as any);
    if (existing) {
      return;
    }

    const numericId = Number(structureId);
    if (!Number.isFinite(hexCoords.col) || !Number.isFinite(hexCoords.row)) {
      console.warn("[WorldmapScene] Unable to determine coordinates for structure", structureId);
      return;
    }
    if (!Number.isFinite(numericId)) {
      console.warn("[WorldmapScene] Structure id is not a finite number", structureId);
      return;
    }

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "wait";

    try {
      const typedContractComponents = contractComponents as any;
      await getStructuresDataFromTorii(toriiClient, typedContractComponents, [
        {
          entityId: numericId,
          position: { col: contractCoords.x, row: contractCoords.y },
        },
      ]);
    } catch (error) {
      console.error("[WorldmapScene] Failed to fetch structure data from Torii", error);
    } finally {
      document.body.style.cursor = previousCursor;
    }
  }

  private cachedMatrices: Map<string, Map<string, CachedMatrixEntry>> = new Map();
  private cachedMatrixOrder: string[] = [];
  private readonly maxMatrixCacheSize = 16;
  private pinnedChunkKeys: Set<string> = new Set();
  private updateHexagonGridPromise: Promise<void> | null = null;
  private hexGridFrameHandle: number | null = null;
  private currentHexGridTask: symbol | null = null;
  private readonly hexGridFrameBudgetMs = 6.5;
  private readonly hexGridMinBatch = 120;
  private readonly hexGridMaxBatch = 900;
  private travelEffects: Map<string, () => void> = new Map();
  private hasInitialized = false;
  private initialSetupPromise: Promise<void> | null = null;
  private cancelHexGridComputation?: () => void;

  // Pending relic effects store - holds relic effects for entities that aren't loaded yet
  private pendingRelicEffects: Map<ID, Map<RelicSource, Set<{ relicResourceId: number; effect: RelicEffect }>>> =
    new Map();

  // Relic effect validation timer
  private relicValidationInterval: ReturnType<typeof setTimeout> | null = null;

  // Global chunk switching coordination
  private globalChunkSwitchPromise: Promise<void> | null = null;

  // Label groups
  private armyLabelsGroup: Group;
  private structureLabelsGroup: Group;
  private questLabelsGroup: Group;
  private chestLabelsGroup: Group;

  private storeSubscriptions: Array<() => void> = [];

  dojo: SetupResult;

  // Render-area fetch bookkeeping (keys represent render-sized regions, not chunk stride)
  private fetchedChunks: Set<string> = new Set();
  private pendingChunks: Map<string, Promise<void>> = new Map();
  private pinnedRenderAreas: Set<string> = new Set();
  private pendingArmyRemovals: Map<ID, ReturnType<typeof setTimeout>> = new Map();
  private pendingArmyRemovalMeta: Map<ID, { scheduledAt: number; chunkKey: string; reason: "tile" | "zero" }> =
    new Map();
  private deferredChunkRemovals: Map<ID, { reason: "tile" | "zero"; scheduledAt: number }> = new Map();

  private fxManager: FXManager;
  private resourceFXManager: ResourceFXManager;
  private questManager: QuestManager;
  private armyIndex: number = 0;
  private selectableArmies: SelectableArmy[] = [];
  private structureIndex: number = 0;
  private playerStructures: Structure[] = [];

  // Hover-based label expansion manager
  private hoverLabelManager: HoverLabelManager;
  private toriiStreamManager?: ToriiStreamManager;

  // Chunk lifecycle integration for deterministic loading
  private chunkIntegration?: import("@/three/chunk-system").ChunkIntegration;
  private worldUpdateUnsubscribes: Array<() => void> = [];
  private visibilityChangeHandler?: () => void;

  constructor(
    dojoContext: SetupResult,
    raycaster: Raycaster,
    controls: MapControls,
    mouse: Vector2,
    sceneManager: SceneManager,
  ) {
    super(SceneName.WorldMap, controls, dojoContext, mouse, raycaster, sceneManager);

    this.dojo = dojoContext;
    this.fxManager = new FXManager(this.scene, 1);
    this.resourceFXManager = new ResourceFXManager(this.scene, 1.2);

    // Initialize memory monitor for worldmap operations
    if (MEMORY_MONITORING_ENABLED) {
      this.memoryMonitor = new MemoryMonitor({
        spikeThresholdMB: 30, // Higher threshold for world operations
        onMemorySpike: (spike) => {
          console.warn(`🗺️  WorldMap Memory Spike: +${spike.increaseMB.toFixed(1)}MB in ${spike.context}`);
        },
      });
    }

    this.GUIFolder.add(this, "moveCameraToURLLocation");

    this.loadBiomeModels(this.renderChunkSize.width * this.renderChunkSize.height);

    // Initialize label groups
    this.armyLabelsGroup = new Group();
    this.armyLabelsGroup.name = "ArmyLabelsGroup";
    this.structureLabelsGroup = new Group();
    this.structureLabelsGroup.name = "StructureLabelsGroup";
    this.questLabelsGroup = new Group();
    this.questLabelsGroup.name = "QuestLabelsGroup";
    this.chestLabelsGroup = new Group();
    this.chestLabelsGroup.name = "ChestLabelsGroup";

    this.armyManager = new ArmyManager(
      this.scene,
      this.renderChunkSize,
      this.armyLabelsGroup,
      this,
      this.dojo,
      (entityId: ID) => this.applyPendingRelicEffects(entityId),
      (entityId: ID) => this.clearPendingRelicEffects(entityId),
      this.frustumManager,
      this.visibilityManager,
      this.chunkSize,
    );

    // Expose material sharing debug to global console
    (window as { testMaterialSharing?: () => void }).testMaterialSharing = () =>
      this.armyManager.logMaterialSharingStats();
    this.structureManager = new StructureManager(
      this.scene,
      this.renderChunkSize,
      this.structureLabelsGroup,
      this,
      this.fxManager,
      this.dojo,
      (entityId: ID) => this.applyPendingRelicEffects(entityId),
      (entityId: ID) => this.clearPendingRelicEffects(entityId),
      this.frustumManager,
      this.visibilityManager,
      this.chunkSize,
    );

    // Initialize the quest manager
    this.questManager = new QuestManager(
      this.scene,
      this.renderChunkSize,
      this.questLabelsGroup,
      this,
      this.frustumManager,
      this.chunkSize,
    );

    // Initialize the chest manager
    this.chestManager = new ChestManager(
      this.scene,
      this.renderChunkSize,
      this.chestLabelsGroup,
      this,
      this.frustumManager,
      this.chunkSize,
    );

    const toriiClient = this.dojo.network?.toriiClient;
    if (toriiClient) {
      // this.toriiStreamManager = new ToriiStreamManager({
      //   client: toriiClient,
      //   setup: this.dojo,
      //   logging: Boolean(import.meta.env.DEV),
      // });
      // this.toriiStreamManager
      //   .setGlobalModels(GLOBAL_STREAM_MODELS)
      //   .catch((error) => console.error("[WorldmapScene] Failed to start global Torii stream", error));
    }

    // NOTE: Chunk integration system disabled for performance
    // The core fix for chunk loading (awaiting refreshStructuresForChunks) doesn't require it.
    // The chunk integration adds overhead via hydration tracking callbacks on every entity update.
    // Uncomment if you need advanced chunk lifecycle debugging/tracking features.
    // this.initializeChunkIntegration();

    // Force visibility/chunk refresh when returning from background tab to avoid missing armies/tiles.
    this.visibilityChangeHandler = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      this.visibilityManager?.forceUpdate();
      void this.updateVisibleChunks(true);
    };
    document.addEventListener("visibilitychange", this.visibilityChangeHandler);

    // Initialize the battle direction manager
    this.battleDirectionManager = new BattleDirectionManager(
      (entityId: ID, direction: Direction | undefined, role: "attacker" | "defender") =>
        this.armyManager.updateBattleDirection(entityId, direction, role),
      (entityId: ID, direction: Direction | undefined, role: "attacker" | "defender") =>
        this.structureManager.updateBattleDirection(entityId, direction, role),
      (entityId: ID) => this.armiesPositions.get(entityId) || this.structuresPositions.get(entityId),
    );

    // Initialize the hover label manager
    this.hoverLabelManager = new HoverLabelManager(
      {
        army: {
          show: (entityId: ID) => this.armyManager.showLabel(entityId),
          hide: (entityId: ID) => this.armyManager.hideLabel(entityId),
          hideAll: () => this.armyManager.hideAllLabels(),
        },
        structure: {
          show: (entityId: ID) => this.structureManager.showLabel(entityId),
          hide: (entityId: ID) => this.structureManager.hideLabel(entityId),
          hideAll: () => this.structureManager.hideAllLabels(),
        },
        quest: {
          show: (entityId: ID) => this.questManager.showLabel(entityId),
          hide: (entityId: ID) => this.questManager.hideLabel(entityId),
          hideAll: () => this.questManager.hideAllLabels(),
        },
        chest: {
          show: (entityId: ID) => this.chestManager.showLabel(entityId),
          hide: (entityId: ID) => this.chestManager.hideLabel(entityId),
          hideAll: () => this.chestManager.hideAllLabels(),
        },
      },
      (hexCoords: HexPosition) => this.getHexagonEntity(hexCoords),
      this.currentCameraView,
    );

    // Subscribe hover label manager to camera view changes
    this.addCameraViewListener((view: CameraView) => {
      this.hoverLabelManager.updateCameraView(view);
    });

    // Store the unsubscribe function for Army updates
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Army.onTileUpdate(async (update: ExplorerTroopsTileSystemUpdate) => {
        this.cancelPendingArmyRemoval(update.entityId);

        if (update.removed) {
          // console.debug(`[WorldMap] Tile update indicates removal for entity ${update.entityId}`);
          this.scheduleArmyRemoval(update.entityId, "tile");
          return;
        }

        // console.debug(`[WorldMap] Army tile update received for entity ${update.entityId}`);
        this.updateArmyHexes(update);

        // Add combat relationship
        if (update.battleData?.latestAttackerId) {
          this.addCombatRelationship(update.battleData.latestAttackerId, update.entityId);
        }
        if (update.battleData?.latestDefenderId) {
          this.addCombatRelationship(update.entityId, update.battleData.latestDefenderId);
        }

        // Ensure army spawn location is marked as explored for pathfinding
        // This fixes the bug where newly spawned armies can't see movement options
        const normalizedPos = new Position({ x: update.hexCoords.col, y: update.hexCoords.row }).getNormalized();
        if (!this.exploredTiles.has(normalizedPos.x)) {
          this.exploredTiles.set(normalizedPos.x, new Map());
        }
        if (!this.exploredTiles.get(normalizedPos.x)!.has(normalizedPos.y)) {
          // Mark spawn location as grassland (default safe biome for pathfinding)
          this.exploredTiles.get(normalizedPos.x)!.set(normalizedPos.y, BiomeType.Grassland);
        }

        await this.armyManager.onTileUpdate(update);

        this.invalidateAllChunkCachesContainingHex(normalizedPos.x, normalizedPos.y);

        // Update positions for the moved army
        const armyEntityId = update.entityId;
        const prevPosition = this.armiesPositions.get(armyEntityId);
        // this.armiesPositions.set(armyEntityId, normalizedPos);

        // Recalculate arrows for this army when it moves
        this.recalculateArrowsForEntity(armyEntityId);

        // Check if any other entities had relationships with this army at its previous position
        // and update their arrows too
        if (prevPosition) {
          this.recalculateArrowsForEntitiesRelatedTo(armyEntityId);
        }
      }),
    );

    // Listen for troop count and stamina changes
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Army.onExplorerTroopsUpdate((update) => {
        this.cancelPendingArmyRemoval(update.entityId);
        // console.debug(`[WorldMap] ExplorerTroops update received for entity ${update.entityId}`, {
        //   troopCount: update.troopCount,
        //   owner: update.ownerAddress,
        // });

        if (update.troopCount <= 0) {
          // console.debug(`[WorldMap] ExplorerTroops update indicates removal for entity ${update.entityId}`);
          this.scheduleArmyRemoval(update.entityId, "zero");
          return;
        }
        this.updateArmyHexes(update);
        this.armyManager.updateArmyFromExplorerTroopsUpdate(update);
      }),
    );

    // Listen for dead army updates
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Army.onDeadArmy((entityId) => {
        // console.debug(`[WorldMap] onDeadArmy received for entity ${entityId}`);

        // Remove the army visuals/hex before dropping tracking data so we can clean up the correct tile
        this.deleteArmy(entityId);

        // Remove from attacker-defender tracking
        this.removeEntityFromTracking(entityId);
        this.updateVisibleChunks().catch((error) => console.error("Failed to update visible chunks:", error));
      }),
    );

    // Listen for battle events and update army/structure labels
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.BattleEvent.onBattleUpdate((update: BattleEventSystemUpdate) => {
        // console.debug(`[WorldMap] BattleEvent update received for battle entity ${update.entityId}`);
        // console.log("🗺️ WorldMap: Received battle event update:", update);

        // Update both attacker and defender information using the public methods
        const { attackerId, defenderId } = update.battleData;

        // Add combat relationship
        if (attackerId && defenderId) {
          this.addCombatRelationship(attackerId, defenderId);
          this.recalculateArrowsForEntity(attackerId);
          this.recalculateArrowsForEntity(defenderId);
        }

        const uiStore = useUIStore.getState();
        const followArmyCombats = uiStore.followArmyCombats;
        const currentScene = this.sceneManager.getCurrentScene();

        if (followArmyCombats && currentScene === SceneName.WorldMap) {
          const attackerPosition =
            attackerId !== undefined
              ? (this.armiesPositions.get(attackerId) ?? this.structuresPositions.get(attackerId))
              : undefined;
          const defenderPosition =
            defenderId !== undefined
              ? (this.armiesPositions.get(defenderId) ?? this.structuresPositions.get(defenderId))
              : undefined;

          const targetPosition = defenderPosition ?? attackerPosition;

          if (targetPosition) {
            this.focusCameraOnEvent(targetPosition.col, targetPosition.row, "Following Army Combat");
          }
        }

        this.notifyArmyUnderAttack(update);
      }),
    );

    // Listen for structure guard updates
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Structure.onStructureUpdate((update) => {
        this.updateStructureHexes(update);
        this.structureManager.updateStructureLabelFromStructureUpdate(update);
      }),
    );

    // Listen for structure building updates
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Structure.onStructureBuildingsUpdate((update) => {
        this.structureManager.updateStructureLabelFromBuildingUpdate(update);
      }),
    );

    // Store the unsubscribe function for Tile updates
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Tile.onTileUpdate((value) => this.updateExploredHex(value)),
    );

    // Store the unsubscribe function for Structure updates
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Structure.onTileUpdate(async (value) => {
        this.updateStructureHexes(value);

        const optimisticStructure = this.structureManager.structures.removeStructure(
          Number(DUMMY_HYPERSTRUCTURE_ENTITY_ID),
        );
        if (optimisticStructure) {
          this.dojo.components.Structure.removeOverride(DUMMY_HYPERSTRUCTURE_ENTITY_ID.toString());
          this.structureManager.structureHexCoords
            .get(optimisticStructure.hexCoords.col)
            ?.delete(optimisticStructure.hexCoords.row);
          this.structureManager.updateChunk(this.currentChunk);
        }

        await this.structureManager.onUpdate(value);

        if (this.totalStructures !== this.structureManager.getTotalStructures()) {
          this.totalStructures = this.structureManager.getTotalStructures();
          this.clearCache();
          this.updateVisibleChunks(true).catch((error) => console.error("Failed to update visible chunks:", error));
        }
      }),
    );

    // Store the unsubscribe function for Structure contributions
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Structure.onContribution((value) => {
        this.structureManager.structures.updateStructureStage(value.entityId, value.structureType, value.stage);
        this.structureManager.updateChunk(this.currentChunk);
      }),
    );

    // perform some updates for the quest manager
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Quest.onTileUpdate((update: QuestSystemUpdate) => {
        this.updateQuestHexes(update);
        this.questManager.onUpdate(update);
      }),
    );

    // perform some updates for the chest manager
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Chest.onTileUpdate((update: ChestSystemUpdate) => {
        this.updateChestHexes(update);
        this.chestManager.onUpdate(update);
      }),
    );
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Chest.onDeadChest((entityId) => {
        // If the chest is opened, remove it from the map
        this.deleteChest(entityId);
      }),
    );

    // Store the unsubscribe function for Relic Effect updates
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.RelicEffect.onExplorerTroopsUpdate(async (update: RelicEffectSystemUpdate) => {
        this.handleRelicEffectUpdate(update);
      }),
    );

    this.addWorldUpdateSubscription(
      this.worldUpdateListener.RelicEffect.onStructureGuardUpdate((update: RelicEffectSystemUpdate) => {
        this.handleRelicEffectUpdate(update, RelicSource.Guard);
      }),
    );

    this.addWorldUpdateSubscription(
      this.worldUpdateListener.RelicEffect.onStructureProductionUpdate((update: RelicEffectSystemUpdate) => {
        this.handleRelicEffectUpdate(update, RelicSource.Production);
      }),
    );

    this.addWorldUpdateSubscription(
      this.worldUpdateListener.ExplorerMove.onExplorerMoveEventUpdate((update: ExplorerMoveSystemUpdate) => {
        const { explorerId, resourceId, amount } = update;

        // Find the army position using explorerId
        setTimeout(() => {
          const armyPosition = this.armiesPositions.get(explorerId);

          if (armyPosition) {
            // Check if user has camera follow enabled and is on worldmap
            const followArmyMoves = useUIStore.getState().followArmyMoves;
            const currentScene = this.sceneManager.getCurrentScene();

            if (followArmyMoves && currentScene === SceneName.WorldMap) {
              this.focusCameraOnEvent(armyPosition.col, armyPosition.row, "Following Army Movement");
            }
            if (resourceId === 0) {
              return;
            }
            const resource = findResourceById(resourceId);
            const ownerAddress = this.getEntityOwnerAddress(explorerId);
            const isOwnArmy = ownerAddress !== undefined && isAddressEqualToAccount(ownerAddress);
            if (isOwnArmy) {
              // Play the sound for the resource gain only when it belongs to the local player
              playResourceSound(resourceId, this.state.isSoundOn, this.state.effectsLevel);
            }
            // Display the resource gain at the army's position
            this.displayResourceGain(
              resourceId,
              amount,
              armyPosition.col,
              armyPosition.row,
              resource?.trait + " found",
            );
          } else {
            console.warn(`Could not find army with ID ${explorerId} for resource gain display`);
          }
        }, 500);
      }),
    );

    // add particles
    this.selectedHexManager = new SelectedHexManager(this.scene);
    this.selectionPulseManager = new SelectionPulseManager(this.scene);

    // Legacy canvas minimap has been replaced by the React minimap (BottomRightPanel/HexMinimap).
    // We keep only the "minimapCameraMove" event bridge + cameraTargetHex updates for the UI.
    this.updateCameraTargetHexThrottled = throttle(this.updateCameraTargetHex, 33);
    this.minimapCameraMoveThrottled = throttle(() => {
      const target = this.minimapCameraMoveTarget;
      if (!target) return;
      this.moveCameraToColRow(target.col, target.row, 0.25);
    }, 16);
    window.addEventListener("minimapCameraMove", this.minimapCameraMoveHandler as EventListener);
    window.addEventListener("minimapZoom", this.minimapZoomHandler as EventListener);
    this.controls.addEventListener("change", this.handleControlsChangeForMinimap);
    this.updateCameraTargetHexThrottled();

    // Initialize SceneShortcutManager for WorldMap shortcuts
    this.shortcutManager = new SceneShortcutManager("worldmap", this.sceneManager);

    // Only register shortcuts if they haven't been registered already
    if (!this.shortcutManager.hasShortcuts()) {
      this.shortcutManager.registerShortcut({
        id: "cycle-armies",
        key: "Tab",
        description: "Cycle through armies",
        sceneRestriction: SceneName.WorldMap,
        condition: () => this.selectableArmies.length > 0,
        action: () => void this.selectNextArmy(),
      });

      this.shortcutManager.registerShortcut({
        id: "cycle-structures",
        key: "Tab",
        modifiers: { shift: true },
        description: "Cycle through structures",
        sceneRestriction: SceneName.WorldMap,
        condition: () => this.playerStructures.length > 0,
        action: () => this.selectNextStructure(),
      });

      this.shortcutManager.registerShortcut({
        id: "toggle-view",
        key: "v",
        description: "Toggle between world and local view",
        sceneRestriction: SceneName.WorldMap,
        action: () => toggleMapHexView(),
      });

      this.shortcutManager.registerShortcut({
        id: "camera-view-close",
        key: "1",
        description: "Zoom to close view",
        sceneRestriction: SceneName.WorldMap,
        action: () => this.changeCameraView(CameraView.Close),
      });

      this.shortcutManager.registerShortcut({
        id: "camera-view-medium",
        key: "2",
        description: "Zoom to medium view",
        sceneRestriction: SceneName.WorldMap,
        action: () => this.changeCameraView(CameraView.Medium),
      });

      this.shortcutManager.registerShortcut({
        id: "camera-view-far",
        key: "3",
        description: "Zoom to far view",
        sceneRestriction: SceneName.WorldMap,
        action: () => this.changeCameraView(CameraView.Far),
      });

      // Register escape key handler
      this.shortcutManager.registerShortcut({
        id: "escape-handler",
        key: "Escape",
        description: "Clear selection or close navigation views",
        sceneRestriction: SceneName.WorldMap,
        action: () => {
          if (this.isNavigationViewOpen()) {
            this.closeNavigationViews();
          } else {
            this.clearSelection();
          }
        },
      });
    }

    window.addEventListener("urlChanged", () => {
      this.clearSelection();
    });

    // Start relic effect validation timer (every 5 seconds)
    this.startRelicValidationTimer();
  }

  private setupCameraZoomHandler() {
    this.resetWheelState();

    this.wheelHandler = (event: WheelEvent) => {
      const enableSmoothZoom = useUIStore.getState().enableMapZoom;

      if (enableSmoothZoom) {
        // Let MapControls handle zooming when smooth zoom is enabled.
        this.resetWheelState();
        return;
      }

      const normalizedDelta = this.normalizeWheelDelta(event);
      const mostlyVertical = Math.abs(normalizedDelta) >= Math.abs(event.deltaX);

      if (!normalizedDelta || !mostlyVertical) {
        return;
      }

      const direction = Math.sign(normalizedDelta) as -1 | 0 | 1;
      if (direction === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (this.wheelDirection !== direction) {
        this.wheelDirection = direction;
        this.wheelStepsThisGesture = 0;
        this.wheelAccumulator = 0;
      }

      this.wheelAccumulator += normalizedDelta;

      if (Math.abs(this.wheelAccumulator) < this.wheelThreshold) {
        this.scheduleWheelAccumulatorReset();
        return;
      }

      if (this.wheelStepsThisGesture >= 1) {
        const saturatingDirection = (Math.sign(this.wheelAccumulator) as -1 | 0 | 1) || direction;
        this.wheelAccumulator = saturatingDirection * this.wheelThreshold;
        this.scheduleWheelAccumulatorReset();
        return;
      }

      this.stepCameraView(direction > 0);
      this.wheelStepsThisGesture = 1;
      this.wheelAccumulator = 0;
      this.scheduleWheelAccumulatorReset();
    };

    const canvas = document.getElementById("main-canvas");
    if (canvas) {
      canvas.addEventListener("wheel", this.wheelHandler, { passive: false });
    }
  }

  private stepCameraView(zoomOut: boolean) {
    const nextView = zoomOut
      ? Math.min(CameraView.Far, this.currentCameraView + 1)
      : Math.max(CameraView.Close, this.currentCameraView - 1);

    if (nextView === this.currentCameraView) {
      if (this.isCameraDistanceOutOfSync(this.currentCameraView)) {
        this.changeCameraView(this.currentCameraView);
      }
      return;
    }

    this.changeCameraView(nextView);
  }

  public changeCameraView(position: CameraView) {
    super.changeCameraView(position);
    if (!this.mainDirectionalLight) {
      return;
    }
    this.configureWorldmapShadows();
  }

  private configureWorldmapShadows() {
    if (!this.mainDirectionalLight) {
      return;
    }
    this.mainDirectionalLight.castShadow = true;
    this.mainDirectionalLight.shadow.mapSize.set(1024, 1024);
    this.mainDirectionalLight.shadow.camera.left = -60;
    this.mainDirectionalLight.shadow.camera.right = 60;
    this.mainDirectionalLight.shadow.camera.top = 45;
    this.mainDirectionalLight.shadow.camera.bottom = -45;
    this.mainDirectionalLight.shadow.camera.far = 110;
    this.mainDirectionalLight.shadow.camera.near = 8;
    this.mainDirectionalLight.shadow.bias = -0.02;
    this.mainDirectionalLight.shadow.camera.updateProjectionMatrix();
  }

  private getTargetDistanceForCameraView(view: CameraView): number {
    switch (view) {
      case CameraView.Close:
        return 10;
      case CameraView.Far:
        return 40;
      case CameraView.Medium:
      default:
        return 20;
    }
  }

  private getCurrentCameraDistance(): number {
    return this.controls.object.position.distanceTo(this.controls.target);
  }

  private isCameraDistanceOutOfSync(view: CameraView, tolerance: number = 1): boolean {
    const currentDistance = this.getCurrentCameraDistance();
    const targetDistance = this.getTargetDistanceForCameraView(view);
    return Math.abs(currentDistance - targetDistance) > tolerance;
  }

  private normalizeWheelDelta(event: WheelEvent): number {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      return event.deltaY * 16;
    }

    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      return event.deltaY * window.innerHeight;
    }

    return event.deltaY;
  }

  private scheduleWheelAccumulatorReset() {
    if (this.wheelResetTimeout) {
      clearTimeout(this.wheelResetTimeout);
    }

    this.wheelResetTimeout = setTimeout(() => {
      this.resetWheelState();
    }, this.wheelGestureTimeoutMs);
  }

  private resetWheelState() {
    const timeoutId = this.wheelResetTimeout;
    this.wheelResetTimeout = null;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    this.wheelAccumulator = 0;
    this.wheelDirection = 0;
    this.wheelStepsThisGesture = 0;
  }

  public moveCameraToURLLocation() {
    const col = this.locationManager.getCol();
    const row = this.locationManager.getRow();
    if (col !== undefined && row !== undefined) {
      this.moveCameraToColRow(col, row, 0);
    }
  }

  private focusCameraOnEvent(col: number, row: number, message: string) {
    this.moveCameraToColRow(col, row, 2);

    const uiStore = useUIStore.getState();
    uiStore.setFollowingArmyMessage(message);
    uiStore.setIsFollowingArmy(true);

    if (this.followCameraTimeout) {
      clearTimeout(this.followCameraTimeout);
    }

    this.followCameraTimeout = setTimeout(() => {
      const store = useUIStore.getState();
      store.setIsFollowingArmy(false);
      store.setFollowingArmyMessage(null);
      this.followCameraTimeout = null;
    }, 3000);
  }

  private getEntityOwnerAddress(entityId: ID): ContractAddress | undefined {
    const armyPosition = this.armiesPositions.get(entityId);
    if (armyPosition) {
      return this.armyHexes.get(armyPosition.col)?.get(armyPosition.row)?.owner;
    }

    const structurePosition = this.structuresPositions.get(entityId);
    if (structurePosition) {
      return this.structureHexes.get(structurePosition.col)?.get(structurePosition.row)?.owner;
    }

    return undefined;
  }

  private getEntityLabel(entityId: ID): string {
    if (this.armiesPositions.has(entityId)) {
      return `Army #${entityId}`;
    }
    if (this.structuresPositions.has(entityId)) {
      return `Structure #${entityId}`;
    }
    return `Entity #${entityId}`;
  }

  private markBattleNotificationHandled(key: string) {
    this.notifiedBattleEvents.add(key);
    if (this.notifiedBattleEvents.size > 100) {
      const iterator = this.notifiedBattleEvents.values().next();
      if (!iterator.done) {
        this.notifiedBattleEvents.delete(iterator.value);
      }
    }
  }

  private openBattleLogsPanel() {
    const uiStore = useUIStore.getState();
    uiStore.setLeftNavigationView(LeftView.StoryEvents);
  }

  private notifyArmyUnderAttack(update: BattleEventSystemUpdate) {
    const defenderId = update.battleData.defenderId;
    if (typeof defenderId !== "number") {
      return;
    }

    const defenderOwner = this.getEntityOwnerAddress(defenderId);
    if (!defenderOwner || !isAddressEqualToAccount(defenderOwner)) {
      return;
    }

    const focusPosition = this.armiesPositions.get(defenderId) ?? this.structuresPositions.get(defenderId);

    const notificationKey = `${update.entityId}-${update.battleData.timestamp}`;
    if (this.notifiedBattleEvents.has(notificationKey)) {
      return;
    }

    this.markBattleNotificationHandled(notificationKey);

    const attackerId = update.battleData.attackerId;
    const defenderLabel = this.getEntityLabel(defenderId);
    const attackerLabel = typeof attackerId === "number" ? this.getEntityLabel(attackerId) : "Unknown attacker";

    toast(
      <div className="flex flex-col gap-2">
        <div className="text-gold font-bold">⚠️ {defenderLabel} under attack</div>
        <div className="text-light-pink">Engaged by {attackerLabel}.</div>
        <div className="flex gap-2 mt-2">
          <button
            className="bg-gold text-brown font-semibold px-3 py-1 rounded"
            onClick={() => this.openBattleLogsPanel()}
          >
            View logs
          </button>
          {focusPosition && (
            <button
              className="bg-gold text-brown font-semibold px-3 py-1 rounded"
              onClick={() => this.focusCameraOnEvent(focusPosition.col, focusPosition.row, "Following Combat Alert")}
            >
              Focus camera
            </button>
          )}
        </div>
      </div>,
      {
        classNames: {
          toast: "!bg-dark-brown !border-gold/30",
        },
      },
    );
  }

  // methods needed to add worldmap specific behavior to the click events
  protected onHexagonMouseMove(hex: { hexCoords: HexPosition; position: Vector3 } | null): void {
    if (hex === null) {
      this.state.updateEntityActionHoveredHex(null);
      this.state.setHoveredHex(null);

      // Reset cursor when leaving hex
      document.body.style.cursor = "default";

      // Handle label collapse on hex leave
      this.hoverLabelManager.onHexLeave();
      return;
    }
    const { hexCoords } = hex;

    // Handle label expansion on hover
    this.hoverLabelManager.onHexHover(hexCoords);

    const { selectedEntityId, actionPaths } = this.state.entityActions;
    if (selectedEntityId && actionPaths.size > 0) {
      if (this.previouslyHoveredHex?.col !== hexCoords.col || this.previouslyHoveredHex?.row !== hexCoords.row) {
        this.previouslyHoveredHex = hexCoords;
      }
      this.state.updateEntityActionHoveredHex(hexCoords);
    }
  }

  // double-click to enter hex view; spectate when the structure is not yours
  protected onHexagonDoubleClick(hexCoords: HexPosition) {
    const { structure } = this.getHexagonEntity(hexCoords);
    if (!structure) {
      return;
    }

    void this.enterStructureFromWorldmap(structure, hexCoords);
  }

  private async enterStructureFromWorldmap(structure: HexEntityInfo, hexCoords: HexPosition) {
    const accountAddress = ContractAddress(useAccountStore.getState().account?.address || "");
    const isMine = structure.owner === accountAddress;

    try {
      console.log("[WorldmapScene] Syncing structure before entry", structure.id, hexCoords);
      await this.ensureStructureSynced(structure.id, hexCoords);
    } catch (error) {
      console.error("[WorldmapScene] Failed to sync structure before entry", error);
    }

    const contractPosition = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
    const worldMapPosition =
      Number.isFinite(Number(contractPosition?.x)) && Number.isFinite(Number(contractPosition?.y))
        ? { col: Number(contractPosition?.x), row: Number(contractPosition?.y) }
        : undefined;

    const shouldSpectate = this.state.isSpectating || !isMine;

    this.state.setStructureEntityId(structure.id, {
      spectator: shouldSpectate,
      worldMapPosition,
    });

    navigateToStructure(hexCoords.col, hexCoords.row, "hex");
  }

  protected getHexagonEntity(hexCoords: HexPosition) {
    const hex = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();
    const army = this.armyHexes.get(hex.x)?.get(hex.y);
    const structure = this.structureHexes.get(hex.x)?.get(hex.y);
    const quest = this.questHexes.get(hex.x)?.get(hex.y);
    const chest = this.chestHexes.get(hex.x)?.get(hex.y);

    return { army, structure, quest, chest };
  }

  // hexcoords is normalized
  protected onHexagonClick(hexCoords: HexPosition | null) {
    const overlay = document.querySelector(".shepherd-modal-is-visible");
    const overlayClick = document.querySelector(".allow-modal-click");
    if (overlay && !overlayClick) {
      return;
    }
    if (!hexCoords) return;

    const account = ContractAddress(useAccountStore.getState().account?.address || "");

    const { army, structure, quest, chest } = this.getHexagonEntity(hexCoords);
    const isMine = isAddressEqualToAccount(army?.owner || structure?.owner || 0n);
    this.handleHexSelection(hexCoords, isMine);

    if (army?.owner === account) {
      this.onArmySelection(army.id, account);
    } else if (structure?.owner === account) {
      this.onStructureSelection(structure.id, hexCoords);
    } else if (quest) {
      // Handle quest click
      this.clearEntitySelection();
    } else if (chest) {
      // Handle chest click - chests can be interacted with by anyone
      this.clearEntitySelection();
    } else {
      this.clearEntitySelection();
    }
  }

  protected handleHexSelection(hexCoords: HexPosition, isMine: boolean) {
    const contractHexPosition = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
    const position = getWorldPositionForHex(hexCoords);
    if (contractHexPosition.x !== this.state.selectedHex?.col || contractHexPosition.y !== this.state.selectedHex.row) {
      this.selectedHexManager.setPosition(position.x, position.z);
      this.state.setSelectedHex({
        col: contractHexPosition.x,
        row: contractHexPosition.y,
      });

      if (isMine) {
        if (this.state.isSoundOn) {
          AudioManager.getInstance().play("ui.click", { volume: this.state.effectsLevel / 100 });
        }
        // Note: Label filtering is now handled in entity selection methods
        // to avoid removing labels too aggressively on initial selection
      }
    }
  }

  protected onHexagonRightClick(event: MouseEvent, hexCoords: HexPosition | null): void {
    const overlay = document.querySelector(".shepherd-modal-overlay-container");
    const overlayClick = document.querySelector(".allow-modal-click");
    if (overlay && !overlayClick) {
      return;
    }

    // Check if account exists before allowing actions
    const account = useAccountStore.getState().account;

    if (!hexCoords) {
      return;
    }

    const { structure } = this.getHexagonEntity(hexCoords);
    const { selectedEntityId, actionPaths } = this.state.entityActions;
    const hasActiveEntityAction = Boolean(selectedEntityId && actionPaths.size > 0);

    const isMineStructure = structure?.owner !== undefined ? isAddressEqualToAccount(structure.owner) : false;

    if (structure && isMineStructure && !hasActiveEntityAction) {
      openStructureContextMenu({
        event,
        structure,
        hexCoords,
        components: this.dojo.components,
        isSoundOn: this.state.isSoundOn,
        effectsLevel: this.state.effectsLevel,
      });
      return;
    }

    if (selectedEntityId && actionPaths.size > 0 && hexCoords) {
      const actionPath = actionPaths.get(ActionPaths.posKey(hexCoords, true));
      if (actionPath && account) {
        const actionType = ActionPaths.getActionType(actionPath);

        // Only validate army availability for army-specific actions
        const armyActions = [ActionType.Explore, ActionType.Move, ActionType.Attack];
        const isArmySelection = this.armiesPositions.has(selectedEntityId);
        if (actionType && armyActions.includes(actionType) && isArmySelection) {
          if (this.armyManager && !this.armyManager.isArmySelectable(selectedEntityId)) {
            console.warn(`Army ${selectedEntityId} no longer available for movement`);
            this.clearEntitySelection();
            return;
          }
        }

        if (actionType === ActionType.Explore || actionType === ActionType.Move) {
          this.onArmyMovement(account, actionPath, selectedEntityId);
        } else if (actionType === ActionType.Attack) {
          this.onArmyAttack(actionPath, selectedEntityId);
        } else if (actionType === ActionType.Help) {
          this.onArmyHelp(actionPath, selectedEntityId);
        } else if (actionType === ActionType.Quest) {
          this.onQuestSelection(actionPath, selectedEntityId);
        } else if (actionType === ActionType.Chest) {
          this.onChestSelection(actionPath, selectedEntityId);
        } else if (actionType === ActionType.CreateArmy) {
          this.onArmyCreate(actionPath, selectedEntityId);
        }
      }
    }
  }

  private onArmyMovement(account: Account | AccountInterface, actionPath: ActionPath[], selectedEntityId: ID) {
    // can only move on explored hexes
    const isExplored = ActionPaths.getActionType(actionPath) === ActionType.Move;
    if (actionPath.length > 0) {
      const armyActionManager = new ArmyActionManager(this.dojo.components, this.dojo.systemCalls, selectedEntityId);
      if (this.state.isSoundOn) {
        AudioManager.getInstance().play("unit.march", { volume: this.state.effectsLevel / 100 });
      }

      // Get the target position for the effect
      const targetHex = actionPath[actionPath.length - 1].hex;
      const position = getWorldPositionForHex({
        col: targetHex.col - FELT_CENTER(),
        row: targetHex.row - FELT_CENTER(),
      });

      // Play effect based on action type: compass for exploring, travel for moving
      const key = `${targetHex.col},${targetHex.row}`;
      const effectType = isExplored ? "travel" : "compass";
      const effectLabel = isExplored ? "Traveling" : "Exploring";

      const existingEffect = this.travelEffects.get(key);
      if (existingEffect) {
        existingEffect();
        this.travelEffects.delete(key);
      }

      const { end } = this.fxManager.playFxAtCoords(
        effectType,
        position.x,
        position.y + 2.5,
        position.z,
        0.95,
        effectLabel,
        true,
      );

      // Store the end function with the hex coordinates as key
      this.travelEffects.set(key, end);

      const cleanup = () => {
        const endEffect = this.travelEffects.get(key);
        if (endEffect) {
          endEffect();
          this.travelEffects.delete(key);
        }
      };

      // Mark army as having pending movement transaction
      this.pendingArmyMovements.add(selectedEntityId);

      // Monitor memory usage before army movement action
      this.memoryMonitor?.getCurrentStats(`worldmap-moveArmy-start-${selectedEntityId}`);

      armyActionManager
        .moveArmy(account!, actionPath, isExplored, getBlockTimestamp().currentArmiesTick)
        .then(() => {
          // Transaction submitted successfully, cleanup visual effects
          cleanup();
          // Monitor memory usage after army movement completion
          this.memoryMonitor?.getCurrentStats(`worldmap-moveArmy-complete-${selectedEntityId}`);
        })
        .catch((e) => {
          // Transaction failed, remove from pending and cleanup
          this.pendingArmyMovements.delete(selectedEntityId);
          cleanup();
          console.error("Army movement failed:", e);
        });

      this.state.updateEntityActionHoveredHex(null);
    }
    // clear after movement
    this.clearSelection();
  }

  private onArmyAttack(actionPath: ActionPath[], selectedEntityId: ID) {
    const selectedPath = actionPath.map((path) => path.hex);

    const targetHex = selectedPath[selectedPath.length - 1];
    const target = this.getHexagonEntity(targetHex);
    const selected = this.getHexagonEntity(selectedPath[0]);

    const attackerSummary = {
      type: selected.army ? ActorType.Explorer : ActorType.Structure,
      id: selectedEntityId,
      hex: new Position({ x: selectedPath[0].col, y: selectedPath[0].row }).getContract(),
    };
    const targetSummary = {
      type: target.army ? ActorType.Explorer : ActorType.Structure,
      id: target.army?.id || target.structure?.id || 0,
      hex: new Position({ x: targetHex.col, y: targetHex.row }).getContract(),
    };

    this.state.toggleModal(<QuickAttackPreview attacker={attackerSummary} target={targetSummary} />);
  }

  private onArmyCreate(actionPath: ActionPath[], selectedEntityId: ID) {
    const selectedPath = actionPath.map((path) => path.hex);
    const targetHex = selectedPath[selectedPath.length - 1];
    const direction = getDirectionBetweenAdjacentHexes(
      { col: selectedPath[0].col, row: selectedPath[0].row },
      { col: targetHex.col, row: targetHex.row },
    );

    if (direction === undefined || direction === null) return;

    this.state.toggleModal(
      <UnifiedArmyCreationModal structureId={selectedEntityId} direction={direction} isExplorer={true} />,
    );
  }

  // actionPath is not normalized
  private onArmyHelp(actionPath: ActionPath[], selectedEntityId: ID) {
    const selectedPath = actionPath.map((path) => path.hex);
    const targetHex = selectedPath[selectedPath.length - 1];
    const selectedHex = selectedPath[0];
    const selected = this.getHexagonEntity(selectedHex);
    const target = this.getHexagonEntity(targetHex);
    const account = ContractAddress(useAccountStore.getState().account?.address || "");
    const isTargetMine = target.army?.owner === account || target.structure?.owner === account;
    const isSelectedMine = selected.army?.owner === account || selected.structure?.owner === account;

    this.state.toggleModal(
      <HelpModal
        selected={{
          type: selected.army ? ActorType.Explorer : ActorType.Structure,
          id: selectedEntityId,
          hex: new Position({ x: selectedHex.col, y: selectedHex.row }).getContract(),
        }}
        target={{
          type: target.army ? ActorType.Explorer : ActorType.Structure,
          id: target.army?.id || target.structure?.id || 0,
          hex: new Position({ x: targetHex.col, y: targetHex.row }).getContract(),
        }}
        allowBothDirections={isTargetMine && isSelectedMine}
      />,
    );
  }

  private onStructureSelection(selectedEntityId: ID, hexCoords?: HexPosition) {
    this.state.updateEntityActionSelectedEntityId(selectedEntityId);

    const structure = new StructureActionManager(this.dojo.components, selectedEntityId);

    const playerAddress = useAccountStore.getState().account?.address;

    if (!playerAddress) return;

    const actionPaths = structure.findActionPaths(this.armyHexes, this.exploredTiles, ContractAddress(playerAddress));

    this.state.updateEntityActionActionPaths(actionPaths.getPaths());

    this.highlightHexManager.highlightHexes(actionPaths.getHighlightedHexes());

    if (hexCoords) {
      void this.ensureStructureSynced(selectedEntityId, hexCoords);
      const contractPosition = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
      const worldMapPosition =
        Number.isFinite(Number(contractPosition?.x)) && Number.isFinite(Number(contractPosition?.y))
          ? { col: Number(contractPosition.x), row: Number(contractPosition.y) }
          : undefined;
      this.state.setStructureEntityId(selectedEntityId, {
        worldMapPosition,
        spectator: this.state.isSpectating,
      });
    }

    // Show selection pulse for the selected structure
    if (hexCoords) {
      const worldPos = getWorldPositionForHex(hexCoords);
      this.selectionPulseManager.showSelection(worldPos.x, worldPos.z, selectedEntityId);
      // Set structure-specific pulse colors (orange/gold for structures)
      this.selectionPulseManager.setPulseColor(
        new Color(1.0, 0.6, 0.2), // Orange base
        new Color(1.0, 0.9, 0.4), // Gold pulse
      );
    }

    const extraHexes: HexPosition[] = [];
    if (hexCoords) {
      extraHexes.push(hexCoords);
    }
    this.updateStructureOwnershipPulses(selectedEntityId, extraHexes);
  }

  private onArmySelection(selectedEntityId: ID, playerAddress: ContractAddress) {
    // Check if army has pending movement transactions
    if (this.pendingArmyMovements.has(selectedEntityId)) {
      return;
    }

    // Check if army is currently being rendered or is in chunk transition
    if (this.isChunkTransitioning) {
      const retrySelection = () => {
        if (this.armyManager.hasArmy(selectedEntityId)) {
          this.onArmySelection(selectedEntityId, playerAddress);
        } else {
          if (import.meta.env.DEV) {
            console.warn(`[DEBUG] Army ${selectedEntityId} not available after chunk switch`);
          }
        }
      };

      // Defer selection until chunk switch completes
      if (this.globalChunkSwitchPromise) {
        this.globalChunkSwitchPromise.then(retrySelection);
      } else {
        setTimeout(retrySelection, 0);
      }
      return;
    }

    // Ensure army is available for selection
    if (!this.armyManager.hasArmy(selectedEntityId)) {
      if (import.meta.env.DEV) {
        console.warn(`[DEBUG] Army ${selectedEntityId} not available in current chunk for selection`);
      }

      return;
    }

    this.state.updateEntityActionSelectedEntityId(selectedEntityId);

    const armyActionManager = new ArmyActionManager(this.dojo.components, this.dojo.systemCalls, selectedEntityId);

    const { currentDefaultTick, currentArmiesTick } = getBlockTimestamp();

    const actionPaths = armyActionManager.findActionPaths(
      this.structureHexes,
      this.armyHexes,
      this.exploredTiles,
      this.questHexes,
      this.chestHexes,
      currentDefaultTick,
      currentArmiesTick,
      playerAddress,
    );

    const paths = actionPaths.getPaths();
    const highlightedHexes = actionPaths.getHighlightedHexes();

    this.state.updateEntityActionActionPaths(paths);
    this.highlightHexManager.highlightHexes(highlightedHexes);

    // Show selection pulse for the selected army
    const selectedArmyData = this.armyManager
      .getArmies()
      .find((army) => Number(army.entityId) === Number(selectedEntityId));
    const armyPosition = this.armiesPositions.get(selectedEntityId);
    if (armyPosition) {
      const worldPos = getWorldPositionForHex(armyPosition);
      this.selectionPulseManager.showSelection(worldPos.x, worldPos.z, selectedEntityId);
      // Set army-specific pulse colors (blue/cyan for armies)
      this.selectionPulseManager.setPulseColor(
        new Color(0.2, 0.6, 1.0), // Blue base
        new Color(0.8, 1.0, 1.0), // Cyan pulse
      );
    } else {
      if (import.meta.env.DEV) {
        console.warn(`[DEBUG] No army position found for ${selectedEntityId} in armiesPositions map`);
      }
    }

    const extraHexes: HexPosition[] = [];
    if (armyPosition) {
      extraHexes.push(armyPosition);
    }

    const owningStructureId =
      selectedArmyData?.owningStructureId ?? this.armyStructureOwners.get(selectedEntityId) ?? null;

    this.updateStructureOwnershipPulses(owningStructureId ?? undefined, extraHexes);
  }

  // handle quest selection
  private onQuestSelection(actionPath: ActionPath[], selectedEntityId: ID) {
    const selectedPath = actionPath.map((path) => path.hex);

    // Get the target hex (last hex in the path)
    const targetHex = selectedPath[selectedPath.length - 1];

    this.state.toggleModal(
      <QuestModal
        explorerEntityId={selectedEntityId}
        targetHex={new Position({ x: targetHex.col, y: targetHex.row }).getContract()}
      />,
    );
  }

  private onChestSelection(actionPath: ActionPath[], selectedEntityId: ID) {
    const selectedPath = actionPath.map((path) => path.hex);

    // Get the target hex (last hex in the path)
    const targetHex = selectedPath[selectedPath.length - 1];

    this.state.toggleModal(
      <ChestModal
        selected={{
          type: ActorType.Explorer,
          id: selectedEntityId,
          hex: { x: targetHex.col, y: targetHex.row },
        }}
        chestHex={{ x: targetHex.col, y: targetHex.row }}
      />,
    );
  }

  private clearSelection() {
    this.selectedHexManager.resetPosition();
    this.state.setSelectedHex(null);
    this.clearEntitySelection();
  }

  private clearEntitySelection() {
    this.highlightHexManager.highlightHexes([]);
    this.state.updateEntityActionActionPaths(new Map());
    this.state.updateEntityActionSelectedEntityId(null);
    this.selectionPulseManager.hideSelection(); // Hide selection pulse
    this.selectionPulseManager.clearOwnershipPulses();
    this.armyManager.addLabelsToScene();
    this.structureManager.showLabels();
    this.questManager.addLabelsToScene();
    this.chestManager.addLabelsToScene();
  }

  private updateStructureOwnershipPulses(structureId: ID | undefined, extraHexes: HexPosition[] = []) {
    if (structureId === undefined || structureId === null) {
      this.selectionPulseManager.clearOwnershipPulses();
      return;
    }

    const colors = this.getStructurePulseColors(structureId);
    const positions: Array<{ x: number; z: number }> = [];
    const seenHexes = new Set<string>();

    const addHex = (hex: HexPosition | null | undefined) => {
      if (!hex) return;
      const key = `${hex.col},${hex.row}`;
      if (seenHexes.has(key)) {
        return;
      }
      seenHexes.add(key);
      const worldPos = getWorldPositionForHex(hex);
      positions.push({ x: worldPos.x, z: worldPos.z });
    };

    addHex(this.getStructureHexPosition(structureId));

    this.armyManager.getArmies().forEach((army) => {
      if (army.owningStructureId === structureId) {
        const normalized = army.hexCoords.getNormalized();
        addHex({ col: normalized.x, row: normalized.y });
      }
    });

    this.armyStructureOwners.forEach((ownerStructureId, armyId) => {
      if (ownerStructureId === structureId) {
        addHex(this.armiesPositions.get(armyId));
      }
    });

    extraHexes.forEach((hex) => addHex(hex));

    if (positions.length === 0) {
      this.selectionPulseManager.clearOwnershipPulses();
      return;
    }

    this.selectionPulseManager.showOwnershipPulses(positions, colors.base, colors.pulse);
  }

  private getStructurePulseColors(structureId: ID) {
    const key = structureId.toString();
    const cached = this.structurePulseColorCache.get(key);
    if (cached) {
      return cached;
    }

    const numericId = Number(structureId);
    const hue = (((numericId % 360) + 360) % 360) / 360;
    const base = new Color().setHSL(hue, 0.65, 0.4);
    const pulse = new Color().setHSL(hue, 0.65, 0.6);
    const colors = { base, pulse };
    this.structurePulseColorCache.set(key, colors);
    return colors;
  }

  private getStructureHexPosition(structureId: ID): HexPosition | null {
    const cached = this.structuresPositions.get(structureId);
    if (cached) {
      return cached;
    }

    for (const [col, rowMap] of this.structureHexes) {
      for (const [row, info] of rowMap) {
        if (info.id === structureId) {
          const hex = { col, row };
          this.structuresPositions.set(structureId, hex);
          return hex;
        }
      }
    }

    return null;
  }

  async setup() {
    this.controls.maxDistance = 40;
    this.camera.far = 65;
    this.camera.updateProjectionMatrix();
    this.configureWorldmapShadows();
    this.controls.enablePan = true;
    this.controls.enableZoom = useUIStore.getState().enableMapZoom;
    this.controls.zoomToCursor = false;
    this.highlightHexManager.setYOffset(0.025);

    // Configure thunder bolts for worldmap - dramatic storm effect
    this.getThunderBoltManager().setConfig({
      radius: 18, // Large spread across the visible area
      count: 6, // Many thunder bolts for dramatic effect
      duration: 400, // Medium duration for good visibility
      persistent: false, // Auto-fade for production use
      debug: false, // Disable logging for performance
    });

    useUIStore.getState().setLeftNavigationView(LeftView.None);

    if (!this.hasInitialized) {
      if (!this.initialSetupPromise) {
        this.initialSetupPromise = this.performInitialSetup();
      }
      try {
        await this.initialSetupPromise;
        this.hasInitialized = true;
      } finally {
        this.initialSetupPromise = null;
      }
    } else {
      await this.resumeWorldmapScene();
    }
  }

  private attachLabelGroupsToScene() {
    const groups = [this.armyLabelsGroup, this.structureLabelsGroup, this.questLabelsGroup, this.chestLabelsGroup];
    groups.forEach((group) => {
      if (!group.parent) {
        this.scene.add(group);
      }
    });
  }

  private async performInitialSetup() {
    this.clearTileEntityCache();
    this.moveCameraToURLLocation();
    this.attachLabelGroupsToScene();
    this.armyManager.addLabelsToScene();
    this.structureManager.showLabels();
    this.questManager.addLabelsToScene();
    this.chestManager.addLabelsToScene();
    this.registerStoreSubscriptions();
    this.setupCameraZoomHandler();
    try {
      await this.updateVisibleChunks(true);
    } catch (error) {
      console.error("Failed to update visible chunks during initial setup:", error);
    }

    // Fire-and-forget cosmetic asset preloading (non-blocking)
    preloadAllCosmeticAssets({
      onProgress: ({ loaded, total }) => {
        if (loaded === total) {
          console.log(`[Cosmetics] Preloaded ${total} cosmetic assets`);
        }
      },
    }).catch((error) => {
      console.warn("[Cosmetics] Some assets failed to preload:", error);
    });
  }

  private async resumeWorldmapScene() {
    this.moveCameraToURLLocation();
    this.attachLabelGroupsToScene();
    this.armyManager.addLabelsToScene();
    this.structureManager.showLabels();
    this.questManager.addLabelsToScene();
    this.chestManager.addLabelsToScene();
    this.registerStoreSubscriptions();
    this.setupCameraZoomHandler();
    try {
      // Force chunk refresh when resuming to ensure proper re-initialization
      // This fixes the bug where chunks don't load when switching back from Hexception view
      await this.updateVisibleChunks(true);
    } catch (error) {
      console.error("Failed to update visible chunks while resuming worldmap scene:", error);
    }
  }

  onSwitchOff() {
    this.cancelHexGridComputation?.();
    this.cancelHexGridComputation = undefined;

    this.disposeStoreSubscriptions();
    this.disposeWorldUpdateSubscriptions();
    this.toriiStreamManager?.shutdown();

    // Remove label groups from scene
    this.scene.remove(this.armyLabelsGroup);
    this.scene.remove(this.structureLabelsGroup);
    this.scene.remove(this.questLabelsGroup);
    this.scene.remove(this.chestLabelsGroup);

    // Clean up labels
    this.armyManager.removeLabelsFromScene();
    // console.debug("[WorldMap] Removing army labels from scene");
    this.structureManager.removeLabelsFromScene();
    // console.debug("[WorldMap] Removing structure labels from scene");
    this.questManager.removeLabelsFromScene();
    this.chestManager.removeLabelsFromScene();
    // console.debug("[WorldMap] Removing quest labels from scene");

    // Clear any pending army removals
    this.pendingArmyRemovals.forEach((timeout) => clearTimeout(timeout));
    this.pendingArmyRemovals.clear();
    this.pendingArmyRemovalMeta.clear();
    this.deferredChunkRemovals.clear();
    this.armyLastUpdateAt.clear();

    this.armyStructureOwners.clear();

    // Clean up wheel event listener
    if (this.wheelHandler) {
      const canvas = document.getElementById("main-canvas");
      if (canvas) {
        canvas.removeEventListener("wheel", this.wheelHandler);
      }
      this.wheelHandler = null;
    }
    this.resetWheelState();

    // Reset chunk state to ensure clean re-initialization when returning to world view
    this.currentChunk = "null";
    this.fetchedChunks.clear();
    this.pendingChunks.clear();
    this.pinnedChunkKeys.clear();
    this.pinnedRenderAreas.clear();

    // Note: Don't clean up shortcuts here - they should persist across scene switches
    // Shortcuts will be cleaned up when the scene is actually destroyed
  }

  public deleteArmy(entityId: ID, options: { playDefeatFx?: boolean } = {}) {
    const { playDefeatFx = true } = options;
    this.cancelPendingArmyRemoval(entityId);
    // console.debug(`[WorldMap] deleteArmy invoked for entity ${entityId}`);
    this.armyManager.removeArmy(entityId, { playDefeatFx });
    const oldPos = this.armiesPositions.get(entityId);
    if (oldPos) {
      this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
    } else {
      // Fallback: scan hex cache in case tracking was cleared before cleanup
      for (const rowMap of this.armyHexes.values()) {
        const entry = Array.from(rowMap.entries()).find(([, data]) => data.id === entityId);
        if (entry) {
          rowMap.delete(entry[0]);
          break;
        }
      }
    }
    this.armiesPositions.delete(entityId);
    this.armyLastUpdateAt.delete(entityId);
    this.pendingArmyRemovalMeta.delete(entityId);
    this.armyStructureOwners.delete(entityId);
    this.pendingArmyMovements.delete(entityId);
  }

  private scheduleArmyRemoval(entityId: ID, reason: "tile" | "zero" = "tile") {
    const existing = this.pendingArmyRemovals.get(entityId);
    if (existing) {
      clearTimeout(existing);
    }

    const hasPendingMovement = reason === "tile" && this.pendingArmyMovements.has(entityId);
    // Increased delays to allow tile updates to propagate properly
    // - tile removals now wait longer (1500ms instead of 600ms) to ensure movement updates arrive
    // - zero troop removals are immediate (0ms) since they're confirmed deaths
    const baseDelay = reason === "tile" ? 1500 : 0;
    const initialDelay = hasPendingMovement ? 3000 : baseDelay;
    const retryDelay = 500;
    const maxPendingWaitMs = 10000; // Increased from 8000ms to 10000ms

    // console.debug(
    //   `[WorldMap] Scheduling army removal for entity ${entityId} (reason: ${reason}, delay: ${initialDelay}ms, hasPendingMovement: ${hasPendingMovement})`,
    // );

    const scheduledAt = Date.now();
    this.pendingArmyRemovalMeta.set(entityId, {
      scheduledAt,
      chunkKey: this.currentChunk,
      reason,
    });

    const schedule = (delay: number) => {
      const timeout = setTimeout(() => {
        const meta = this.pendingArmyRemovalMeta.get(entityId);
        if (!meta) {
          this.pendingArmyRemovals.delete(entityId);
          return;
        }

        if (reason === "tile") {
          const lastUpdate = this.armyLastUpdateAt.get(entityId) ?? 0;
          if (lastUpdate > meta.scheduledAt) {
            // console.debug(
            //   `[WorldMap] Skipping removal for entity ${entityId} - newer tile data detected (${lastUpdate - meta.scheduledAt}ms delta)`,
            // );
            this.pendingArmyRemovalMeta.delete(entityId);
            this.pendingArmyRemovals.delete(entityId);
            return;
          }

          if (this.currentChunk !== meta.chunkKey) {
            // console.debug(
            //   `[WorldMap] Deferring tile-based removal for entity ${entityId} due to chunk switch (${meta.chunkKey} -> ${this.currentChunk})`,
            // );
            this.deferArmyRemovalDuringChunkSwitch(entityId, reason, meta.scheduledAt);
            return;
          }

          if (this.pendingArmyMovements.has(entityId)) {
            const elapsed = Date.now() - meta.scheduledAt;
            if (elapsed < maxPendingWaitMs) {
              // console.debug(
              //   `[WorldMap] Army ${entityId} still has pending movement, retrying removal in ${retryDelay}ms (elapsed: ${elapsed.toFixed(
              //     0,
              //   )}ms)`,
              // );
              schedule(retryDelay);
              return;
            }

            // console.warn(
            //   `[WorldMap] Pending movement timeout while removing entity ${entityId}, forcing cleanup after ${elapsed.toFixed(
            //     0,
            //   )}ms`,
            // );
            this.pendingArmyMovements.delete(entityId);
          }
        }

        this.pendingArmyRemovals.delete(entityId);
        this.pendingArmyRemovalMeta.delete(entityId);
        // console.debug(`[WorldMap] Finalizing pending removal for entity ${entityId} (reason: ${reason})`);
        const playDefeatFx = reason !== "tile";
        this.deleteArmy(entityId, { playDefeatFx });
      }, delay);

      this.pendingArmyRemovals.set(entityId, timeout);
    };

    schedule(initialDelay);
  }

  private deferArmyRemovalDuringChunkSwitch(entityId: ID, reason: "tile" | "zero", scheduledAt: number) {
    const timeout = this.pendingArmyRemovals.get(entityId);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingArmyRemovals.delete(entityId);
    }

    this.pendingArmyRemovalMeta.delete(entityId);
    this.deferredChunkRemovals.set(entityId, { reason, scheduledAt });
  }

  private retryDeferredChunkRemovals() {
    if (this.deferredChunkRemovals.size === 0) {
      return;
    }

    const deferred = Array.from(this.deferredChunkRemovals.entries());
    this.deferredChunkRemovals.clear();

    deferred.forEach(([entityId, { reason, scheduledAt }]) => {
      const lastUpdate = this.armyLastUpdateAt.get(entityId) ?? 0;
      if (lastUpdate > scheduledAt) {
        // console.debug(
        //   `[WorldMap] Skipping deferred removal for entity ${entityId} - newer tile data detected after chunk switch (${lastUpdate - scheduledAt}ms delta)`,
        // );
        return;
      }

      this.scheduleArmyRemoval(entityId, reason);
    });
  }

  private cancelPendingArmyRemoval(entityId: ID) {
    const timeout = this.pendingArmyRemovals.get(entityId);
    if (!timeout) return;

    clearTimeout(timeout);
    this.pendingArmyRemovals.delete(entityId);
    this.pendingArmyRemovalMeta.delete(entityId);
    this.deferredChunkRemovals.delete(entityId);
    // console.debug(`[WorldMap] Cancelled pending removal for entity ${entityId}`);
  }

  public deleteChest(entityId: ID) {
    this.chestManager.removeChest(entityId);
    // Find and remove from chestHexes
    this.chestHexes.forEach((rowMap) => {
      rowMap.forEach((hex, row) => {
        if (hex.id === entityId) {
          rowMap.delete(row);
        }
      });
    });
  }

  // used to track the position of the armies on the map
  public updateArmyHexes(update: {
    entityId: ID;
    hexCoords: HexPosition;
    ownerAddress?: bigint | undefined;
    ownerStructureId?: ID | null;
  }) {
    const {
      hexCoords: { col, row },
      ownerAddress,
      entityId,
      ownerStructureId,
    } = update;

    if (ownerAddress === undefined) {
      if (import.meta.env.DEV) {
        console.warn(`[DEBUG] Army ${entityId} has undefined owner address, skipping update`);
      }
      return;
    }

    if (ownerStructureId !== undefined && ownerStructureId !== null && ownerStructureId !== 0) {
      this.armyStructureOwners.set(entityId, ownerStructureId);
    } else {
      this.armyStructureOwners.delete(entityId);
    }

    let actualOwnerAddress = ownerAddress;
    if (ownerAddress === 0n) {
      if (import.meta.env.DEV) {
        console.warn(`[DEBUG] Army ${entityId} has zero owner address (0n) - army defeated/deleted`);
      }

      // Check if we already have this army with a valid owner
      const existingArmy = this.armiesPositions.has(entityId);
      if (existingArmy) {
        // Try to find existing army data in armyHexes to preserve owner
        for (const rowMap of this.armyHexes.values()) {
          for (const armyData of rowMap.values()) {
            if (armyData.id === entityId && armyData.owner !== 0n) {
              actualOwnerAddress = armyData.owner;
              break;
            }
          }
          if (actualOwnerAddress !== 0n) break;
        }

        // If we still have 0n owner, the army was defeated/deleted - clean up the cache
        if (actualOwnerAddress === 0n) {
          if (import.meta.env.DEV) {
            console.warn(`[DEBUG] Removing army ${entityId} from cache (0n owner indicates defeat/deletion)`);
          }
          const oldPos = this.armiesPositions.get(entityId);
          if (oldPos) {
            this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
            gameWorkerManager.updateArmyHex(oldPos.col, oldPos.row, null);
            this.invalidateAllChunkCachesContainingHex(oldPos.col, oldPos.row);
          }
          this.armiesPositions.delete(entityId);
          this.armyStructureOwners.delete(entityId);
          return;
        }
      }
    }

    const normalized = new Position({ x: col, y: row }).getNormalized();
    const newPos = { col: normalized.x, row: normalized.y };
    const oldPos = this.armiesPositions.get(entityId);

    // Update army position
    this.armiesPositions.set(entityId, newPos);
    this.armyLastUpdateAt.set(entityId, Date.now());

    // Remove from old position if it changed
    if (
      oldPos &&
      (oldPos.col !== newPos.col || oldPos.row !== newPos.row) &&
      this.armyHexes.get(oldPos.col)?.get(oldPos.row)?.id === entityId
    ) {
      this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
      gameWorkerManager.updateArmyHex(oldPos.col, oldPos.row, null);
      this.invalidateAllChunkCachesContainingHex(oldPos.col, oldPos.row);
    }

    // Add to new position
    if (!this.armyHexes.has(newPos.col)) {
      this.armyHexes.set(newPos.col, new Map());
    }

    const armyHexData = { id: entityId, owner: actualOwnerAddress };

    this.armyHexes.get(newPos.col)?.set(newPos.row, armyHexData);
    gameWorkerManager.updateArmyHex(newPos.col, newPos.row, armyHexData);
    this.invalidateAllChunkCachesContainingHex(newPos.col, newPos.row);

    // Remove from pending movements when position is updated from blockchain
    if (this.pendingArmyMovements.has(entityId)) {
      this.pendingArmyMovements.delete(entityId);
    }
  }

  public updateStructureHexes(update: {
    entityId: ID;
    hexCoords: HexPosition;
    owner: { address: bigint | undefined };
  }) {
    const {
      hexCoords: { col, row },
      owner: { address },
      entityId,
    } = update;

    if (address === undefined) return;
    const normalized = new Position({ x: col, y: row }).getNormalized();

    // Update structure position
    this.structuresPositions.set(entityId, { col: normalized.x, row: normalized.y });

    const newCol = normalized.x;
    const newRow = normalized.y;

    if (!this.structureHexes.has(newCol)) {
      this.structureHexes.set(newCol, new Map());
    }
    const structureInfo = { id: entityId, owner: address };
    this.structureHexes.get(newCol)?.set(newRow, structureInfo);
    gameWorkerManager.updateStructureHex(newCol, newRow, structureInfo);
  }

  // update quest hexes on the map
  public updateQuestHexes(update: QuestSystemUpdate) {
    const {
      hexCoords: { col, row },
      entityId,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();

    const newCol = normalized.x;
    const newRow = normalized.y;

    if (!this.questHexes.has(newCol)) {
      this.questHexes.set(newCol, new Map());
    }
    this.questHexes.get(newCol)?.set(newRow, { id: entityId, owner: 0n });
  }

  // update chest hexes on the map
  public updateChestHexes(update: ChestSystemUpdate) {
    const {
      hexCoords: { col, row },
      occupierId,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();

    const newCol = normalized.x;
    const newRow = normalized.y;

    if (!this.chestHexes.has(newCol)) {
      this.chestHexes.set(newCol, new Map());
    }
    this.chestHexes.get(newCol)?.set(newRow, { id: occupierId, owner: 0n });
  }

  public async updateExploredHex(update: TileSystemUpdate) {
    const { hexCoords, removeExplored, biome } = update;

    const normalized = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();

    const col = normalized.x;
    const row = normalized.y;

    // Check if there's a compass effect for this hex and end it
    const key = `${hexCoords.col},${hexCoords.row}`;
    const endCompass = this.travelEffects.get(key);
    if (endCompass) {
      endCompass();
      this.travelEffects.delete(key);
    }

    if (removeExplored) {
      const chunkRow = parseInt(this.currentChunk.split(",")[0]);
      const chunkCol = parseInt(this.currentChunk.split(",")[1]);
      this.exploredTiles.get(col)?.delete(row);
      this.removeCachedMatricesForChunk(chunkRow, chunkCol);
      this.removeCachedMatricesAroundChunk(chunkRow, chunkCol);
      this.currentChunk = "null"; // reset the current chunk to force a recomputation
      this.updateVisibleChunks().catch((error) => console.error("Failed to update visible chunks:", error));
      return;
    }

    if (!this.exploredTiles.has(col)) {
      this.exploredTiles.set(col, new Map());
    }
    if (!this.exploredTiles.get(col)!.has(row)) {
      this.exploredTiles.get(col)!.set(row, biome);
      gameWorkerManager.updateExploredTile(col, row, biome);
    } else {
      return;
    }

    const pos = getWorldPositionForHex({ row, col });

    const isStructure = this.structureManager.structureHexCoords.get(col)?.has(row) || false;
    const isQuest = this.questManager.questHexCoords.get(col)?.has(row) || false;
    const shouldHideTile = isStructure || isQuest;

    const renderedChunkStartRow = parseInt(this.currentChunk.split(",")[0]);
    const renderedChunkStartCol = parseInt(this.currentChunk.split(",")[1]);
    const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(
      renderedChunkStartRow,
      renderedChunkStartCol,
    );

    this.invalidateAllChunkCachesContainingHex(col, row);

    // if the hex is within the chunk, add it to the interactive hex manager and to the biome
    if (this.isColRowInVisibleChunk(col, row)) {
      await this.updateHexagonGridPromise;
      const chunkWidth = this.renderChunkSize.width;
      const chunkHeight = this.renderChunkSize.height;
      if (shouldHideTile) {
        await this.updateHexagonGrid(renderedChunkStartRow, renderedChunkStartCol, chunkHeight, chunkWidth);
        return;
      }

      // Add hex to all interactive hexes
      this.interactiveHexManager.addHex({ col, row });

      // Update which hexes are visible in the current chunk
      this.interactiveHexManager.updateVisibleHexes(chunkCenterRow, chunkCenterCol, chunkWidth, chunkHeight);

      await Promise.all(this.modelLoadPromises);
      dummy.position.copy(pos);
      dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);

      if (!IS_FLAT_MODE) {
        const rotationSeed = this.hashCoordinates(col, row);
        const rotationIndex = Math.floor(rotationSeed * 6);
        const randomRotation = (rotationIndex * Math.PI) / 3;
        dummy.rotation.y = randomRotation;
        dummy.position.y += 0.05;
      } else {
        dummy.position.y += 0.1;
        dummy.rotation.y = 0;
      }

      dummy.updateMatrix();

      const biomeVariant = getBiomeVariant(biome, col, row);
      const hexMesh = this.biomeModels.get(biomeVariant as BiomeType)!;
      const currentCount = hexMesh.getCount();
      hexMesh.setMatrixAt(currentCount, dummy.matrix);
      hexMesh.setCount(currentCount + 1);
      hexMesh.needsUpdate();

      // Cache the updated matrices for the chunk
      this.cacheMatricesForChunk(renderedChunkStartRow, renderedChunkStartCol);
    }
  }

  isColRowInVisibleChunk(col: number, row: number) {
    const startRow = parseInt(this.currentChunk.split(",")[0]);
    const startCol = parseInt(this.currentChunk.split(",")[1]);
    const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);

    const insideChunkBounds =
      col >= chunkCenterCol - this.renderChunkSize.width / 2 &&
      col <= chunkCenterCol + this.renderChunkSize.width / 2 &&
      row >= chunkCenterRow - this.renderChunkSize.height / 2 &&
      row <= chunkCenterRow + this.renderChunkSize.height / 2;

    if (!insideChunkBounds) {
      return false;
    }

    const worldPosition = getWorldPositionForHex({ col, row });
    return this.visibilityManager.isPointVisible(worldPosition);
  }

  private getSurroundingChunkKeys(centerRow: number, centerCol: number): string[] {
    const chunkKeys: string[] = [];

    for (let rowOffset = -this.chunkRowsAhead; rowOffset <= this.chunkRowsBehind; rowOffset++) {
      for (let colOffset = -this.chunkColsEachSide; colOffset <= this.chunkColsEachSide; colOffset++) {
        const row = centerRow + rowOffset * this.chunkSize;
        const col = centerCol + colOffset * this.chunkSize;
        chunkKeys.push(`${row},${col}`);
      }
    }

    return chunkKeys;
  }

  getChunksAround(chunkKey: string) {
    const startRow = parseInt(chunkKey.split(",")[0]);
    const startCol = parseInt(chunkKey.split(",")[1]);
    const chunks: string[] = [];
    const halfHeight = this.renderChunkSize.height / 2;
    const halfWidth = this.renderChunkSize.width / 2;
    for (let i = -halfHeight; i <= halfHeight; i += this.chunkSize) {
      for (let j = -halfWidth; j <= halfWidth; j += this.chunkSize) {
        const { x, z } = getWorldPositionForHex({ row: startRow + i, col: startCol + j });
        const { chunkX, chunkZ } = this.worldToChunkCoordinates(x, z);
        const _chunkKey = `${chunkZ * this.chunkSize},${chunkX * this.chunkSize}`;
        if (!chunks.includes(_chunkKey)) {
          chunks.push(_chunkKey);
        }
      }
    }
    return chunks;
  }

  removeCachedMatricesAroundChunk(chunkRow: number, chunkCol: number) {
    const halfHeight = this.renderChunkSize.height / 2;
    const halfWidth = this.renderChunkSize.width / 2;
    for (let i = -halfHeight; i <= halfHeight; i += this.chunkSize) {
      for (let j = -halfWidth; j <= halfWidth; j += this.chunkSize) {
        if (i === 0 && j === 0) {
          continue;
        }
        this.removeCachedMatricesForChunk(chunkRow + i, chunkCol + j);
      }
    }
  }

  /**
   * Derive a stable render-area key for a chunk key.
   * Key by chunk stride so every chunkKey maps 1:1 to fetch/cache buckets.
   */
  private getRenderAreaKeyForChunk(chunkKey: string): string {
    return chunkKey;
  }

  /**
   * Compute integer fetch bounds that fully cover the render area for a chunk key.
   */
  private getRenderFetchBounds(chunkKey: string): { minCol: number; maxCol: number; minRow: number; maxRow: number } {
    const [startRow, startCol] = chunkKey.split(",").map(Number);
    const { row: centerRow, col: centerCol } = this.getChunkCenter(startRow, startCol);
    const halfWidth = this.renderChunkSize.width / 2;
    const halfHeight = this.renderChunkSize.height / 2;

    return {
      minCol: Math.floor(centerCol - halfWidth),
      maxCol: Math.floor(centerCol + halfWidth - 1),
      minRow: Math.floor(centerRow - halfHeight),
      maxRow: Math.floor(centerRow + halfHeight - 1),
    };
  }

  private invalidateAllChunkCachesContainingHex(col: number, row: number) {
    const pos = getWorldPositionForHex({ row, col });
    const { chunkX, chunkZ } = this.worldToChunkCoordinates(pos.x, pos.z);

    const baseChunkCol = chunkX * this.chunkSize;
    const baseChunkRow = chunkZ * this.chunkSize;

    const chunksToInvalidate = [
      `${baseChunkRow},${baseChunkCol}`,
      `${baseChunkRow - this.chunkSize},${baseChunkCol - this.chunkSize}`,
      `${baseChunkRow - this.chunkSize},${baseChunkCol}`,
      `${baseChunkRow - this.chunkSize},${baseChunkCol + this.chunkSize}`,
      `${baseChunkRow},${baseChunkCol - this.chunkSize}`,
      `${baseChunkRow},${baseChunkCol + this.chunkSize}`,
      `${baseChunkRow + this.chunkSize},${baseChunkCol - this.chunkSize}`,
      `${baseChunkRow + this.chunkSize},${baseChunkCol}`,
      `${baseChunkRow + this.chunkSize},${baseChunkCol + this.chunkSize}`,
    ];

    for (const chunkKey of chunksToInvalidate) {
      const [chunkRowStr, chunkColStr] = chunkKey.split(",");
      const chunkRow = parseInt(chunkRowStr);
      const chunkCol = parseInt(chunkColStr);
      this.removeCachedMatricesForChunk(chunkRow, chunkCol);
    }
  }

  /**
   * Compute a forward chunk key based on camera movement to prefetch ahead.
   */
  private getForwardChunkKey(focusPoint: Vector3): string | null {
    const anchor = this.lastChunkSwitchPosition;
    if (!anchor) {
      return null;
    }

    const dx = focusPoint.x - anchor.x;
    const dz = focusPoint.z - anchor.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.01) {
      return null;
    }

    const primaryAxisIsX = Math.abs(dx) >= Math.abs(dz);
    const stepSign = primaryAxisIsX ? Math.sign(dx) : Math.sign(dz);
    if (stepSign === 0) {
      return null;
    }

    const strideWorldX = this.chunkSize * HEX_SIZE * Math.sqrt(3);
    const strideWorldZ = this.chunkSize * HEX_SIZE * 1.5;

    const aheadX = primaryAxisIsX ? focusPoint.x + stepSign * strideWorldX * 2 : focusPoint.x;
    const aheadZ = primaryAxisIsX ? focusPoint.z : focusPoint.z + stepSign * strideWorldZ * 2;

    const { chunkX, chunkZ } = this.worldToChunkCoordinates(aheadX, aheadZ);
    return `${chunkZ * this.chunkSize},${chunkX * this.chunkSize}`;
  }

  /**
   * Prefetch the chunk in front of the camera to reduce pop-in.
   */
  private prefetchDirectionalChunks(focusPoint: Vector3) {
    const forwardChunkKey = this.getForwardChunkKey(focusPoint);
    if (!forwardChunkKey) {
      return;
    }

    const forwardRowCol = forwardChunkKey.split(",").map(Number);
    const halfHeight = this.renderChunkSize.height / 2;
    const halfWidth = this.renderChunkSize.width / 2;
    const prefetchTargets = new Set<string>();

    // Prefetch a 2x3 band ahead centered on the forward chunk (two rows deep, three cols wide).
    for (let dz = 0; dz <= this.chunkSize * 2; dz += this.chunkSize) {
      for (let dx = -this.chunkSize; dx <= this.chunkSize; dx += this.chunkSize) {
        const row = forwardRowCol[0] + dz;
        const col = forwardRowCol[1] + dx;
        prefetchTargets.add(`${row},${col}`);
      }
    }

    prefetchTargets.forEach((chunkKey) => {
      // Skip if it's already pinned or current
      if (this.pinnedChunkKeys.has(chunkKey) || chunkKey === this.currentChunk) {
        return;
      }

      // Skip if already queued
      if (this.prefetchedAhead.includes(chunkKey)) {
        return;
      }

      this.prefetchedAhead.push(chunkKey);
      // Cap the prefetch list to avoid unbounded growth
      while (this.prefetchedAhead.length > this.maxPrefetchedAhead) {
        this.prefetchedAhead.shift();
      }

      // Fire off fetch; deduping handled by computeTileEntities caches
      this.computeTileEntities(chunkKey).catch((error) => {
        if (import.meta.env.DEV) {
          console.warn("[CHUNK PREFETCH] Failed to prefetch chunk", chunkKey, error);
        }
      });

      // Kick off structure refresh for the forward band to avoid late pop-in.
      this.refreshStructuresForChunks([chunkKey]).catch((error) => {
        if (import.meta.env.DEV) {
          console.warn("[CHUNK PREFETCH] Failed to prefetch structures for chunk", chunkKey, error);
        }
      });
    });
  }

  clearCache() {
    for (const chunkKey of this.cachedMatrices.keys()) {
      this.disposeCachedMatrices(chunkKey);
    }
    this.cachedMatrices.clear();
    this.cachedMatrixOrder = [];
    MatrixPool.getInstance().clear();
    InstancedMatrixAttributePool.getInstance().clear();
    this.pinnedChunkKeys.clear();
    if (this.currentChunk !== "null") {
      this.visibilityManager?.unregisterChunk(this.currentChunk);
    }
  }

  private scheduleHydratedChunkRefresh(chunkKey: string) {
    this.hydratedChunkRefreshes.add(chunkKey);
    if (this.hydratedRefreshScheduled) {
      return;
    }
    this.hydratedRefreshScheduled = true;
    Promise.resolve().then(() => this.flushHydratedChunkRefreshes());
  }

  private async flushHydratedChunkRefreshes() {
    this.hydratedRefreshScheduled = false;
    const targets = Array.from(this.hydratedChunkRefreshes);
    this.hydratedChunkRefreshes.clear();

    // Skip if chunk is currently transitioning - the chunk switch will handle manager updates
    if (this.isChunkTransitioning) {
      return;
    }

    if (this.globalChunkSwitchPromise) {
      try {
        await this.globalChunkSwitchPromise;
      } catch (error) {
        console.warn("Previous global chunk switch failed before hydrated refresh:", error);
      }
    }

    for (const chunkKey of targets) {
      if (chunkKey !== this.currentChunk) {
        continue;
      }
      try {
        await this.updateManagersForChunk(chunkKey, { force: true });
        this.hydratedChunkRefreshes.delete(chunkKey);
        this.retryDeferredChunkRemovals();
      } catch (error) {
        console.error(`[CHUNK SYNC] Hydrated chunk refresh failed for ${chunkKey}`, error);
      }
    }
  }

  private computeInteractiveHexes(startRow: number, startCol: number, width: number, height: number) {
    // Instead of clearing and recomputing all hexes, just update which ones are visible
    const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);
    this.interactiveHexManager.updateVisibleHexes(chunkCenterRow, chunkCenterCol, width, height);
  }

  async updateHexagonGrid(startRow: number, startCol: number, rows: number, cols: number) {
    this.cancelHexGridComputation?.();
    this.cancelHexGridComputation = undefined;

    const memoryMonitor = (window as { __gameRenderer?: { memoryMonitor?: MemoryMonitor } }).__gameRenderer
      ?.memoryMonitor;
    const preUpdateStats = memoryMonitor?.getCurrentStats(`hex-grid-update-${startRow}-${startCol}`);

    const matrixPoolInstance = MatrixPool.getInstance();
    const totalHexes = rows * cols;
    matrixPoolInstance.ensureCapacity(totalHexes + 512);

    await Promise.all(this.modelLoadPromises);
    if (this.applyCachedMatricesForChunk(startRow, startCol)) {
      this.computeInteractiveHexes(startRow, startCol, cols, rows);

      if (memoryMonitor && preUpdateStats) {
        const postStats = memoryMonitor.getCurrentStats(`hex-grid-cached-${startRow}-${startCol}`);
        const memoryDelta = postStats.heapUsedMB - preUpdateStats.heapUsedMB;
        if (Math.abs(memoryDelta) > 10) {
          // Keep hook for future instrumentation
        }
      }
      this.updateHexagonGridPromise = null;
      return;
    }

    const taskToken = Symbol("hex-grid-task");
    this.currentHexGridTask = taskToken;
    if (this.hexGridFrameHandle !== null) {
      cancelAnimationFrame(this.hexGridFrameHandle);
      this.hexGridFrameHandle = null;
    }

    const halfRows = rows / 2;
    const halfCols = cols / 2;
    const minBatch = Math.min(this.hexGridMinBatch, totalHexes);
    const maxBatch = Math.max(minBatch, Math.min(this.hexGridMaxBatch, totalHexes));
    const frameBudget = this.hexGridFrameBudgetMs;

    this.updateHexagonGridPromise = new Promise((resolve) => {
      const biomeHexes: Record<BiomeType | "Outline" | string, Matrix4[]> = {
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
        Outline: [],
      };

      let currentIndex = 0;
      let resolved = false;

      const tempMatrix = new Matrix4();
      const tempPosition = new Vector3();
      const rotationMatrix = new Matrix4();
      const matrixPool = matrixPoolInstance;
      const hexRadius = HEX_SIZE;
      const hexHeight = hexRadius * 2;
      const hexWidth = Math.sqrt(3) * hexRadius;
      const vertDist = hexHeight * 0.75;
      const horizDist = hexWidth;
      const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);

      this.computeTileEntities(this.currentChunk);

      const cleanupTask = () => {
        if (this.hexGridFrameHandle !== null) {
          cancelAnimationFrame(this.hexGridFrameHandle);
          this.hexGridFrameHandle = null;
        }
        if (this.currentHexGridTask === taskToken) {
          this.currentHexGridTask = null;
        }
      };

      const releaseAllMatrices = () => {
        let totalReleased = 0;
        Object.values(biomeHexes).forEach((matrices) => {
          matrices.forEach((matrix) => matrixPool.releaseMatrix(matrix));
          totalReleased += matrices.length;
        });
        (Object.keys(biomeHexes) as Array<keyof typeof biomeHexes>).forEach((key) => {
          biomeHexes[key].length = 0;
        });
        return totalReleased;
      };

      const resolveOnce = () => {
        if (!resolved) {
          resolved = true;
          this.cancelHexGridComputation = undefined;
          cleanupTask();
          resolve();
        }
      };

      const abortTask = () => {
        const released = releaseAllMatrices();
        if (released > 0 && import.meta.env.DEV) {
          console.log(`🔄 Released ${released} matrices back to pool (aborted)`);
        }
        resolveOnce();
      };

      this.cancelHexGridComputation = () => {
        abortTask();
      };

      const finalizeSuccess = () => {
        for (const [biome, matrices] of Object.entries(biomeHexes)) {
          const hexMesh = this.biomeModels.get(biome as BiomeType);

          if (!hexMesh) {
            if (matrices.length > 0) {
              console.error(`❌ Missing biome model for: ${biome}`);
              if (import.meta.env.DEV) {
                console.log(`Available biome models:`, Array.from(this.biomeModels.keys()));
              }
            }
            continue;
          }

          if (matrices.length === 0) {
            hexMesh.setCount(0);
            continue;
          }

          if (import.meta.env.DEV) {
            console.log(`✅ Applied ${matrices.length} ${biome} hexes`);
          }

          matrices.forEach((matrix, index) => {
            hexMesh.setMatrixAt(index, matrix);
          });
          hexMesh.setCount(matrices.length);
          hexMesh.needsUpdate();
        }

        this.cacheMatricesForChunk(startRow, startCol);
        this.interactiveHexManager.updateVisibleHexes(chunkCenterRow, chunkCenterCol, cols, rows);

        const biomeCountsSnapshot = Object.fromEntries(
          Object.entries(biomeHexes)
            .map(([key, value]) => [key, value.length])
            .filter(([, count]) => Number(count) > 0),
        );

        const released = releaseAllMatrices();
        if (import.meta.env.DEV) {
          console.log(`🔄 Released ${released} matrices back to pool`);
        }

        if (memoryMonitor && preUpdateStats) {
          const postStats = memoryMonitor.getCurrentStats(`hex-grid-generated-${startRow}-${startCol}`);
          const memoryDelta = postStats.heapUsedMB - preUpdateStats.heapUsedMB;
          const poolStats = matrixPool.getStats();
          if (import.meta.env.DEV) {
            console.log(
              `[HEX GRID] OPTIMIZED generation memory impact: ${memoryDelta.toFixed(1)}MB (${rows}x${cols} hexes)`,
            );
            console.log(
              `📊 Matrix Pool Stats: ${poolStats.available} available, ${poolStats.inUse} in use, ${poolStats.memoryEstimateMB.toFixed(1)}MB pool memory`,
            );
            console.log(`📊 Biome distribution:`, biomeCountsSnapshot);
          }

          if (memoryDelta > 15) {
            console.warn(`[HEX GRID] Unexpected memory usage: ${memoryDelta.toFixed(1)}MB`);
          } else if (import.meta.env.DEV) {
            console.log(`✅ [HEX GRID] Memory optimization successful! Saved ~${(82 - memoryDelta).toFixed(1)}MB`);
          }
        }

        resolveOnce();
      };

      const processCell = (index: number) => {
        const rowOffset = Math.floor(index / cols) - halfRows;
        const colOffset = (index % cols) - halfCols;

        const globalRow = chunkCenterRow + rowOffset;
        const globalCol = chunkCenterCol + colOffset;

        const rowOffsetValue = ((globalRow % 2) * Math.sign(globalRow) * horizDist) / 2;
        const baseX = globalCol * horizDist - rowOffsetValue;
        const baseZ = globalRow * vertDist;
        tempPosition.set(baseX, 0, baseZ);

        const isStructure = this.structureManager.structureHexCoords.get(globalCol)?.has(globalRow) || false;
        const isQuest = this.questManager.questHexCoords.get(globalCol)?.has(globalRow) || false;
        const shouldHideTile = isStructure || isQuest;
        const isExplored = this.exploredTiles.get(globalCol)?.get(globalRow) || false;

        this.interactiveHexManager.addHex({ col: globalCol, row: globalRow });

        if (shouldHideTile) {
          return;
        }

        tempMatrix.makeScale(HEX_SIZE, HEX_SIZE, HEX_SIZE);

        const rotationSeed = this.hashCoordinates(globalCol, globalRow);
        const rotationIndex = Math.floor(rotationSeed * 6);
        const randomRotation = (rotationIndex * Math.PI) / 3;

        if (!IS_FLAT_MODE) {
          tempPosition.y += 0.05;
          // rotationMatrix.makeRotationY(randomRotation);
          // tempMatrix.multiply(rotationMatrix);
        } else {
          tempPosition.y += 0.05;
        }

        if (isExplored) {
          const biome = isExplored as BiomeType;
          const biomeVariant = getBiomeVariant(biome, globalCol, globalRow);
          tempMatrix.setPosition(tempPosition);

          const pooledMatrix = matrixPool.getMatrix();
          pooledMatrix.copy(tempMatrix);
          biomeHexes[biomeVariant].push(pooledMatrix);
        } else {
          tempPosition.y = 0.01;
          tempMatrix.setPosition(tempPosition);

          const pooledMatrix = matrixPool.getMatrix();
          pooledMatrix.copy(tempMatrix);
          biomeHexes.Outline.push(pooledMatrix);
        }
      };

      const processFrame = () => {
        if (this.currentHexGridTask !== taskToken) {
          abortTask();
          return;
        }

        const frameStart = performance.now();
        let processedThisFrame = 0;

        while (currentIndex < totalHexes) {
          processCell(currentIndex);
          currentIndex += 1;
          processedThisFrame += 1;

          if (currentIndex >= totalHexes) {
            break;
          }

          if (processedThisFrame >= minBatch) {
            const elapsed = performance.now() - frameStart;
            if (elapsed >= frameBudget || processedThisFrame >= maxBatch) {
              break;
            }
          }
        }

        if (currentIndex < totalHexes) {
          this.hexGridFrameHandle = requestAnimationFrame(processFrame);
        } else {
          finalizeSuccess();
        }
      };

      this.hexGridFrameHandle = requestAnimationFrame(processFrame);
    });

    await this.updateHexagonGridPromise;
    this.updateHexagonGridPromise = null;
  }

  private updatePinnedChunks(newChunkKeys: string[]): void {
    const nextPinned = new Set(newChunkKeys);
    const prevPinned = this.pinnedChunkKeys;
    const newlyPinnedChunks: string[] = [];
    const removedPinnedChunks: string[] = [];

    // Compute render-area coverage for the new/old pinned sets
    const nextPinnedAreas = new Set<string>();
    nextPinned.forEach((chunkKey) => nextPinnedAreas.add(this.getRenderAreaKeyForChunk(chunkKey)));
    const prevPinnedAreas = this.pinnedRenderAreas;
    const newlyPinnedAreas: string[] = [];
    const removedPinnedAreas: string[] = [];

    nextPinnedAreas.forEach((areaKey) => {
      if (!prevPinnedAreas.has(areaKey)) {
        newlyPinnedAreas.push(areaKey);
      }
    });

    prevPinnedAreas.forEach((areaKey) => {
      if (!nextPinnedAreas.has(areaKey)) {
        removedPinnedAreas.push(areaKey);
      }
    });

    // Track which chunks became newly active so we can refresh their structures
    nextPinned.forEach((chunkKey) => {
      if (!prevPinned.has(chunkKey)) {
        newlyPinnedChunks.push(chunkKey);
      }
    });

    prevPinned.forEach((chunkKey) => {
      if (!nextPinned.has(chunkKey)) {
        removedPinnedChunks.push(chunkKey);
      }
    });

    // Drop cached tile data for render areas that are no longer covered
    removedPinnedAreas.forEach((areaKey) => {
      this.fetchedChunks.delete(areaKey);
      this.pendingChunks.delete(areaKey);
    });

    this.pinnedChunkKeys = nextPinned;
    this.pinnedRenderAreas = nextPinnedAreas;

    if (newlyPinnedChunks.length > 0) {
      this.refreshStructuresForChunks(newlyPinnedChunks);
    }

    removedPinnedChunks.forEach((chunkKey) => {
      if (chunkKey !== this.currentChunk) {
        this.visibilityManager?.unregisterChunk(chunkKey);
      }
    });
  }

  private addWorldUpdateSubscription(unsub: any) {
    if (typeof unsub === "function") {
      this.worldUpdateUnsubscribes.push(unsub);
    }
  }

  private disposeWorldUpdateSubscriptions() {
    this.worldUpdateUnsubscribes.forEach((unsub) => {
      try {
        unsub();
      } catch (error) {
        console.warn("[WorldmapScene] Failed to unsubscribe world update listener", error);
      }
    });
    this.worldUpdateUnsubscribes = [];
  }

  private async refreshStructuresForChunks(chunkKeys: string[]): Promise<void> {
    const toriiClient = this.dojo.network?.toriiClient;
    const contractComponents = this.dojo.network?.contractComponents;

    if (!toriiClient || !contractComponents) {
      return;
    }

    const structuresToSync: { entityId: ID; position: HexPosition }[] = [];
    const seen = new Set<ID>();

    chunkKeys.forEach((chunkKey) => {
      const { minRow, maxRow, minCol, maxCol } = this.getRenderFetchBounds(chunkKey);

      this.structuresPositions.forEach((pos, entityId) => {
        if (seen.has(entityId)) {
          return;
        }
        if (pos.col >= minCol && pos.col <= maxCol && pos.row >= minRow && pos.row <= maxRow) {
          const contractCoords = new Position({ x: pos.col, y: pos.row }).getContract();
          structuresToSync.push({
            entityId,
            position: { col: contractCoords.x, row: contractCoords.y },
          });
          seen.add(entityId);
        }
      });
    });

    if (structuresToSync.length === 0) {
      return;
    }

    try {
      const typedContractComponents = contractComponents as any;
      await getStructuresDataFromTorii(toriiClient, typedContractComponents, structuresToSync);
    } catch (error) {
      console.error("[WorldmapScene] Failed to refresh structures for chunks", chunkKeys, error);
    }
  }

  private beginToriiFetch() {
    if (this.toriiLoadingCounter === 0) {
      this.state.setLoading(LoadingStateKey.Map, true);
    }
    this.toriiLoadingCounter += 1;
  }

  private endToriiFetch() {
    if (this.toriiLoadingCounter === 0) {
      return;
    }

    this.toriiLoadingCounter -= 1;
    if (this.toriiLoadingCounter === 0) {
      this.state.setLoading(LoadingStateKey.Map, false);
    }
  }

  private async computeTileEntities(chunkKey: string): Promise<void> {
    const fetchKey = this.getRenderAreaKeyForChunk(chunkKey);
    if (this.fetchedChunks.has(fetchKey)) {
      return;
    }

    const existingPromise = this.pendingChunks.get(fetchKey);
    if (existingPromise) {
      return existingPromise;
    }

    const { minCol, maxCol, minRow, maxRow } = this.getRenderFetchBounds(chunkKey);

    if (import.meta.env.DEV) {
      console.log(
        "[RENDER FETCH]",
        { chunkKey, fetchKey },
        `cols: ${minCol}-${maxCol}`,
        `rows: ${minRow}-${maxRow}`,
        "fetched chunks",
        this.fetchedChunks,
      );
    }

    const fetchPromise = this.executeTileEntitiesFetch(fetchKey, chunkKey, minCol, maxCol, minRow, maxRow);
    this.pendingChunks.set(fetchKey, fetchPromise);

    return fetchPromise;
  }

  private async executeTileEntitiesFetch(
    fetchKey: string,
    chunkKey: string,
    minCol: number,
    maxCol: number,
    minRow: number,
    maxRow: number,
  ): Promise<void> {
    this.beginToriiFetch();
    try {
      await getMapFromToriiExact(
        this.dojo.network.toriiClient,
        this.dojo.network.contractComponents as unknown as Parameters<typeof getMapFromToriiExact>[1],
        minCol + FELT_CENTER(),
        maxCol + FELT_CENTER(),
        minRow + FELT_CENTER(),
        maxRow + FELT_CENTER(),
      );
      // Only add to the fetched cache if the render area is still pinned (still relevant)
      if (this.pinnedRenderAreas.has(fetchKey)) {
        this.fetchedChunks.add(fetchKey);
        if (chunkKey === this.currentChunk && !this.isChunkTransitioning) {
          this.scheduleHydratedChunkRefresh(chunkKey);
        }
      }
    } catch (error) {
      console.error("Error fetching tile entities:", error);
      // Don't add to fetchedChunks on error so it can be retried
    } finally {
      // Always remove from pending chunks
      this.pendingChunks.delete(fetchKey);
      this.endToriiFetch();
      //const end = performance.now();
    }
  }

  private touchMatrixCache(chunkKey: string) {
    const existingIndex = this.cachedMatrixOrder.indexOf(chunkKey);
    if (existingIndex !== -1) {
      this.cachedMatrixOrder.splice(existingIndex, 1);
    }
    this.cachedMatrixOrder.push(chunkKey);
  }

  private disposeCachedMatrices(chunkKey: string) {
    const cached = this.cachedMatrices.get(chunkKey);
    if (!cached) return;

    cached.forEach(({ matrices }) => {
      if (matrices) {
        this.releaseInstancedAttribute(matrices);
      }
    });
  }

  private releaseInstancedAttribute(attribute: InstancedBufferAttribute) {
    InstancedMatrixAttributePool.getInstance().release(attribute);
  }

  private ensureMatrixCacheLimit() {
    if (this.cachedMatrixOrder.length <= this.maxMatrixCacheSize) {
      return;
    }

    let safetyCounter = this.cachedMatrixOrder.length;
    while (this.cachedMatrixOrder.length > this.maxMatrixCacheSize && safetyCounter > 0) {
      safetyCounter--;
      const oldestKey = this.cachedMatrixOrder.shift();
      if (!oldestKey) {
        break;
      }

      if (this.pinnedChunkKeys.has(oldestKey)) {
        this.cachedMatrixOrder.push(oldestKey);
        continue;
      }

      this.disposeCachedMatrices(oldestKey);
      this.cachedMatrices.delete(oldestKey);
    }

    if (this.cachedMatrixOrder.length > this.maxMatrixCacheSize) {
      console.warn(
        `[CACHE] Unable to evict matrices below limit because pinned chunks exceed capacity (${this.maxMatrixCacheSize})`,
      );
    }
  }

  private cacheMatricesForChunk(startRow: number, startCol: number) {
    const chunkKey = `${startRow},${startCol}`;
    if (!this.cachedMatrices.has(chunkKey)) {
      this.cachedMatrices.set(chunkKey, new Map());
    }

    const cachedChunk = this.cachedMatrices.get(chunkKey)!;

    const { box, sphere } = this.computeChunkBounds(startRow, startCol);
    for (const [biome, model] of this.biomeModels) {
      const existing = cachedChunk.get(biome);
      if (existing) {
        if (existing.matrices) {
          this.releaseInstancedAttribute(existing.matrices);
        }
      }
      const { matrices, count } = model.getMatricesAndCount();
      if (count === 0) {
        this.releaseInstancedAttribute(matrices);
        cachedChunk.set(biome, { matrices: null, count });
        continue;
      }
      cachedChunk.set(biome, { matrices, count });
    }

    cachedChunk.set("__bounds__", {
      matrices: null as InstancedBufferAttribute | null,
      count: 0,
      box,
      sphere,
    });

    this.touchMatrixCache(chunkKey);
    this.ensureMatrixCacheLimit();
  }

  removeCachedMatricesForChunk(startRow: number, startCol: number) {
    const chunkKey = `${startRow},${startCol}`;
    this.disposeCachedMatrices(chunkKey);
    this.cachedMatrices.delete(chunkKey);
    const index = this.cachedMatrixOrder.indexOf(chunkKey);
    if (index !== -1) {
      this.cachedMatrixOrder.splice(index, 1);
    }
  }

  private applyCachedMatricesForChunk(startRow: number, startCol: number) {
    const chunkKey = `${startRow},${startCol}`;
    const cachedMatrices = this.cachedMatrices.get(chunkKey);
    if (cachedMatrices) {
      const bounds = cachedMatrices.get("__bounds__");
      if (bounds?.box && !this.visibilityManager.isBoxVisible(bounds.box)) {
        return false;
      }
      this.touchMatrixCache(chunkKey);
      for (const [biome, { matrices, count }] of cachedMatrices) {
        if (biome === "__bounds__") {
          continue;
        }
        const hexMesh = this.biomeModels.get(biome as BiomeType)!;
        if (matrices) {
          hexMesh.setMatricesAndCount(matrices, count);
        } else {
          hexMesh.setCount(count);
        }
      }
      this.ensureMatrixCacheLimit();
      return true;
    }
    return false;
  }

  private computeChunkBounds(startRow: number, startCol: number) {
    const { minCol, maxCol, minRow, maxRow } = getRenderBounds(
      startRow,
      startCol,
      this.renderChunkSize,
      this.chunkSize,
    );
    const corners = [
      getWorldPositionForHex({ col: minCol, row: minRow }),
      getWorldPositionForHex({ col: minCol, row: maxRow }),
      getWorldPositionForHex({ col: maxCol, row: minRow }),
      getWorldPositionForHex({ col: maxCol, row: maxRow }),
    ];

    const box = new Box3().setFromPoints(corners);
    box.min.y = -1;
    box.max.y = 5;

    const sphere = new Sphere();
    box.getBoundingSphere(sphere);

    return { box, sphere };
  }

  private updateCurrentChunkBounds(startRow: number, startCol: number) {
    const bounds = this.computeChunkBounds(startRow, startCol);
    this.currentChunkBounds = bounds;
    this.biomeModels.forEach((biome) => biome.setWorldBounds(bounds));
    this.structureManager.setChunkBounds(bounds);

    // Register chunk bounds with centralized visibility manager
    const chunkKey = `${startRow},${startCol}`;
    this.visibilityManager?.registerChunk(chunkKey, bounds);
  }

  private worldToChunkCoordinates(x: number, z: number): { chunkX: number; chunkZ: number } {
    const chunkX = Math.floor(x / (this.chunkSize * HEX_SIZE * Math.sqrt(3)));
    const chunkZ = Math.floor(z / (this.chunkSize * HEX_SIZE * 1.5));
    return { chunkX, chunkZ };
  }

  private shouldDelayChunkSwitch(cameraPosition: Vector3): boolean {
    if (!this.hasChunkSwitchAnchor || !this.lastChunkSwitchPosition) {
      return false;
    }

    const chunkWorldWidth = this.chunkSize * HEX_SIZE * Math.sqrt(3);
    const chunkWorldDepth = this.chunkSize * HEX_SIZE * 1.5;
    const dx = Math.abs(cameraPosition.x - this.lastChunkSwitchPosition.x);
    const dz = Math.abs(cameraPosition.z - this.lastChunkSwitchPosition.z);

    return dx < chunkWorldWidth * this.chunkSwitchPadding && dz < chunkWorldDepth * this.chunkSwitchPadding;
  }

  private getChunkCenter(startRow: number, startCol: number): { row: number; col: number } {
    return getChunkCenterAligned(startRow, startCol, this.chunkSize);
  }

  private getCameraGroundIntersection(): Vector3 {
    const camera = this.controls.object;
    const origin = this.cameraPositionScratch.copy(camera.position as Vector3);
    const direction = this.cameraDirectionScratch.copy(this.controls.target).sub(origin);

    if (Math.abs(direction.y) < 0.001) {
      return this.cameraGroundIntersectionScratch.copy(this.controls.target);
    }

    const t = -origin.y / direction.y;
    if (!Number.isFinite(t) || t < 0) {
      return this.cameraGroundIntersectionScratch.copy(this.controls.target);
    }

    this.cameraGroundIntersectionScratch.copy(direction.multiplyScalar(t)).add(origin);
    return this.cameraGroundIntersectionScratch;
  }

  public requestChunkRefresh(force: boolean = false) {
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
      void this.updateVisibleChunks(shouldForce);
    }, this.chunkRefreshDebounceMs);
  }

  async updateVisibleChunks(force: boolean = false): Promise<boolean> {
    // Wait for any ongoing global chunk switch to complete first
    if (this.globalChunkSwitchPromise) {
      try {
        await this.globalChunkSwitchPromise;
      } catch (error) {
        console.warn(`Previous global chunk switch failed:`, error);
      }
    }

    // Ensure visibility state is fresh before computing chunk visibility
    this.visibilityManager?.beginFrame();

    const focusPoint = this.getCameraGroundIntersection().clone();

    const { chunkX, chunkZ } = this.worldToChunkCoordinates(focusPoint.x, focusPoint.z);
    const startCol = chunkX * this.chunkSize;
    const startRow = chunkZ * this.chunkSize;
    const chunkKey = `${startRow},${startCol}`;

    const chunkChanged = this.currentChunk !== chunkKey;

    if (!force && chunkChanged && this.shouldDelayChunkSwitch(focusPoint)) {
      return false;
    }

    // Proactively prefetch the forward chunk while staying in the current one to hide pop-in.
    this.prefetchDirectionalChunks(focusPoint);

    if (chunkChanged) {
      // Create and track the global chunk switch promise
      this.isChunkTransitioning = true;
      this.globalChunkSwitchPromise = this.performChunkSwitch(chunkKey, startCol, startRow, force, focusPoint.clone());

      try {
        await this.globalChunkSwitchPromise;
        this.retryDeferredChunkRemovals();
        return true;
      } finally {
        this.globalChunkSwitchPromise = null;
        this.isChunkTransitioning = false;
      }
    }

    if (force) {
      this.globalChunkSwitchPromise = this.refreshCurrentChunk(chunkKey, startCol, startRow);
      try {
        await this.globalChunkSwitchPromise;
        this.retryDeferredChunkRemovals();
        return true;
      } finally {
        this.globalChunkSwitchPromise = null;
      }
    }

    return false;
  }

  private async performChunkSwitch(
    chunkKey: string,
    startCol: number,
    startRow: number,
    force: boolean,
    switchPosition?: Vector3,
  ) {
    // Track memory usage during chunk switch
    const memoryMonitor = (window as { __gameRenderer?: { memoryMonitor?: MemoryMonitor } }).__gameRenderer
      ?.memoryMonitor;
    const preChunkStats = memoryMonitor?.getCurrentStats(`chunk-switch-pre-${chunkKey}`);

    // Clear any existing selections to prevent interaction during switch
    this.clearEntitySelection();

    const oldChunk = this.currentChunk;
    this.currentChunk = chunkKey;
    this.updateCurrentChunkBounds(startRow, startCol);
    if (oldChunk && oldChunk !== chunkKey) {
      this.visibilityManager?.unregisterChunk(oldChunk);
    }

    // Kick off data fetches for deterministic ordering
    const structureFetchPromise = this.refreshStructuresForChunks([chunkKey]).catch((error) => {
      console.error("[WorldmapScene] Structure fetch failed:", error);
    });
    const tileFetchPromise = this.computeTileEntities(chunkKey).catch((error) => {
      console.error("[WorldmapScene] Tile fetch failed:", error);
    });

    // Don't await - this is also async but not critical for initial render
    void this.updateToriiStreamBoundsForChunk(startRow, startCol);

    if (force) {
      this.removeCachedMatricesForChunk(startRow, startCol);
    }

    // Load surrounding chunks for better UX (3x3 grid)
    const surroundingChunks = this.getSurroundingChunkKeys(startRow, startCol);
    this.updatePinnedChunks(surroundingChunks);

    // Start loading all surrounding chunks (they will deduplicate automatically)
    surroundingChunks.forEach((chunk) => this.computeTileEntities(chunk));

    // Calculate the starting position for the new chunk - this is the main visual update
    await this.updateHexagonGrid(startRow, startCol, this.renderChunkSize.height, this.renderChunkSize.width);

    // Update which interactive hexes are visible in the new chunk
    const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);
    this.interactiveHexManager.updateVisibleHexes(
      chunkCenterRow,
      chunkCenterCol,
      this.renderChunkSize.width,
      this.renderChunkSize.height,
    );

    // Wait for core data (tiles + structures) before updating managers to avoid empty renders
    await Promise.all([structureFetchPromise, tileFetchPromise]);
    this.hydratedChunkRefreshes.delete(chunkKey);

    // If user navigated away during fetch, skip updating this chunk
    if (this.currentChunk !== chunkKey) {
      return;
    }

    // Ensure visibility state is fresh before manager renders
    this.visibilityManager?.forceUpdate();

    // Update all managers concurrently once shared prerequisites are ready
    await this.updateManagersForChunk(chunkKey, { force });

    // Track memory usage after chunk switch
    if (memoryMonitor) {
      const postChunkStats = memoryMonitor.getCurrentStats(`chunk-switch-post-${chunkKey}`);
      if (preChunkStats && postChunkStats) {
        const memoryDelta = postChunkStats.heapUsedMB - preChunkStats.heapUsedMB;
        if (import.meta.env.DEV) {
          // console.log(
          //   `[CHUNK SYNC] Chunk switch memory impact: ${memoryDelta > 0 ? "+" : ""}${memoryDelta.toFixed(1)}MB`,
          // );
        }

        if (Math.abs(memoryDelta) > 20) {
          // console.warn(`[CHUNK SYNC] Large memory change during chunk switch: ${memoryDelta.toFixed(1)}MB`);
        }
      }
    }

    if (switchPosition) {
      this.lastChunkSwitchPosition = switchPosition;
      this.hasChunkSwitchAnchor = true;
    }
  }

  private async updateToriiStreamBoundsForChunk(startRow: number, startCol: number) {
    if (!this.toriiStreamManager) {
      return;
    }

    const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);
    const halfWidth = this.renderChunkSize.width / 2;
    const halfHeight = this.renderChunkSize.height / 2;

    const bounds = {
      minCol: chunkCenterCol - halfWidth + FELT_CENTER(),
      maxCol: chunkCenterCol + halfWidth + FELT_CENTER(),
      minRow: chunkCenterRow - halfHeight + FELT_CENTER(),
      maxRow: chunkCenterRow + halfHeight + FELT_CENTER(),
      padding: this.renderChunkSize.width,
      // models intentionally omitted while streaming is disabled
    };

    // Streaming is currently disabled; keep bounds calculation for future re-enable.
    void bounds;
  }

  private async refreshCurrentChunk(chunkKey: string, startCol: number, startRow: number) {
    const memoryMonitor = (window as { __gameRenderer?: { memoryMonitor?: MemoryMonitor } }).__gameRenderer
      ?.memoryMonitor;
    const preChunkStats = memoryMonitor?.getCurrentStats(`chunk-refresh-pre-${chunkKey}`);

    this.updateCurrentChunkBounds(startRow, startCol);

    // Start deterministic data fetches
    const structureFetchPromise = this.refreshStructuresForChunks([chunkKey]).catch((error) => {
      console.error("[WorldmapScene] Background structure refresh failed:", error);
    });
    const tileFetchPromise = this.computeTileEntities(chunkKey).catch((error) => {
      console.error("[WorldmapScene] Tile refresh failed:", error);
    });

    const surroundingChunks = this.getSurroundingChunkKeys(startRow, startCol);
    this.updatePinnedChunks(surroundingChunks);
    surroundingChunks.forEach((chunk) => this.computeTileEntities(chunk));

    await this.updateHexagonGrid(startRow, startCol, this.renderChunkSize.height, this.renderChunkSize.width);

    const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);
    this.interactiveHexManager.updateVisibleHexes(
      chunkCenterRow,
      chunkCenterCol,
      this.renderChunkSize.width,
      this.renderChunkSize.height,
    );

    // Wait for data before updating managers
    await Promise.all([structureFetchPromise, tileFetchPromise]);
    this.hydratedChunkRefreshes.delete(chunkKey);

    await this.updateManagersForChunk(chunkKey, { force: true });

    if (memoryMonitor) {
      const postChunkStats = memoryMonitor.getCurrentStats(`chunk-refresh-post-${chunkKey}`);
      if (preChunkStats && postChunkStats) {
        const memoryDelta = postChunkStats.heapUsedMB - preChunkStats.heapUsedMB;
        if (import.meta.env.DEV) {
          console.log(
            `[CHUNK SYNC] Chunk refresh memory impact: ${memoryDelta > 0 ? "+" : ""}${memoryDelta.toFixed(1)}MB`,
          );
        }

        if (Math.abs(memoryDelta) > 20) {
          // console.warn(`[CHUNK SYNC] Large memory change during chunk refresh: ${memoryDelta.toFixed(1)}MB`);
        }
      }
    }
  }

  private async updateManagersForChunk(chunkKey: string, options?: { force?: boolean }) {
    const updateTasks = [
      { label: "army", promise: this.armyManager.updateChunk(chunkKey, options) },
      { label: "structure", promise: this.structureManager.updateChunk(chunkKey, options) },
      { label: "quest", promise: this.questManager.updateChunk(chunkKey, options) },
      { label: "chest", promise: this.chestManager.updateChunk(chunkKey, options) },
    ];

    const results = await Promise.allSettled(updateTasks.map((task) => task.promise));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`[CHUNK SYNC] ${updateTasks[index].label} manager failed for chunk ${chunkKey}`, result.reason);
      }
    });

    if (import.meta.env.DEV) {
      const debugFetchKey = this.getRenderAreaKeyForChunk(chunkKey);
      console.info("[CHUNK DEBUG]", {
        currentChunk: this.currentChunk,
        fetchKey: debugFetchKey,
        visible: {
          armies: this.armyManager.getVisibleCount(),
          structures: this.structureManager.getVisibleCount(),
          quests: this.questManager.getVisibleCount(),
          chests: this.chestManager.getVisibleCount(),
        },
        pendingFetches: this.pendingChunks.size,
      });
    }
  }

  update(deltaTime: number) {
    const animationContext = this.getAnimationVisibilityContext();
    super.update(deltaTime);
    this.armyManager.update(deltaTime);
    this.fxManager.update(deltaTime);
    this.selectedHexManager.update(deltaTime);
    this.structureManager.updateAnimations(deltaTime, animationContext);
    this.chestManager.update(deltaTime);
    this.updateCameraTargetHexThrottled?.();
  }

  protected override shouldUpdateBiomeAnimations(): boolean {
    if (!this.currentChunkBounds) {
      return true;
    }
    return this.visibilityManager.isBoxVisible(this.currentChunkBounds.box);
  }

  protected override onBiomeModelLoaded(model: InstancedBiome): void {
    if (this.currentChunkBounds) {
      model.setWorldBounds(this.currentChunkBounds);
    }
  }

  public clearTileEntityCache() {
    this.fetchedChunks.clear();
    this.pendingChunks.clear();
    this.pinnedRenderAreas.clear();
    this.clearCache();
    this.armyLastUpdateAt.clear();
    // Also clear the interactive hexes when clearing the entire cache
    this.interactiveHexManager.clearHexes();
  }

  /**
   * Handle relic effect updates from the game system
   * @param update The relic effect update containing entity ID and array of relic effects
   * @param relicSource Optional source of the relic effects (for structures)
   */
  private async handleRelicEffectUpdate(update: RelicEffectSystemUpdate, relicSource?: RelicSource) {
    const { entityId, relicEffects } = update;

    let entityFound = false;

    // Check if this is an army entity
    if (this.armyManager.hasArmy(entityId)) {
      // Convert RelicEffectWithEndTick to the format expected by updateRelicEffects
      const { currentArmiesTick } = getBlockTimestamp();
      const newEffects = relicEffects.map((relicEffect) => ({
        relicNumber: relicEffect.id,
        effect: {
          start_tick: currentArmiesTick,
          end_tick: relicEffect.endTick,
          usage_left: 1,
        },
      }));

      await this.armyManager.updateRelicEffects(entityId, newEffects);
      entityFound = true;
    }

    // Check if this is a structure entity
    if (!entityFound && relicSource) {
      const structureHexes = this.structureManager.structures.getStructures();
      for (const [, structures] of structureHexes) {
        if (structures.has(entityId)) {
          // Convert RelicEffectWithEndTick to the format expected by updateRelicEffects
          const { currentArmiesTick } = getBlockTimestamp();
          const newEffects = relicEffects.map((relicEffect) => ({
            relicNumber: relicEffect.id,
            effect: {
              start_tick: currentArmiesTick,
              end_tick: relicEffect.endTick,
              usage_left: 1,
            },
          }));

          await this.structureManager.updateRelicEffects(entityId, newEffects, relicSource);
          entityFound = true;
          break;
        }
      }
    }

    // If entity is not currently loaded, store as pending effects
    if (!entityFound) {
      // Get or create the entity's pending effects map
      let entityPendingMap = this.pendingRelicEffects.get(entityId);
      if (!entityPendingMap) {
        entityPendingMap = new Map();
        this.pendingRelicEffects.set(entityId, entityPendingMap);
      }

      // Determine the source for pending effects
      const pendingSource = relicSource || RelicSource.Guard;

      // Clear existing pending effects for this entity/source and add new ones
      if (relicEffects.length > 0) {
        const pendingRelicsSet = new Set<{ relicResourceId: number; effect: RelicEffect }>();
        for (const relicEffect of relicEffects) {
          pendingRelicsSet.add({
            relicResourceId: relicEffect.id,
            effect: {
              end_tick: relicEffect.endTick,
              usage_left: 1,
            },
          });
        }
        entityPendingMap.set(pendingSource, pendingRelicsSet);
      } else {
        entityPendingMap.delete(pendingSource);
        // If no sources have pending effects, remove the entity
        if (entityPendingMap.size === 0) {
          this.pendingRelicEffects.delete(entityId);
        }
      }
    } else {
      // Update pending effects store even for loaded entities to keep it in sync
      // Get or create the entity's pending effects map
      let entityPendingMap = this.pendingRelicEffects.get(entityId);
      if (!entityPendingMap) {
        entityPendingMap = new Map();
        this.pendingRelicEffects.set(entityId, entityPendingMap);
      }

      const pendingSource = relicSource || RelicSource.Guard;

      if (relicEffects.length > 0) {
        const pendingRelicsSet = new Set<{ relicResourceId: number; effect: RelicEffect }>();
        for (const relicEffect of relicEffects) {
          pendingRelicsSet.add({
            relicResourceId: relicEffect.id,
            effect: {
              end_tick: relicEffect.endTick,
              usage_left: 1,
            },
          });
        }
        entityPendingMap.set(pendingSource, pendingRelicsSet);
      } else {
        entityPendingMap.delete(pendingSource);
        // If no sources have pending effects, remove the entity
        if (entityPendingMap.size === 0) {
          this.pendingRelicEffects.delete(entityId);
        }
      }
    }
  }

  /**
   * Apply all pending relic effects for an entity (called when entity is loaded)
   */
  private async applyPendingRelicEffects(entityId: ID) {
    const entityPendingMap = this.pendingRelicEffects.get(entityId);
    if (!entityPendingMap || entityPendingMap.size === 0) return;

    // Check if this is an army entity
    if (this.armyManager.hasArmy(entityId)) {
      try {
        // For armies, combine all pending effects (they don't have sources)
        const allPendingRelics: { relicResourceId: number; effect: RelicEffect }[] = [];
        for (const pendingRelics of entityPendingMap.values()) {
          allPendingRelics.push(...Array.from(pendingRelics));
        }

        // Convert pending relics to array format for updateRelicEffects
        const relicEffectsArray = allPendingRelics.map((pendingRelic) => ({
          relicNumber: pendingRelic.relicResourceId,
          effect: pendingRelic.effect,
        }));

        await this.armyManager.updateRelicEffects(entityId, relicEffectsArray);
      } catch (error) {
        console.error(`Failed to apply pending relic effects to army ${entityId}:`, error);
      }
      return;
    }

    // Check if this is a structure entity
    const structureHexes = this.structureManager.structures.getStructures();
    for (const [, structures] of structureHexes) {
      if (structures.has(entityId)) {
        try {
          // For structures, apply effects per source
          for (const [relicSource, pendingRelics] of entityPendingMap) {
            // Convert pending relics to array format for updateRelicEffects
            const relicEffectsArray = Array.from(pendingRelics).map((pendingRelic) => ({
              relicNumber: pendingRelic.relicResourceId,
              effect: pendingRelic.effect,
            }));

            await this.structureManager.updateRelicEffects(entityId, relicEffectsArray, relicSource);
            console.log(
              `Applied ${relicEffectsArray.length} pending relic effects to structure: entityId=${entityId}, source=${relicSource}`,
            );
          }
        } catch (error) {
          console.error(`Failed to apply pending relic effects to structure ${entityId}:`, error);
        }
        return;
      }
    }
  }

  /**
   * Clear all pending relic effects for an entity (called when entity is removed)
   */
  private clearPendingRelicEffects(entityId: ID) {
    const entityPendingMap = this.pendingRelicEffects.get(entityId);
    if (entityPendingMap) {
      let totalEffects = 0;
      for (const pendingRelics of entityPendingMap.values()) {
        totalEffects += pendingRelics.size;
      }
      console.log(
        `Cleared ${totalEffects} pending relic effects for entity ${entityId} from ${entityPendingMap.size} sources`,
      );
      this.pendingRelicEffects.delete(entityId);
    }
  }

  destroy() {
    if (this.chunkRefreshTimeout !== null) {
      clearTimeout(this.chunkRefreshTimeout);
      this.chunkRefreshTimeout = null;
    }
    if (this.hexGridFrameHandle !== null) {
      cancelAnimationFrame(this.hexGridFrameHandle);
      this.hexGridFrameHandle = null;
    }
    this.currentHexGridTask = null;

    this.disposeStoreSubscriptions();
    this.disposeWorldUpdateSubscriptions();

    this.resourceFXManager.destroy();
    this.updateCameraTargetHexThrottled?.cancel();
    this.minimapCameraMoveThrottled?.cancel();
    this.controls.removeEventListener("change", this.handleControlsChangeForMinimap);
    window.removeEventListener("minimapCameraMove", this.minimapCameraMoveHandler as EventListener);
    window.removeEventListener("minimapZoom", this.minimapZoomHandler as EventListener);
    this.stopRelicValidationTimer();
    this.clearCache();

    // Clean up selection pulse manager
    this.selectionPulseManager.dispose();

    // Clean up chunk integration
    this.chunkIntegration?.destroy();

    if (this.visibilityChangeHandler) {
      document.removeEventListener("visibilitychange", this.visibilityChangeHandler);
      this.visibilityChangeHandler = undefined;
    }

    super.destroy();
  }

  // NOTE: Chunk integration system is disabled for performance.
  // The methods below are kept for future use if advanced chunk lifecycle debugging is needed.
  // Uncomment initializeChunkIntegration() in constructor and these methods to re-enable.
  //
  // private initializeChunkIntegration(): void {
  //   const toriiClient = this.dojo.network?.toriiClient;
  //   const contractComponents = this.dojo.network?.contractComponents;
  //
  //   if (!toriiClient || !contractComponents) {
  //     console.warn("[WorldmapScene] Cannot initialize chunk integration - missing Torii client or components");
  //     return;
  //   }
  //
  //   import("@/three/chunk-system").then(({ createChunkIntegration, EntityType }) => {
  //     this.chunkIntegration = createChunkIntegration(
  //       {
  //         toriiClient,
  //         contractComponents: contractComponents as any,
  //         structurePositions: this.structuresPositions,
  //         chunkSize: this.chunkSize,
  //         renderChunkSize: this.renderChunkSize,
  //         debug: import.meta.env.DEV,
  //       },
  //       {
  //         structureManager: this.structureManager,
  //         armyManager: this.armyManager,
  //         questManager: this.questManager,
  //         chestManager: this.chestManager,
  //       },
  //     );
  //     (this as any)._chunkEntityType = EntityType;
  //     if (import.meta.env.DEV) {
  //       console.log("[WorldmapScene] Chunk integration initialized");
  //     }
  //   }).catch((error) => {
  //     console.error("[WorldmapScene] Failed to initialize chunk integration:", error);
  //   });
  // }
  //
  // private notifyChunkEntityHydrated(entityId: ID, entityType: string): void {
  //   if (!this.chunkIntegration) return;
  //   const EntityType = (this as any)._chunkEntityType;
  //   if (!EntityType) return;
  //   const type = EntityType[entityType as keyof typeof EntityType];
  //   if (type !== undefined) {
  //     this.chunkIntegration.notifyEntityHydrated(entityId, type);
  //   }
  // }

  /**
   * Display a resource gain/loss effect at a hex position
   * @param resourceId The resource ID from ResourcesIds
   * @param amount Amount of resource (positive for gain, negative for loss)
   * @param col Hex column
   * @param row Hex row
   * @param text Optional text to display below the resource
   */
  public displayResourceGain(
    resourceId: number,
    amount: number,
    col: number,
    row: number,
    text?: string,
  ): Promise<void> {
    return this.resourceFXManager.playResourceFx(resourceId, amount, col, row, text, { duration: 3.0 });
  }

  /**
   * Display multiple resource changes in sequence
   * @param resources Array of resource changes to display
   * @param col Hex column
   * @param row Hex row
   */
  public displayMultipleResources(
    resources: Array<{ resourceId: number; amount: number; text?: string }>,
    col: number,
    row: number,
  ): Promise<void> {
    return this.resourceFXManager.playMultipleResourceFx(resources, col, row);
  }

  /**
   * Start the periodic relic effect validation timer
   */
  private startRelicValidationTimer() {
    // Clear any existing timer
    this.stopRelicValidationTimer();

    // Set up new timer to run every 5 seconds
    this.relicValidationInterval = setInterval(() => {
      this.validateActiveRelicEffects();
    }, 5000);
  }

  /**
   * Stop the periodic relic effect validation timer
   */
  private stopRelicValidationTimer() {
    if (this.relicValidationInterval) {
      clearInterval(this.relicValidationInterval);
      this.relicValidationInterval = null;
    }
  }

  /**
   * Validate all currently displayed relic effects and remove inactive ones
   */
  private async validateActiveRelicEffects() {
    try {
      const { currentArmiesTick } = getBlockTimestamp();
      let removedCount = 0;

      // Validate army relic effects
      const armies = this.armyManager.getArmies();
      for (const army of armies) {
        const currentRelics = this.armyManager.getArmyRelicEffects(army.entityId);
        if (currentRelics.length > 0) {
          // Filter out inactive relics
          const activeRelics = currentRelics.filter((relic) => isRelicActive(relic.effect, currentArmiesTick));

          // If some relics were removed, update the effects
          if (activeRelics.length < currentRelics.length) {
            const removedThisArmy = currentRelics.length - activeRelics.length;

            await this.armyManager.updateRelicEffects(
              army.entityId,
              activeRelics.map((r) => ({ relicNumber: r.relicId, effect: r.effect })),
            );
            removedCount += removedThisArmy;
          }
        }
      }

      // Validate structure relic effects
      const structureHexes = this.structureManager.structures.getStructures();
      for (const [, structures] of structureHexes) {
        for (const [entityId] of structures) {
          const currentRelics = this.structureManager.getStructureRelicEffects(entityId);
          if (currentRelics.length > 0) {
            // Filter out inactive relics
            const activeRelics = currentRelics.filter((relic) => isRelicActive(relic.effect, currentArmiesTick));

            // If some relics were removed, update the effects
            if (activeRelics.length < currentRelics.length) {
              const removedThisStructure = currentRelics.length - activeRelics.length;
              console.log(
                `Removing ${removedThisStructure} inactive relic effect(s) from structure: entityId=${entityId}`,
              );
              // For validation, we need to update each source separately
              // Get effects by source and update them
              for (const source of [RelicSource.Guard, RelicSource.Production]) {
                const sourceRelics = this.structureManager.getStructureRelicEffectsBySource(entityId, source);
                if (sourceRelics.length > 0) {
                  const activeSourceRelics = sourceRelics.filter((relic) =>
                    isRelicActive(relic.effect, currentArmiesTick),
                  );
                  if (activeSourceRelics.length < sourceRelics.length) {
                    await this.structureManager.updateRelicEffects(
                      entityId,
                      activeSourceRelics.map((r) => ({ relicNumber: r.relicId, effect: r.effect })),
                      source,
                    );
                  }
                }
              }
              removedCount += removedThisStructure;
            }
          }
        }
      }

      if (removedCount > 0 && import.meta.env.DEV) {
        console.debug(`[Relic Effects] Removed ${removedCount} stale relic instances during validation`);
      }
    } catch (error) {
      console.error("Error during relic effect validation:", error);
    }
  }

  private async selectNextArmy(): Promise<void> {
    if (this.selectableArmies.length === 0) return;
    const account = ContractAddress(useAccountStore.getState().account?.address || "");

    // Find the next army that doesn't have a pending movement transaction
    let attempts = 0;
    while (attempts < this.selectableArmies.length) {
      this.armyIndex = (this.armyIndex + 1) % this.selectableArmies.length;
      const army = this.selectableArmies[this.armyIndex];

      // Skip armies with pending movement transactions
      if (!this.pendingArmyMovements.has(army.entityId)) {
        const normalizedPosition = new Position({ x: army.position.col, y: army.position.row }).getNormalized();
        // Use 0 duration for instant camera teleportation
        this.moveCameraToColRow(normalizedPosition.x, normalizedPosition.y, 0);

        try {
          await this.updateVisibleChunks();
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error(
              `[WorldMap] Failed to update visible chunks while cycling armies (entityId=${army.entityId}):`,
              error,
            );
          }
        }

        // army.position is already in contract coordinates, pass it directly
        // handleHexSelection will normalize it internally when calling getHexagonEntity
        this.handleHexSelection(army.position, true);
        this.onArmySelection(army.entityId, account);
        this.state.setLeftNavigationView(LeftView.EntityView);
        break;
      }
      attempts++;
    }
    // If all armies have pending movements, do nothing
  }

  private updateSelectableArmies(armies: SelectableArmy[]) {
    this.selectableArmies = armies;
    if (this.armyIndex >= armies.length) {
      this.armyIndex = 0;
    }
  }

  private registerStoreSubscriptions() {
    if (this.storeSubscriptions.length > 0) {
      return;
    }

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.selectableArmies,
        (selectableArmies) => {
          this.updateSelectableArmies(selectableArmies);
        },
      ),
    );

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.playerStructures,
        (playerStructures) => {
          this.updatePlayerStructures(playerStructures);
        },
      ),
    );

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.entityActions,
        (armyActions) => {
          this.state.entityActions = armyActions;
        },
      ),
    );

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.selectedHex,
        (selectedHex) => {
          this.state.selectedHex = selectedHex;
        },
      ),
    );

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.isSoundOn,
        (isSoundOn) => {
          this.state.isSoundOn = isSoundOn;
        },
      ),
    );

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.effectsLevel,
        (effectsLevel) => {
          this.state.effectsLevel = effectsLevel;
        },
      ),
    );

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.enableMapZoom,
        (enableMapZoom) => {
          if (this.controls) {
            this.controls.enableZoom = enableMapZoom;
          }
        },
      ),
    );

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.entityActions.selectedEntityId,
        (selectedEntityId) => {
          if (!selectedEntityId) this.clearEntitySelection();
        },
      ),
    );

    this.syncStateFromStore();
  }

  private disposeStoreSubscriptions() {
    if (this.storeSubscriptions.length === 0) {
      return;
    }

    this.storeSubscriptions.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn("[WorldMap] Failed to unsubscribe store listener", error);
      }
    });
    this.storeSubscriptions = [];
  }

  private syncStateFromStore() {
    const uiState = useUIStore.getState();

    this.updateSelectableArmies(uiState.selectableArmies);
    this.updatePlayerStructures(uiState.playerStructures);

    this.state.entityActions = uiState.entityActions;
    this.state.selectedHex = uiState.selectedHex;
    this.state.isSoundOn = uiState.isSoundOn;
    this.state.effectsLevel = uiState.effectsLevel;

    if (this.controls) {
      this.controls.enableZoom = uiState.enableMapZoom;
    }

    const selectedEntityId = uiState.entityActions.selectedEntityId;
    if (!selectedEntityId) {
      this.clearEntitySelection();
    } else {
      this.state.updateEntityActionSelectedEntityId(selectedEntityId);
    }
  }

  private updatePlayerStructures(structures: Structure[]) {
    this.playerStructures = structures;
    if (this.structureIndex >= structures.length) {
      this.structureIndex = 0;
    }
  }

  private selectNextStructure() {
    this.structureIndex = utilSelectNextStructure(this.playerStructures, this.structureIndex, "map");
    if (this.playerStructures.length > 0) {
      const structure = this.playerStructures[this.structureIndex];
      // structure.position is in contract coordinates, pass it directly
      // handleHexSelection will normalize it internally when calling getHexagonEntity
      this.handleHexSelection({ col: structure.position.x, row: structure.position.y }, true);
      this.onStructureSelection(structure.entityId, { col: structure.position.x, row: structure.position.y });
      // Set the structure entity ID in the UI store
      const worldMapPosition = { col: Number(structure.position.x), row: Number(structure.position.y) };
      this.state.setStructureEntityId(structure.entityId, {
        worldMapPosition,
        spectator: this.state.isSpectating,
      });
      const normalizedPosition = new Position({ x: structure.position.x, y: structure.position.y }).getNormalized();
      // Use 0 duration for instant camera teleportation
      this.moveCameraToColRow(normalizedPosition.x, normalizedPosition.y, 0);
    }
  }

  protected shouldEnableStormEffects(): boolean {
    // Disable storm effects for worldmap scene
    return true;
  }

  /**
   * Add a new combat relationship
   */
  private addCombatRelationship(attackerId: ID, defenderId: ID) {
    this.battleDirectionManager.addCombatRelationship(attackerId, defenderId);
  }

  /**
   * Recalculate arrow directions for a specific entity
   */
  private recalculateArrowsForEntity(entityId: ID) {
    // console.log(`[RECALCULATE ARROWS FOR ENTITY] Recalculating arrows for entity ${entityId}`);
    this.battleDirectionManager.recalculateArrowsForEntity(entityId);
  }

  /**
   * Recalculate arrows for all entities that have relationships with the given entity
   */
  private recalculateArrowsForEntitiesRelatedTo(entityId: ID) {
    this.battleDirectionManager.recalculateArrowsForEntitiesRelatedTo(entityId);
  }

  /**
   * Remove entity from tracking when it's destroyed
   */
  private removeEntityFromTracking(entityId: ID) {
    // Remove from position tracking
    this.armiesPositions.delete(entityId);
    this.structuresPositions.delete(entityId);

    // Remove from battle direction relationships
    this.battleDirectionManager.removeEntityFromTracking(entityId);
  }
}
