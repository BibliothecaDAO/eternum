import { AudioManager } from "@/audio/core/AudioManager";
import { toast } from "sonner";

import { ensureStructureSynced, getMapFromToriiExact } from "@/dojo/queries";
import { initializeSyncSimulator } from "@/dojo/sync-simulator";
import { ToriiStreamManager, type BoundsDescriptor, type BoundsModelConfig } from "@/dojo/torii-stream-manager";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { getBiomeVariant, HEX_SIZE, WORLD_CHUNK_CONFIG } from "@/three/constants";
import { ArmyManager } from "@/three/managers/army-manager";
import { BattleDirectionManager } from "@/three/managers/battle-direction-manager";
import { ChestManager } from "@/three/managers/chest-manager";
import InstancedBiome from "@/three/managers/instanced-biome";
import { LAND_NAME } from "@/three/managers/instanced-model";
import { SelectedHexManager } from "@/three/managers/selected-hex-manager";
import { SelectionPulseManager } from "@/three/managers/selection-pulse-manager";
import { StructureManager } from "@/three/managers/structure-manager";
import { SceneManager } from "@/three/scene-manager";
import { CameraView } from "@/three/scenes/hexagon-scene";
import { CAMERA_CONFIG } from "@/three/constants";
import { WorldmapPerfSimulation } from "@/three/scenes/worldmap-perf-simulation";
import { playResourceSound } from "@/three/sound/utils";
import { LeftView } from "@/types";
import { Position } from "@bibliothecadao/eternum";
import { gameWorkerManager } from "../../managers/game-worker-manager";

import type { ToriiStreamManager as ToriiStreamManagerType } from "@/dojo/torii-stream-manager";
import { FELT_CENTER, IS_FLAT_MODE } from "@/ui/config";
import { ChestModal, HelpModal } from "@/ui/features/military";
import { QuickAttackPreview } from "@/ui/features/military/battle/quick-attack-preview";
import { SetupResult } from "@bibliothecadao/dojo";
import {
  ActionPath,
  ActionPaths,
  ActionType,
  ArmyActionManager,
  BattleEventSystemUpdate,
  ChestSystemUpdate,
  ExplorerRewardSystemUpdate,
  ExplorerTroopsTileSystemUpdate,
  getBlockTimestamp,
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
  ResourcesIds,
  Structure,
  StructureType,
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
  Plane,
  Raycaster,
  Sphere,
  Vector2,
  Vector3,
} from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { env } from "../../../env";
import { playerCosmeticsStore, preloadAllCosmeticAssets } from "../cosmetics";
import { FXManager } from "../managers/fx-manager";
import { HoverLabelManager } from "../managers/hover-label-manager";
import { ResourceFXManager } from "../managers/resource-fx-manager";
import { resolveHoverVisualPalette, resolveSelectionPulsePalette } from "../managers/worldmap-interaction-palette";
import { SceneName } from "../types/common";
import { getWorldPositionForHex, isAddressEqualToAccount } from "../utils";
import {
  getChunkKeysContainingHexInRenderBoundsAnalytically,
  getChunkCenter as getChunkCenterAligned,
  getRenderBounds,
} from "../utils/chunk-geometry";
import { InstancedMatrixAttributePool } from "../utils/instanced-matrix-attribute-pool";
import { MatrixPool } from "../utils/matrix-pool";
import { MemoryMonitor } from "../utils/memory-monitor";
import {
  navigateToStructure,
  toggleMapHexView,
  selectNextStructure as utilSelectNextStructure,
} from "../utils/navigation";
import { snapshotRendererFxCapabilities } from "../renderer-fx-capabilities";
import { SceneShortcutManager } from "../utils/shortcuts";
import { createWorldmapInteractionAdapter } from "./worldmap-interaction-adapter";
import { resolveWorldmapHexClickPlan } from "./worldmap-selection-routing";
import { getMinEffectCleanupDelayMs } from "./travel-effect";
import {
  resolveArmyTabSelectionPosition,
  resolvePendingArmyMovementFallbackPlan,
  resolvePendingArmyMovementSelectionPlan,
  shouldQueueArmySelectionRecovery,
} from "./worldmap-army-tab-selection";
import { shouldPlayArmyMovementFx } from "./worldmap-movement-fx-policy";
import { resolveExploreCompletionPendingClearPlan, type TravelEffectType } from "./worldmap-travel-effect-policy";
import { findSupersededArmyRemoval } from "./worldmap-army-removal";
import { resolveAttachedArmyOwnerFromStructure } from "./worldmap-attached-army-owner-sync";
import { resolveArmyActionPathOrigin } from "./worldmap-action-path-origin";
import { resolveOwnershipPulseHexes } from "./worldmap-ownership-pulse-policy";
import {
  resolveDuplicateTileReconcilePlan,
  resolveRefreshCompletionActions,
  resolveRefreshExecutionPlan,
  resolveRefreshRunningActions,
  resolveEntityActionPathLookup,
  resolveEntityActionPathsTransitionTokenForForcedRefresh,
  resolveEntityActionPathsTransitionTokenSync,
  resolvePendingChunkRefreshUiReason,
  shouldRequestTileRefreshForStructureBoundsChange,
  shouldClearEntitySelectionForChunkSwitch,
  shouldHoldShortcutArmySelectionProtection,
  shouldClearEntitySelectionForEntityActionTransition,
  shouldClearEntitySelectionForMissingActionPathOwnership,
  shouldForceShortcutNavigationRefresh,
  shouldRunShortcutForceFallback,
  shouldRunManagerUpdate,
  resolveHydratedChunkRefreshFlushPlan,
  shouldScheduleHydratedChunkRefreshForFetch,
  shouldForceChunkRefreshForZoomDistanceChange,
  waitForChunkTransitionToSettle,
} from "./worldmap-chunk-transition";
import { createWorldmapChunkPolicy } from "./worldmap-chunk-policy";
import {
  createWorldmapZoomHardeningConfig,
  evaluateChunkVisibilityAnomaly,
  evaluateTerrainVisibilityAnomaly,
  resetWorldmapZoomHardeningRuntimeState,
} from "./worldmap-zoom-hardening";
import { WorldmapZoomCoordinator } from "./worldmap-zoom/worldmap-zoom-coordinator";
import { WORLDMAP_STEP_WHEEL_DELTA, normalizeWorldmapWheelDelta } from "./worldmap-zoom/worldmap-zoom-input-normalizer";
import {
  createWorldmapZoomRefreshPlannerState,
  planWorldmapZoomRefresh,
} from "./worldmap-zoom/worldmap-zoom-refresh-planner";
import type { WorldmapCameraSnapshot, WorldmapZoomAnchor } from "./worldmap-zoom/worldmap-zoom-types";
import { resolveStructureTileUpdateActions } from "./worldmap-structure-update-policy";
import {
  WORLDMAP_GENERIC_FORCED_REFRESH_DEBOUNCE_MS,
  resolveWorldmapChunkRefreshDebounceMs,
  resolveWorldmapChunkRefreshSchedule,
  shouldDelayWorldmapChunkSwitch,
} from "./worldmap-chunk-switch-delay-policy";
import { classifyWorldmapUploadWork, resolveWorldmapPostCommitWorkAction } from "./worldmap-upload-budget-policy";
import { resolveChunkReversalRefreshDecision } from "./worldmap-chunk-reversal-policy";
import {
  applyWorldmapSwitchOffRuntimeState,
  finalizePendingChunkFetchOwnership,
  invalidateWorldmapPendingFetchGeneration,
  invalidateWorldmapSwitchOffTransitionState,
  shouldApplyWorldmapFetchResult,
} from "./worldmap-runtime-lifecycle";
import { installWorldmapDebugHooks, uninstallWorldmapDebugHooks } from "./worldmap-debug-hooks";
import { destroyWorldmapOwnedManagers } from "./worldmap-ownership-lifecycle";
import {
  shouldRejectCachedExploredTerrainSnapshot,
  shouldRejectCachedTerrainFingerprintMismatch,
  shouldRejectCachedTerrainSnapshot,
} from "./worldmap-cache-safety";
import {
  getRenderAreaKeyForChunk as getCanonicalRenderAreaKeyForChunk,
  getRenderFetchBoundsForArea as getCanonicalRenderFetchBoundsForArea,
} from "./worldmap-chunk-bounds";
import { resolveTerrainPresentationWorldBounds } from "./worldmap-terrain-bounds-policy";
import { getRenderOverlapChunkKeys, getRenderOverlapNeighborChunkKeys } from "./worldmap-chunk-neighbors";
import { prunePrefetchQueueByFetchKey, type PrefetchQueueItem } from "./worldmap-prefetch-queue";
import { resolveUrlChangedListenerLifecycle } from "./worldmap-lifecycle-policy";
import { shouldCastWorldmapDirectionalShadow } from "./worldmap-shadow-policy";
import {
  createWorldmapChunkDiagnostics,
  recordChunkDiagnosticsEvent,
  type WorldmapChunkDiagnostics,
} from "./worldmap-chunk-diagnostics";
import {
  incrementWorldmapRenderCounter,
  incrementWorldmapForceRefreshReason,
  incrementWorldmapRenderUploadBytes,
  recordWorldmapRenderDuration,
  resetWorldmapRenderDiagnostics,
  setWorldmapRenderGauge,
  snapshotWorldmapRenderDiagnostics,
  type WorldmapForceRefreshReason,
} from "../perf/worldmap-render-diagnostics";
import { recordRendererColorUploadBytes, recordRendererMatrixUploadBytes } from "../perf/renderer-gpu-telemetry";
import { resolveExploredHexTransform } from "./worldmap-explored-hex-transform-policy";
import { buildVisibleTerrainMembership, type VisibleTerrainInstanceRef } from "./worldmap-visible-terrain-membership";
import { resolveVisibleTerrainReconcileMode } from "./worldmap-visible-terrain-reconcile-policy";
import { createWorldmapTerrainFingerprint } from "./worldmap-terrain-fingerprint";
import {
  captureChunkDiagnosticsBaseline,
  cloneChunkDiagnosticsBaselines,
  snapshotChunkDiagnostics as snapshotChunkDiagnosticsState,
  type WorldmapChunkDiagnosticsBaselineEntry,
} from "./worldmap-chunk-diagnostics-baseline";
import {
  evaluateChunkSwitchP95Regression,
  type ChunkSwitchP95RegressionMetric,
  type ChunkSwitchP95RegressionResult,
} from "./worldmap-chunk-latency-regression";
import {
  evaluateTileFetchVolumeRegression,
  type TileFetchVolumeRegressionResult,
} from "./worldmap-tile-fetch-volume-regression";
import { hydrateWarpTravelChunk } from "./warp-travel-chunk-hydration";
import { prepareWarpTravelChunkBounds } from "./warp-travel-chunk-bounds-preparation";
import { resolveWarpTravelDirectionalPrefetchPlan } from "./warp-travel-directional-prefetch";
import { drainWarpTravelPrefetchQueue } from "./warp-travel-prefetch-drain";
import { enqueueWarpTravelPrefetch } from "./warp-travel-prefetch-enqueue";
import { resolveWarpTravelVisibleChunkDecision } from "./warp-travel-chunk-runtime";
import { finalizeWarpTravelChunkSwitch } from "./warp-travel-chunk-switch-commit";
import { resolveSameChunkRefreshCommit } from "./worldmap-same-chunk-refresh-commit";
import {
  deferWarpTravelManagerFanout,
  drainMultiBudgetedDeferredManagerCatchUpQueue,
  runWarpTravelManagerFanout,
} from "./warp-travel-manager-fanout";
import { WarpTravel, type WarpTravelLifecycleAdapter } from "./warp-travel";
import { resolveWorldmapChunkHysteresis } from "./worldmap-chunk-hysteresis-policy";
import { prepareWorldmapChunkPresentation, prewarmWorldmapChunkPresentation } from "./worldmap-chunk-presentation";
import { resolveWorldmapChunkFromWorldPosition } from "./worldmap-chunk-selection-policy";
import { computeMatrixCacheEvictions } from "./worldmap-matrix-cache-eviction";
import { snapshotExploredTilesRegion, lookupSnapshotBiome } from "./explored-tiles-snapshot";
import { createTerrainCacheGeneration, isTerrainCacheStale } from "./terrain-cache-generation";
import { createProvisionalBiomeTracker, resolveArmySpawnBiome } from "./provisional-biome";
import { resolveWorldmapCameraFieldOfViewDegrees } from "./worldmap-camera-view-profile";

interface CachedMatrixEntry {
  matrices: InstancedBufferAttribute | null;
  count: number;
  landColors?: Float32Array | null;
  box?: Box3;
  sphere?: Sphere;
  expectedExploredTerrainInstances?: number;
  terrainFingerprint?: string;
  visibleTerrainOwnership?: Array<[string, VisibleTerrainInstanceRef]>;
  generation?: number;
}

interface PreparedTerrainChunk {
  chunkKey: string;
  startRow: number;
  startCol: number;
  bounds: { box: Box3; sphere: Sphere };
  expectedExploredTerrainInstances: number;
  terrainFingerprint: string;
  visibleTerrainOwnership: Array<[string, VisibleTerrainInstanceRef]>;
  biomeEntries: Map<string, CachedMatrixEntry>;
}

interface StructureHydrationFetchState {
  fetchGeneration: number;
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  pendingCount: number;
  fetchSettled: boolean;
  waiters: Array<() => void>;
}

type TileHydrationFetchState = StructureHydrationFetchState;

type ToriiBoundsCounterKey =
  | "tiles"
  | "structureTiles"
  | "structures"
  | "structureBuildings"
  | "explorerTiles"
  | "explorerTroops";

type WorldmapChunkSwitchP95RegressionDebugResult = {
  baselineLabel: string | null;
  result: ChunkSwitchP95RegressionResult;
};

type WorldmapChunkFirstVisibleCommitP95RegressionDebugResult = {
  baselineLabel: string | null;
  result: ChunkSwitchP95RegressionResult;
};

type WorldmapTileFetchVolumeRegressionDebugResult = {
  baselineLabel: string | null;
  result: TileFetchVolumeRegressionResult;
};

type WorldmapChunkDiagnosticsDebugWindow = Window & {
  getWorldmapChunkDiagnostics?: () => {
    diagnostics: WorldmapChunkDiagnostics;
    baselines: WorldmapChunkDiagnosticsBaselineEntry[];
    currentChunk: string;
    chunkTransitionToken: number;
    chunkRefreshRequestToken: number;
    chunkRefreshAppliedToken: number;
  };
  resetWorldmapChunkDiagnostics?: () => void;
  captureWorldmapChunkBaseline?: (label?: string) => WorldmapChunkDiagnosticsBaselineEntry;
  evaluateWorldmapChunkSwitchP95Regression?: (
    baselineLabel?: string,
    allowedRegressionFraction?: number,
  ) => WorldmapChunkSwitchP95RegressionDebugResult;
  evaluateWorldmapChunkFirstVisibleCommitP95Regression?: (
    baselineLabel?: string,
    allowedRegressionFraction?: number,
  ) => WorldmapChunkFirstVisibleCommitP95RegressionDebugResult;
  evaluateWorldmapTileFetchVolumeRegression?: (
    baselineLabel?: string,
    allowedIncreaseFraction?: number,
  ) => WorldmapTileFetchVolumeRegressionDebugResult;
  getWorldmapRenderDiagnostics?: () => ReturnType<typeof snapshotWorldmapRenderDiagnostics>;
  resetWorldmapRenderDiagnostics?: () => void;
};

const dummy = new Object3D();
const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;
const MIN_TRAVEL_EFFECT_VISIBLE_MS = 600;
const MAX_TRAVEL_EFFECT_LIFETIME_MS = 90_000;
const SHORTCUT_NAVIGATION_DURATION_SECONDS = 0;
const TORII_BOUNDS_DEBUG = env.VITE_PUBLIC_TORII_BOUNDS_DEBUG === true;
const WORLDMAP_STREAMING_ROLLOUT = {
  stagedPathEnabled: env.VITE_PUBLIC_WORLDMAP_STREAMING_STAGED !== false,
};
const WORLDMAP_ZOOM_HARDENING = createWorldmapZoomHardeningConfig({
  enabled: env.VITE_PUBLIC_WORLDMAP_ZOOM_HARDENING === true,
  telemetry: env.VITE_PUBLIC_WORLDMAP_ZOOM_HARDENING_TELEMETRY === true,
});
const TORII_BOUNDS_MODELS: BoundsModelConfig[] = [
  { model: "s1_eternum-TileOpt", colField: "col", rowField: "row" },
  { model: "s1_eternum-Structure", colField: "base.coord_x", rowField: "base.coord_y" },
  { model: "s1_eternum-StructureBuildings", colField: "coord.x", rowField: "coord.y" },
  { model: "s1_eternum-ExplorerTroops", colField: "coord.x", rowField: "coord.y" },
  { model: "s1_eternum-ExplorerRewardEvent", colField: "coord.x", rowField: "coord.y" },
  { model: "s1_eternum-BattleEvent", colField: "coord.x", rowField: "coord.y" },
];
const WORLDMAP_CHUNK_POLICY = createWorldmapChunkPolicy(WORLD_CHUNK_CONFIG);
type DirectionalPrefetchAnchor = {
  forwardChunkKey: string;
  movementAxis: "x" | "z";
  movementSign: -1 | 1;
};
type WorldmapCameraTransitionStatus = "idle" | "transitioning";

/**
 * Module-level ref to the active spatial ToriiStreamManager.
 * Used by ConnectionHealthMonitor to trigger spatial resubscription
 * without exposing the full WorldmapScene internals.
 */
let activeSpatialStreamManager: ToriiStreamManagerType | null = null;

export const getActiveSpatialStreamManager = (): ToriiStreamManagerType | null => activeSpatialStreamManager;

export default class WorldmapScene extends WarpTravel {
  // Single source of truth for chunk geometry to avoid drift across fetch/render/visibility.
  private readonly chunkGeometry = {
    size: WORLDMAP_CHUNK_POLICY.chunkSize,
    renderSize: WORLDMAP_CHUNK_POLICY.renderSize,
    overlap: 0,
  };
  private chunkSize = this.chunkGeometry.size;
  private chunkSwitchPadding = WORLDMAP_CHUNK_POLICY.switchPadding;
  private lastChunkSwitchPosition?: Vector3;
  private lastChunkSwitchMovement: { x: number; z: number } | null = null;
  private hasChunkSwitchAnchor: boolean = false;
  private currentChunkBounds?: { box: Box3; sphere: Sphere };
  private readonly prefetchedAhead: string[] = [];
  private readonly maxPrefetchedAhead = WORLDMAP_CHUNK_POLICY.prefetch.maxAhead;
  private postCommitManagerCatchUpQueue: Array<{
    chunkKey: string;
    options?: { force?: boolean; transitionToken?: number };
    estimatedUploadBytes: number;
    deferredCount?: number;
  }> = [];
  private postCommitManagerCatchUpFrameHandle: number | null = null;
  private readonly postCommitManagerCatchUpBudgetBytes = 256 * 1024;
  private directionalPresentationChunkKeys: Set<string> = new Set();
  private activeDirectionalPresentationPrewarms: Set<string> = new Set();
  private prefetchQueue: PrefetchQueueItem[] = [];
  private directionalPrefetchAreaKeys: Set<string> = new Set();
  private queuedPrefetchAreaKeys: Set<string> = new Set();
  private activePrefetches = 0;
  private readonly maxConcurrentPrefetches = WORLDMAP_CHUNK_POLICY.prefetch.maxConcurrent;
  private readonly worldmapMinZoomDistance = 10;
  private readonly worldmapMaxZoomDistance = 60;
  private wheelHandler: ((event: WheelEvent) => void) | null = null;
  private readonly zoomCoordinator = new WorldmapZoomCoordinator({
    initialDistance: this.getCurrentCameraDistance(),
    minDistance: this.worldmapMinZoomDistance,
    maxDistance: this.worldmapMaxZoomDistance,
  });
  private zoomRefreshPlannerState = createWorldmapZoomRefreshPlannerState();
  private readonly worldmapCameraViewListeners: Set<(view: CameraView) => void> = new Set();
  private readonly worldmapCameraTransitionListeners: Set<(status: WorldmapCameraTransitionStatus) => void> = new Set();
  private lastPublishedStableCameraView = this.zoomCoordinator.getSnapshot().stableBand;
  private lastPublishedZoomStatus: WorldmapCameraTransitionStatus = "idle";
  private readonly zoomGroundPlane = new Plane(new Vector3(0, 1, 0), 0);
  private renderChunkSize = this.chunkGeometry.renderSize;

  private totalStructures: number = 0;

  private currentChunk: string = "null";
  private isChunkTransitioning: boolean = false;
  private chunkRefreshTimeout: number | null = null;
  private chunkRefreshDeadlineAtMs: number | null = null;
  private pendingChunkRefreshForce = false;
  private pendingChunkRefreshUiReason: "default" | "shortcut" = "default";
  private chunkRefreshRequestToken = 0;
  private chunkRefreshAppliedToken = 0;
  private chunkRefreshRunning = false;
  private chunkRefreshRerunRequested = false;
  private isShortcutArmySelectionInFlight = false;
  private lastControlsCameraDistance: number | null = null;
  private readonly zoomForceRefreshDistanceThreshold = 0.75;
  private zeroTerrainFrames = 0;
  private lowTerrainFrames = 0;
  private offscreenChunkFrames = 0;
  private terrainReferenceInstances = 0;
  private terrainReferenceChunkKey: string | null = null;
  private terrainRecoveryInFlight = false;
  private lastTerrainRecoveryAtMs = 0;
  private readonly zeroTerrainFrameThreshold = 3;
  private readonly lowTerrainFrameThreshold = 3;
  private readonly offscreenChunkFrameThreshold = 2;
  private readonly minRetainedTerrainFraction = 0.45;
  private readonly minReferenceTerrainInstances = 100;
  private readonly terrainRecoveryCooldownMs = 1500;
  private readonly minCachedTerrainCoverageFraction = 0.08;
  private readonly minCachedExploredRetentionFraction = 0.6;
  private readonly minExpectedExploredForCacheValidation = 48;
  private toriiLoadingCounter = 0;
  private readonly chunkRowsAhead = WORLDMAP_CHUNK_POLICY.pin.rowsAhead;
  private readonly chunkRowsBehind = WORLDMAP_CHUNK_POLICY.pin.rowsBehind;
  private readonly chunkColsEachSide = WORLDMAP_CHUNK_POLICY.pin.colsEachSide;
  private hydratedChunkRefreshes: Set<string> = new Set();
  private hydratedRefreshSuppressionAreaKeys: Set<string> = new Set();
  private hydratedRefreshScheduled = false;
  private cameraPositionScratch: Vector3 = new Vector3();
  private cameraDirectionScratch: Vector3 = new Vector3();
  private cameraGroundIntersectionScratch: Vector3 = new Vector3();
  private interactiveHexWindowKey: string | null = null;

  private armyManager: ArmyManager;
  private pendingArmyMovements: Set<ID> = new Set();
  private pendingArmyMovementStartedAt: Map<ID, number> = new Map();
  private pendingArmyMovementFallbackTimeouts: Map<ID, ReturnType<typeof setTimeout>> = new Map();
  private readonly stalePendingArmyMovementMs = 10_000;
  private armySelectionRecoveryInFlight: Set<ID> = new Set();
  private structureManager: StructureManager;
  private memoryMonitor?: MemoryMonitor;
  private chestManager: ChestManager;
  private exploredTiles: Map<number, Map<number, BiomeType>> = new Map();
  // normalized positions and if they are allied or not
  private armyHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // normalized positions and if they are allied or not
  private structureHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // normalized positions and if they are allied or not
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
  private readonly interactionAdapter;
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
    this.zoomCoordinator.applyIntent({
      type: "continuous_delta",
      delta: detail.zoomOut ? WORLDMAP_STEP_WHEEL_DELTA : -WORLDMAP_STEP_WHEEL_DELTA,
      anchor: this.resolveWorldmapMinimapZoomAnchor(),
    });
    this.publishWorldmapZoomSnapshot(this.zoomCoordinator.getSnapshot());
  };
  private handleWorldmapControlsChange = () => {
    if (this.sceneManager.getCurrentScene() !== SceneName.WorldMap) return;
    this.updateCameraTargetHexThrottled?.();

    const nextCameraDistance = this.getCurrentCameraDistance();
    const refreshPlan = planWorldmapZoomRefresh(this.zoomRefreshPlannerState, {
      distanceChanged:
        this.lastControlsCameraDistance === null ||
        Math.abs(this.lastControlsCameraDistance - nextCameraDistance) > 0.01,
      shouldForceRefresh: shouldForceChunkRefreshForZoomDistanceChange({
        previousDistance: this.lastControlsCameraDistance,
        nextDistance: nextCameraDistance,
        threshold: this.zoomForceRefreshDistanceThreshold,
      }),
      status: this.zoomCoordinator.getSnapshot().status,
    });
    this.zoomRefreshPlannerState = refreshPlan.nextState;
    this.lastControlsCameraDistance = nextCameraDistance;

    if (refreshPlan.immediateLevel !== "none") {
      this.requestChunkRefresh(refreshPlan.immediateLevel === "forced");
    }
  };
  private isUrlChangedListenerAttached = false;
  private readonly urlChangedHandler = () => {
    this.clearSelection();
  };
  private followCameraTimeout: ReturnType<typeof setTimeout> | null = null;
  private notifiedBattleEvents = new Set<string>();
  private previouslyHoveredHex: HexPosition | null = null;

  // Performance simulation helper
  private perfSimulation: WorldmapPerfSimulation | null = null;
  // Performance simulation: Show all biomes as explored (bypasses fog of war)
  private simulateAllExplored: boolean = false;
  private async ensureStructureQueriedMethod(structureId: ID, hexCoords: HexPosition) {
    const contractCoords = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
    const components = this.dojo.components as Parameters<typeof ensureStructureSynced>[0];
    const toriiClient = this.dojo.network?.toriiClient;
    const contractComponents = this.dojo.network?.contractComponents as unknown as
      | Parameters<typeof ensureStructureSynced>[2]
      | undefined;

    if (!toriiClient || !contractComponents) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "wait";

    try {
      const accountAddress = useAccountStore.getState().account?.address;
      await ensureStructureSynced(
        components,
        toriiClient,
        contractComponents,
        structureId,
        { col: contractCoords.x, row: contractCoords.y },
        accountAddress,
      );
    } catch (error) {
      console.error("[WorldmapScene] Failed to fetch structure data from Torii", error);
    } finally {
      document.body.style.cursor = previousCursor;
    }
  }

  private exploredTilesGeneration = createTerrainCacheGeneration();
  private provisionalBiomes = createProvisionalBiomeTracker();
  private cachedMatrices: Map<string, Map<string, CachedMatrixEntry>> = new Map();
  private cachedMatrixOrder: string[] = [];
  private readonly maxMatrixCacheSize = WORLDMAP_CHUNK_POLICY.cache.recommendedMinSize;
  private pinnedChunkKeys: Set<string> = new Set();
  private updateHexagonGridPromise: Promise<void> | null = null;
  private hexGridFrameHandle: number | null = null;
  private currentHexGridTask: symbol | null = null;
  private readonly hexGridFrameBudgetMs = 6.5;
  private readonly hexGridMinBatch = 120;
  private readonly hexGridMaxBatch = 900;
  private travelEffects: Map<string, () => void> = new Map();
  private travelEffectsByEntity: Map<ID, { key: string; cleanup: () => void; effectType: TravelEffectType }> =
    new Map();
  private cancelHexGridComputation?: () => void;

  // Global chunk switching coordination
  private globalChunkSwitchPromise: Promise<void> | null = null;
  private chunkTransitionToken = 0;
  private actionPathsTransitionToken: number | null = null;
  private isApplyingLocalActionPathUpdate = false;
  private chunkDiagnostics: WorldmapChunkDiagnostics = createWorldmapChunkDiagnostics();
  private chunkDiagnosticsBaselines: WorldmapChunkDiagnosticsBaselineEntry[] = [];

  // Label groups
  private armyLabelsGroup: Group;
  private structureLabelsGroup: Group;
  private chestLabelsGroup: Group;

  private storeSubscriptions: Array<() => void> = [];

  dojo: SetupResult;

  // Render-area fetch bookkeeping (keys represent render-sized regions, not chunk stride)
  private fetchedChunks: Set<string> = new Set();
  private pendingChunks: Map<string, Promise<boolean>> = new Map();
  private pendingChunkFetchGeneration = 0;
  private tileHydrationFetches: Map<string, TileHydrationFetchState> = new Map();
  private structureHydrationFetches: Map<string, StructureHydrationFetchState> = new Map();
  private visibleTerrainMembership: Map<string, VisibleTerrainInstanceRef> = new Map();
  private pinnedRenderAreas: Set<string> = new Set();
  private pendingArmyRemovals: Map<ID, ReturnType<typeof setTimeout>> = new Map();
  private pendingArmyRemovalMeta: Map<
    ID,
    {
      scheduledAt: number;
      chunkKey: string;
      reason: "tile" | "zero";
      ownerAddress?: bigint;
      ownerStructureId?: ID | null;
      position?: HexPosition;
    }
  > = new Map();
  private deferredChunkRemovals: Map<ID, { reason: "tile" | "zero"; scheduledAt: number }> = new Map();

  private fxManager: FXManager;
  private resourceFXManager: ResourceFXManager;
  private armyIndex: number = 0;
  private selectableArmies: SelectableArmy[] = [];
  private structureIndex: number = 0;
  private playerStructures: Structure[] = [];

  // Hover-based label expansion manager
  private hoverLabelManager: HoverLabelManager;

  private worldUpdateUnsubscribes: Array<() => void> = [];
  private visibilityChangeHandler?: () => void;
  private cosmeticsSubscriptionCleanup?: () => void;
  private toriiStreamManager?: ToriiStreamManager;
  private toriiBoundsAreaKey: string | null = null;
  private toriiBoundsUpdateCounts: Record<ToriiBoundsCounterKey, number> = {
    tiles: 0,
    structureTiles: 0,
    structures: 0,
    structureBuildings: 0,
    explorerTiles: 0,
    explorerTroops: 0,
  };
  private toriiBoundsLogInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    dojoContext: SetupResult,
    raycaster: Raycaster,
    controls: MapControls,
    mouse: Vector2,
    sceneManager: SceneManager,
  ) {
    super(SceneName.WorldMap, controls, dojoContext, mouse, raycaster, sceneManager);

    this.dojo = dojoContext;
    const toriiClient = dojoContext.network?.toriiClient;
    if (toriiClient) {
      this.toriiStreamManager = new ToriiStreamManager({
        client: toriiClient,
        setup: dojoContext,
        logging: false,
        onUpdate: () => useConnectionStore.getState().recordSpatialUpdate(),
      });
      activeSpatialStreamManager = this.toriiStreamManager;
      this.startToriiBoundsCounterLog();
    }
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

    // Initialize performance simulation helper
    this.perfSimulation = new WorldmapPerfSimulation({
      guiFolder: this.GUIFolder,
      getSimulateAllExplored: () => this.simulateAllExplored,
      setSimulateAllExplored: (value: boolean) => {
        this.simulateAllExplored = value;
      },
      getRenderChunkSize: () => this.renderChunkSize,
      requestChunkRefresh: (force: boolean) => this.requestChunkRefresh(force),
      hashCoordinates: (x: number, y: number) => this.hashCoordinates(x, y),
    });
    this.perfSimulation.setupPerformanceSimulationGUI();

    // Initialize sync simulator with dojo context for ECS injection
    initializeSyncSimulator(dojoContext);

    this.loadBiomeModels(this.renderChunkSize.width * this.renderChunkSize.height);

    // Initialize label groups
    this.armyLabelsGroup = new Group();
    this.armyLabelsGroup.name = "ArmyLabelsGroup";
    this.structureLabelsGroup = new Group();
    this.structureLabelsGroup.name = "StructureLabelsGroup";
    this.chestLabelsGroup = new Group();
    this.chestLabelsGroup.name = "ChestLabelsGroup";

    this.armyManager = new ArmyManager(
      this.scene,
      this.renderChunkSize,
      this.armyLabelsGroup,
      this,
      this.dojo,
      this.frustumManager,
      this.visibilityManager,
      this.chunkSize,
    );

    installWorldmapDebugHooks(window, {
      testMaterialSharing: () => this.armyManager.logMaterialSharingStats(),
      testTroopDiffFx: (diff?: number) => {
        const targetHex = this.getCameraTargetHex();
        const worldPos = getWorldPositionForHex(targetHex);
        const testDiff = diff ?? (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 50 + 1);
        console.log(`[TestTroopDiffFx] Spawning FX at camera target with diff: ${testDiff}`);
        this.fxManager.playTroopDiffFx(testDiff, worldPos.x, worldPos.y + 3, worldPos.z);
      },
    });
    this.installChunkDiagnosticsDebugHooks();
    this.structureManager = new StructureManager(
      this.scene,
      this.renderChunkSize,
      this.structureLabelsGroup,
      this,
      this.fxManager,
      this.dojo,
      this.frustumManager,
      this.visibilityManager,
      this.chunkSize,
    );

    // Initialize the chest manager
    this.chestManager = new ChestManager(this.scene, this.renderChunkSize, this.chestLabelsGroup, this, this.chunkSize);

    // NOTE: Chunk integration system disabled for performance
    // The chunk integration adds overhead via hydration tracking callbacks on every entity update.
    // Uncomment if you need advanced chunk lifecycle debugging/tracking features.
    // this.initializeChunkIntegration();

    // Force visibility/chunk refresh when returning from background tab to avoid missing armies/tiles.
    this.visibilityChangeHandler = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      this.visibilityManager?.forceUpdate();
      this.requestChunkRefresh(true, "visibility_recovery");
    };
    document.addEventListener("visibilitychange", this.visibilityChangeHandler);
    this.cosmeticsSubscriptionCleanup = playerCosmeticsStore.subscribe((owner) => {
      if (!owner) {
        return;
      }

      this.armyManager.refreshCosmeticsForOwner(owner);
      this.structureManager.refreshCosmeticsForOwner(owner);
    });

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
        chest: {
          show: (entityId: ID) => this.chestManager.showLabel(entityId),
          hide: (entityId: ID) => this.chestManager.hideLabel(entityId),
          hideAll: () => this.chestManager.hideAllLabels(),
        },
      },
      (hexCoords: HexPosition) => this.getHexagonEntity(hexCoords),
      this.getCurrentCameraView(),
    );

    // Subscribe hover label manager to camera view changes
    this.addCameraViewListener((view: CameraView) => {
      this.hoverLabelManager.updateCameraView(view);
      this.highlightHexManager.setCameraView(view);
      this.interactiveHexManager.setCameraView(view);
      this.configureWorldmapShadows();
    });

    // Store the unsubscribe function for Army updates
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Army.onTileUpdate(async (update: ExplorerTroopsTileSystemUpdate) => {
        this.incrementToriiBoundsCounter("explorerTiles");
        this.cancelPendingArmyRemoval(update.entityId);
        const normalizedPos = new Position({ x: update.hexCoords.col, y: update.hexCoords.row }).getNormalized();

        if (update.removed) {
          this.scheduleArmyRemoval(update.entityId, "tile", {
            ownerAddress: update.ownerAddress,
            ownerStructureId: update.ownerStructureId,
            position: { col: normalizedPos.x, row: normalizedPos.y },
          });
          return;
        }

        this.resolveSupersededPendingArmyRemoval(update.entityId, update.ownerAddress, update.ownerStructureId, {
          col: normalizedPos.x,
          row: normalizedPos.y,
        });

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
        const spawnResult = resolveArmySpawnBiome(
          this.exploredTiles,
          normalizedPos.x,
          normalizedPos.y,
          BiomeType.Grassland,
        );
        if (spawnResult.action === "write_provisional") {
          if (!this.exploredTiles.has(normalizedPos.x)) {
            this.exploredTiles.set(normalizedPos.x, new Map());
          }
          this.exploredTiles.get(normalizedPos.x)!.set(normalizedPos.y, BiomeType.Grassland);
          this.provisionalBiomes.mark(normalizedPos.x, normalizedPos.y);
          this.exploredTilesGeneration.bump();
        }

        await this.armyManager.onTileUpdate(update);

        this.invalidateAllChunkCachesContainingHex(normalizedPos.x, normalizedPos.y);

        // Update positions for the moved army
        const armyEntityId = update.entityId;
        const prevPosition = this.armiesPositions.get(armyEntityId);

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
        this.incrementToriiBoundsCounter("explorerTroops");
        this.cancelPendingArmyRemoval(update.entityId);

        if (update.troopCount <= 0) {
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
        // Remove the army visuals/hex before dropping tracking data so we can clean up the correct tile
        this.deleteArmy(entityId);

        // Remove from attacker-defender tracking
        this.removeEntityFromTracking(entityId);
        this.requestChunkRefresh(false, "army_dead");
      }),
    );

    // Listen for battle events and update army/structure labels
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.BattleEvent.onBattleUpdate((update: BattleEventSystemUpdate) => {
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
        this.incrementToriiBoundsCounter("structures");
        const previousStructureOwner = this.getTrackedStructureOwner(update.entityId);
        this.updateStructureHexes(update);
        this.structureManager.updateStructureLabelFromStructureUpdate(update);
        if (previousStructureOwner !== update.owner.address) {
          this.syncAttachedArmiesForStructureOwner(update);
        }
      }),
    );

    // Listen for structure building updates
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Structure.onStructureBuildingsUpdate((update) => {
        this.incrementToriiBoundsCounter("structureBuildings");
        this.structureManager.updateStructureLabelFromBuildingUpdate(update);
      }),
    );

    // Store the unsubscribe function for Tile updates
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Tile.onTileUpdate((value) => {
        this.incrementToriiBoundsCounter("tiles");
        void this.trackTileHydrationUpdate(value, this.updateExploredHex(value));
      }),
    );

    // Store the unsubscribe function for Structure updates
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.Structure.onTileUpdate(async (value) => {
        this.incrementToriiBoundsCounter("structureTiles");
        const positions = this.updateStructureHexes(value);

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

        await this.trackStructureHydrationUpdate(value, this.structureManager.onUpdate(value));

        const newCount = this.structureManager.getTotalStructures();
        const countChanged = this.totalStructures !== newCount;

        // Debug: Track structure count changes
        if (import.meta.env.DEV && countChanged) {
          console.log(
            `[Structure.onTileUpdate] Count changed: ${this.totalStructures} -> ${newCount}, entityId: ${value.entityId}`,
          );
        }

        const structureTileActions = resolveStructureTileUpdateActions({
          hasPositions: Boolean(positions),
          countChanged,
        });

        if (structureTileActions.shouldScheduleTileRefresh && positions) {
          this.scheduleTileRefreshIfAffectsCurrentRenderBounds(positions.oldPos ?? null, positions.newPos);
        }

        if (structureTileActions.shouldUpdateTotalStructures) {
          this.totalStructures = newCount;
        }

        if (structureTileActions.shouldClearCache) {
          this.clearCache();
        }

        if (structureTileActions.shouldRefreshVisibleChunks) {
          this.requestChunkRefresh(true, "structure_count_change");
        }
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

    this.addWorldUpdateSubscription(
      this.worldUpdateListener.ExplorerReward.onExplorerRewardEventUpdate((update: ExplorerRewardSystemUpdate) => {
        this.handleExplorerRewardEvent(update);
      }),
    );

    // add particles
    this.selectedHexManager = new SelectedHexManager(this.scene);
    this.interactionAdapter = createWorldmapInteractionAdapter({
      state: this.state,
      selectedHexManager: this.selectedHexManager,
      dojoComponents: this.dojo.components,
    });
    this.selectionPulseManager = new SelectionPulseManager(this.scene);
    this.interactiveHexManager.applyHoverPalette(resolveHoverVisualPalette({ hasSelection: false }));
    this.interactiveHexManager.setSurfaceVisibility(false);
    this.interactiveHexManager.setHoverVisualMode("outline");

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
    this.controls.addEventListener("change", this.handleWorldmapControlsChange);
    this.updateCameraTargetHexThrottled();

    // Initialize SceneShortcutManager for WorldMap shortcuts
    this.shortcutManager = new SceneShortcutManager("worldmap", this.sceneManager);

    // Only register shortcuts if they haven't been registered already
    if (!this.shortcutManager.hasShortcuts()) {
      const shouldCycleStructuresForTab = () => Boolean(useUIStore.getState().armyCreationPopup);
      const getRealmStructuresForTab = () =>
        this.playerStructures.filter((structure) => structure.category === StructureType.Realm);

      this.shortcutManager.registerShortcut({
        id: "cycle-armies",
        key: "Tab",
        description: "Cycle through armies (or structures when army creation is open)",
        sceneRestriction: SceneName.WorldMap,
        condition: () => {
          if (shouldCycleStructuresForTab()) {
            return getRealmStructuresForTab().length > 0;
          }
          return this.selectableArmies.length > 0;
        },
        action: () => {
          if (shouldCycleStructuresForTab()) {
            this.selectNextRealmStructure();
            return;
          }
          void this.selectNextArmy();
        },
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
  }

  private setupCameraZoomHandler() {
    this.wheelHandler = (event: WheelEvent) => {
      const normalizedWheelDelta = normalizeWorldmapWheelDelta({
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        viewportHeight: window.innerHeight,
      });
      const mostlyVertical = Math.abs(normalizedWheelDelta.normalizedDelta) >= Math.abs(event.deltaX);

      if (!normalizedWheelDelta.direction || !mostlyVertical) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      this.zoomCoordinator.applyIntent({
        type: "continuous_delta",
        delta: normalizedWheelDelta.normalizedDelta,
        anchor: this.resolveWorldmapWheelAnchor(event),
      });
      this.publishWorldmapZoomSnapshot(this.zoomCoordinator.getSnapshot());
    };

    const canvas = document.getElementById("main-canvas");
    if (canvas) {
      canvas.addEventListener("wheel", this.wheelHandler, { passive: false });
    }
  }

  private applyDirectionalZoomIntent(zoomOut: boolean) {
    this.zoomCoordinator.applyIntent({
      type: "continuous_delta",
      delta: zoomOut ? WORLDMAP_STEP_WHEEL_DELTA : -WORLDMAP_STEP_WHEEL_DELTA,
      anchor: this.resolveWorldmapMinimapZoomAnchor(),
    });
    this.publishWorldmapZoomSnapshot(this.zoomCoordinator.getSnapshot());
  }

  public override changeCameraView(position: CameraView) {
    this.zoomCoordinator.applyIntent({
      type: "snap_to_band",
      band: position,
      anchor: this.resolveWorldmapKeyboardZoomAnchor(),
    });
    this.publishWorldmapZoomSnapshot(this.zoomCoordinator.getSnapshot());
  }

  public override getCurrentCameraView(): CameraView {
    return this.zoomCoordinator.getSnapshot().stableBand;
  }

  public override addCameraViewListener(listener: (view: CameraView) => void) {
    this.worldmapCameraViewListeners.add(listener);
    listener(this.getCurrentCameraView());
  }

  public override removeCameraViewListener(listener: (view: CameraView) => void) {
    this.worldmapCameraViewListeners.delete(listener);
  }

  public override addCameraTransitionListener(listener: (status: WorldmapCameraTransitionStatus) => void) {
    this.worldmapCameraTransitionListeners.add(listener);
    listener(this.lastPublishedZoomStatus);
  }

  public override removeCameraTransitionListener(listener: (status: WorldmapCameraTransitionStatus) => void) {
    this.worldmapCameraTransitionListeners.delete(listener);
  }

  private configureWorldmapShadows() {
    if (!this.mainDirectionalLight) {
      return;
    }
    this.mainDirectionalLight.castShadow = shouldCastWorldmapDirectionalShadow(
      this.getShadowsEnabledByQuality(),
      this.getCurrentCameraView() === CameraView.Far,
    );
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

  private getCurrentCameraDistance(): number {
    return this.controls.object.position.distanceTo(this.controls.target);
  }

  private resolveWorldmapWheelAnchor(event: WheelEvent): WorldmapZoomAnchor {
    const worldPoint = this.resolveWorldmapGroundIntersection(event.clientX, event.clientY);

    return {
      mode: worldPoint ? "cursor" : "screen_center",
      worldPoint: worldPoint ?? this.controls.target.clone(),
    };
  }

  private resolveWorldmapKeyboardZoomAnchor(): WorldmapZoomAnchor {
    return {
      mode: "screen_center",
      worldPoint: this.controls.target.clone(),
    };
  }

  private resolveWorldmapMinimapZoomAnchor(): WorldmapZoomAnchor {
    return {
      mode: "world_point",
      worldPoint: this.controls.target.clone(),
    };
  }

  private resolveWorldmapGroundIntersection(clientX: number, clientY: number): Vector3 | null {
    const canvas = this.controls.domElement;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }

    const pointer = new Vector2(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    const raycaster = new Raycaster();
    raycaster.setFromCamera(pointer, this.camera);

    const intersection = new Vector3();
    const didIntersect = raycaster.ray.intersectPlane(this.zoomGroundPlane, intersection);

    return didIntersect ? intersection.clone() : null;
  }

  private publishWorldmapZoomSnapshot(snapshot: WorldmapCameraSnapshot): void {
    const nextStableCameraView = snapshot.stableBand;
    if (nextStableCameraView !== this.lastPublishedStableCameraView) {
      this.lastPublishedStableCameraView = nextStableCameraView;
      this.worldmapCameraViewListeners.forEach((listener) => listener(nextStableCameraView));
    }

    const nextTransitionStatus: WorldmapCameraTransitionStatus =
      snapshot.status === "zooming" ? "transitioning" : "idle";
    if (nextTransitionStatus !== this.lastPublishedZoomStatus) {
      this.lastPublishedZoomStatus = nextTransitionStatus;
      this.worldmapCameraTransitionListeners.forEach((listener) => listener(nextTransitionStatus));
    }
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

  private getTrackedStructureOwner(entityId: ID): ContractAddress | undefined {
    const structurePosition = this.structuresPositions.get(entityId);
    if (structurePosition) {
      return this.structureHexes.get(structurePosition.col)?.get(structurePosition.row)?.owner;
    }

    for (const rowMap of this.structureHexes.values()) {
      for (const structure of rowMap.values()) {
        if (structure.id === entityId) {
          return structure.owner;
        }
      }
    }

    return undefined;
  }

  private getTrackedArmyOwner(entityId: ID): ContractAddress | undefined {
    const armyPosition = this.armiesPositions.get(entityId);
    if (armyPosition) {
      return this.armyHexes.get(armyPosition.col)?.get(armyPosition.row)?.owner;
    }

    for (const rowMap of this.armyHexes.values()) {
      for (const army of rowMap.values()) {
        if (army.id === entityId) {
          return army.owner;
        }
      }
    }

    return undefined;
  }

  private syncAttachedArmiesForStructureOwner(update: {
    entityId: ID;
    owner: { address: bigint | undefined; ownerName: string; guildName: string };
  }): void {
    const structureOwnerAddress = update.owner.address;
    if (structureOwnerAddress === undefined) {
      return;
    }

    const attachedArmyIds = new Set<ID>();

    this.armyManager
      .syncAttachedArmiesOwnerForStructure({
        structureId: update.entityId,
        ownerAddress: structureOwnerAddress,
        ownerName: update.owner.ownerName,
        guildName: update.owner.guildName,
      })
      .forEach((armyId) => attachedArmyIds.add(armyId));

    this.armyStructureOwners.forEach((ownerStructureId, armyId) => {
      if (ownerStructureId === update.entityId) {
        attachedArmyIds.add(armyId);
      }
    });

    attachedArmyIds.forEach((armyId) => {
      const resolvedOwnerAddress = resolveAttachedArmyOwnerFromStructure({
        existingArmyOwner: this.getTrackedArmyOwner(armyId),
        incomingStructureOwner: structureOwnerAddress,
      });

      let armyPosition = this.armiesPositions.get(armyId);
      if (!armyPosition) {
        const army = this.armyManager.getArmy(armyId);
        if (army) {
          const normalized = army.hexCoords.getNormalized();
          armyPosition = { col: normalized.x, row: normalized.y };
        }
      }

      if (!armyPosition) {
        return;
      }

      this.updateArmyHexes({
        entityId: armyId,
        hexCoords: armyPosition,
        ownerAddress: resolvedOwnerAddress,
        ownerStructureId: update.entityId,
      });
    });
  }

  private handleExplorerRewardEvent(update: ExplorerRewardSystemUpdate): void {
    if (this.isRewardDebugEnabled()) {
      console.debug("[ExplorerRewardEvent] update", update);
    }

    const { explorerId, resourceId, amount } = update;
    if (!resourceId) {
      return;
    }

    setTimeout(() => {
      const armyPosition = this.armiesPositions.get(explorerId);
      if (!armyPosition) {
        console.warn("ExplorerRewardEvent missing position for reward display", { explorerId, update });
        return;
      }

      const resource = findResourceById(resourceId);
      const text = resource?.trait ? `${resource.trait} found` : undefined;
      const ownerAddress = this.getEntityOwnerAddress(explorerId);
      const isOwnArmy = ownerAddress !== undefined && isAddressEqualToAccount(ownerAddress);

      if (isOwnArmy) {
        playResourceSound(resourceId as ResourcesIds);
      }

      void this.displayResourceGain(resourceId, amount, armyPosition.col, armyPosition.row, text);
    }, 500);
  }

  private isRewardDebugEnabled(): boolean {
    return Boolean((globalThis as { __ETERNUM_DEBUG_REWARD_EVENTS__?: boolean }).__ETERNUM_DEBUG_REWARD_EVENTS__);
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
      this.applyContextualHoverPalette(null);

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
    // Entity IDs can be valid falsy values (for example 0), so nullish checks
    // are required to distinguish "no selection" from a real selected entity.
    if (selectedEntityId !== null && selectedEntityId !== undefined && actionPaths.size > 0) {
      if (this.previouslyHoveredHex?.col !== hexCoords.col || this.previouslyHoveredHex?.row !== hexCoords.row) {
        this.previouslyHoveredHex = hexCoords;
      }
      this.state.updateEntityActionHoveredHex(hexCoords);
    }

    this.applyContextualHoverPalette(hexCoords);
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
      await this.ensureStructureQueriedMethod(structure.id, hexCoords);
    } catch (error) {
      console.error("[WorldmapScene] Failed to sync structure before entry", error);
    }

    const contractPosition = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
    const worldMapPosition =
      Number.isFinite(Number(contractPosition?.x)) && Number.isFinite(Number(contractPosition?.y))
        ? { col: Number(contractPosition?.x), row: Number(contractPosition?.y) }
        : undefined;

    const shouldSpectate = this.state.isSpectating || !isMine;

    this.interactionAdapter.enterStructure({
      hexCoords,
      structureId: structure.id,
      spectator: shouldSpectate,
      worldMapPosition,
    });
  }

  protected getHexagonEntity(hexCoords: HexPosition) {
    const hex = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();
    const army = this.armyHexes.get(hex.x)?.get(hex.y);
    const structure = this.structureHexes.get(hex.x)?.get(hex.y);
    const chest = this.chestHexes.get(hex.x)?.get(hex.y);

    return { army, structure, chest };
  }

  protected tryArmyRaycastFallback(raycaster: Raycaster): HexPosition | null {
    if (!this.armyManager) return null;
    const entityId = this.armyManager.onMouseMove(raycaster);
    if (entityId === undefined) return null;
    const position = this.armiesPositions.get(entityId);
    if (!position) return null;
    if (import.meta.env.DEV) {
      console.warn(
        `[Selection Fallback] Hex picking failed but army raycast hit entity ${entityId} at (${position.col}, ${position.row})`,
      );
    }
    return position;
  }

  // hexcoords is normalized
  protected onHexagonClick(hexCoords: HexPosition | null) {
    const overlay = document.querySelector(".shepherd-modal-is-visible");
    const overlayClick = document.querySelector(".allow-modal-click");
    const accountAddress = ContractAddress(useAccountStore.getState().account?.address || "");
    const { army, structure, chest } = hexCoords
      ? this.getHexagonEntity(hexCoords)
      : { army: undefined, structure: undefined, chest: undefined };
    const clickPlan = resolveWorldmapHexClickPlan({
      hasBlockingOverlay: Boolean(overlay && !overlayClick),
      hexCoords,
      accountAddress,
      army: army ? { id: army.id, owner: army.owner } : undefined,
      structure: structure ? { id: structure.id, owner: structure.owner } : undefined,
      chest: chest ? { id: chest.id } : undefined,
    });

    if (clickPlan.kind === "ignore" || !hexCoords) {
      return;
    }

    if (structure) {
      console.log("[Worldmap] Structure entity id clicked:", structure.id);
    }

    this.handleHexSelection(hexCoords, clickPlan.isMine);

    if (clickPlan.selection.type === "army") {
      this.onArmySelection(clickPlan.selection.entityId, accountAddress);
      return;
    }

    if (clickPlan.selection.type === "structure") {
      this.onStructureSelection(clickPlan.selection.entityId, hexCoords);
      return;
    }

    this.clearEntitySelection();
  }

  protected handleHexSelection(hexCoords: HexPosition, isMine: boolean) {
    const contractHexPosition = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
    const position = getWorldPositionForHex(hexCoords);
    this.interactionAdapter.selectHex({
      contractHexPosition,
      isMine,
      position: {
        x: position.x,
        z: position.z,
      },
    });
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
    const hasActiveEntityAction = selectedEntityId !== null && selectedEntityId !== undefined && actionPaths.size > 0;

    const isMineStructure = structure?.owner !== undefined ? isAddressEqualToAccount(structure.owner) : false;

    if (structure && isMineStructure && !hasActiveEntityAction) {
      this.interactionAdapter.openOwnedStructureContextMenu({
        event,
        structure,
        hexCoords,
      });
      return;
    }

    if (selectedEntityId !== null && selectedEntityId !== undefined && actionPaths.size > 0 && hexCoords) {
      const actionPathLookup = resolveEntityActionPathLookup({
        hasSelectedEntity: true,
        clickedHexKey: ActionPaths.posKey(hexCoords, true),
        actionPaths,
        actionPathsTransitionToken: this.actionPathsTransitionToken,
        latestTransitionToken: this.chunkTransitionToken,
      });

      if (actionPathLookup.shouldClearStaleSelection) {
        this.clearEntitySelection();
        return;
      }

      if (actionPathLookup.actionPath && account) {
        const actionPath = actionPathLookup.actionPath;
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
      // AudioManager handles muted state internally - no need to check isSoundOn
      AudioManager.getInstance().play("unit.march");

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
      let cleanup = () => {};
      const shouldPlayMovementFx = shouldPlayArmyMovementFx({
        capabilities: snapshotRendererFxCapabilities(),
        movementType: isExplored ? "travel" : "explore",
      });

      if (shouldPlayMovementFx) {
        const existingEffect = this.travelEffects.get(key);
        if (existingEffect) {
          existingEffect();
        }

        const existingByEntity = this.travelEffectsByEntity.get(selectedEntityId);
        if (existingByEntity) {
          existingByEntity.cleanup();
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

        let cleaned = false;
        const effectStartedAtMs = performance.now();
        let delayedCleanupTimeout: ReturnType<typeof setTimeout> | undefined;
        let maxLifetimeTimeout: ReturnType<typeof setTimeout> | undefined;
        const runCleanupNow = () => {
          if (cleaned) return;
          cleaned = true;
          if (delayedCleanupTimeout) {
            clearTimeout(delayedCleanupTimeout);
            delayedCleanupTimeout = undefined;
          }
          if (maxLifetimeTimeout) {
            clearTimeout(maxLifetimeTimeout);
            maxLifetimeTimeout = undefined;
          }
          end();
          this.travelEffects.delete(key);

          const tracked = this.travelEffectsByEntity.get(selectedEntityId);
          if (tracked?.key === key) {
            this.travelEffectsByEntity.delete(selectedEntityId);
          }
        };
        cleanup = () => {
          if (cleaned) return;
          const delayMs = getMinEffectCleanupDelayMs(
            effectStartedAtMs,
            performance.now(),
            MIN_TRAVEL_EFFECT_VISIBLE_MS,
          );
          if (delayMs === 0) {
            runCleanupNow();
            return;
          }
          if (delayedCleanupTimeout) {
            return;
          }
          delayedCleanupTimeout = setTimeout(() => {
            delayedCleanupTimeout = undefined;
            runCleanupNow();
          }, delayMs);
        };

        // Store the cleanup function with the hex coordinates as key
        this.travelEffects.set(key, cleanup);

        this.travelEffectsByEntity.set(selectedEntityId, { key, cleanup, effectType });
        maxLifetimeTimeout = setTimeout(cleanup, MAX_TRAVEL_EFFECT_LIFETIME_MS);
      }

      // Mark army as having pending movement transaction
      this.markPendingArmyMovement(selectedEntityId);

      // Monitor memory usage before army movement action
      this.memoryMonitor?.getCurrentStats(`worldmap-moveArmy-start-${selectedEntityId}`);

      armyActionManager
        .moveArmy(account!, actionPath, isExplored, getBlockTimestamp().currentArmiesTick)
        .then(() => {
          // Monitor memory usage after army movement completion
          this.memoryMonitor?.getCurrentStats(`worldmap-moveArmy-complete-${selectedEntityId}`);
        })
        .catch((e) => {
          // Transaction failed, remove from pending and cleanup
          this.clearPendingArmyMovement(selectedEntityId);
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

    this.interactionAdapter.openArmyCreation({
      direction,
      structureId: selectedEntityId,
    });
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

    if (!hexCoords) return;

    const structure = new StructureActionManager();

    const playerAddress = useAccountStore.getState().account?.address;

    if (!playerAddress) return;

    const actionPaths = structure.findActionPaths(
      hexCoords,
      this.armyHexes,
      this.exploredTiles,
      ContractAddress(playerAddress),
    );

    this.updateEntityActionPaths(actionPaths.getPaths());

    this.highlightHexManager.highlightHexes(actionPaths.getHighlightDescriptors());

    if (hexCoords) {
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
      this.selectionPulseManager.applyPulsePalette(resolveSelectionPulsePalette("structure"));
    }

    this.applyContextualHoverPalette(this.previouslyHoveredHex ?? null);

    const extraHexes: HexPosition[] = [];
    if (hexCoords) {
      extraHexes.push(hexCoords);
    }
    this.updateStructureOwnershipPulses(selectedEntityId, extraHexes);
  }

  private clearPendingArmyMovement(entityId: ID): void {
    this.pendingArmyMovements.delete(entityId);
    this.pendingArmyMovementStartedAt.delete(entityId);

    const fallbackTimeout = this.pendingArmyMovementFallbackTimeouts.get(entityId);
    if (fallbackTimeout) {
      clearTimeout(fallbackTimeout);
      this.pendingArmyMovementFallbackTimeouts.delete(entityId);
    }

    // Clear any lingering movement fx when pending state is cleared outside
    // of normal movement-start handling (e.g., stale timeout).
    this.travelEffectsByEntity.get(entityId)?.cleanup();
  }

  private markPendingArmyMovement(entityId: ID): void {
    this.pendingArmyMovements.add(entityId);
    this.pendingArmyMovementStartedAt.set(entityId, Date.now());
    this.schedulePendingArmyMovementFallback(entityId);
  }

  private hasPendingTravelEffectForHex(key: string): boolean {
    for (const [entityId, trackedEffect] of this.travelEffectsByEntity.entries()) {
      if (trackedEffect.key === key && this.pendingArmyMovements.has(entityId)) {
        return true;
      }
    }

    return false;
  }

  private schedulePendingArmyMovementFallback(entityId: ID): void {
    const existingFallback = this.pendingArmyMovementFallbackTimeouts.get(entityId);
    if (existingFallback) {
      clearTimeout(existingFallback);
    }

    const fallbackTimeout = setTimeout(() => {
      const fallbackPlan = resolvePendingArmyMovementFallbackPlan({
        hasPendingMovement: this.pendingArmyMovements.has(entityId),
        pendingMovementStartedAtMs: this.pendingArmyMovementStartedAt.get(entityId),
        nowMs: Date.now(),
        staleAfterMs: this.stalePendingArmyMovementMs,
      });

      if (fallbackPlan.shouldDeleteFallbackTimeout) {
        this.pendingArmyMovementFallbackTimeouts.delete(entityId);
        return;
      }

      if (!fallbackPlan.shouldClearPendingMovement) {
        return;
      }

      this.clearPendingArmyMovement(entityId);
      if (fallbackPlan.shouldRequestChunkRefresh) {
        this.requestChunkRefresh(true);
      }

      if (import.meta.env.DEV) {
        console.warn(`[DEBUG] Cleared stale pending movement for army ${entityId} via fallback timeout`);
      }
    }, this.stalePendingArmyMovementMs);

    this.pendingArmyMovementFallbackTimeouts.set(entityId, fallbackTimeout);
  }

  private onArmySelection(
    selectedEntityId: ID,
    playerAddress: ContractAddress,
    options?: { deferDuringChunkTransition?: boolean },
  ): boolean {
    const deferDuringChunkTransition = options?.deferDuringChunkTransition ?? true;

    // Check if army has pending movement transactions
    const selectionPlan = resolvePendingArmyMovementSelectionPlan({
      hasPendingMovement: this.pendingArmyMovements.has(selectedEntityId),
      pendingMovementStartedAtMs: this.pendingArmyMovementStartedAt.get(selectedEntityId),
      nowMs: Date.now(),
      staleAfterMs: this.stalePendingArmyMovementMs,
    });

    if (selectionPlan.shouldClearPendingMovement) {
      this.clearPendingArmyMovement(selectedEntityId);
    }

    if (selectionPlan.shouldRequestChunkRefresh) {
      this.requestChunkRefresh(true);
    }

    if (selectionPlan.shouldBlockSelection) {
      return false;
    }

    // Check if army is currently being rendered or is in chunk transition
    if (this.isChunkTransitioning) {
      if (deferDuringChunkTransition) {
        const retrySelection = () => {
          if (this.armyManager.hasArmy(selectedEntityId)) {
            this.onArmySelection(selectedEntityId, playerAddress);
          } else {
            const shouldQueueRecovery = shouldQueueArmySelectionRecovery({
              deferDuringChunkTransition,
              hasPendingMovement: this.pendingArmyMovements.has(selectedEntityId),
              isChunkTransitioning: this.isChunkTransitioning,
              armyPresentInManager: false,
              recoveryInFlight: this.armySelectionRecoveryInFlight.has(selectedEntityId),
            });

            if (import.meta.env.DEV) {
              console.warn(`[DEBUG] Army ${selectedEntityId} not available after chunk switch`);
            }
            if (shouldQueueRecovery) {
              this.queueArmySelectionRecovery(selectedEntityId, playerAddress);
            }
          }
        };

        // Defer selection until chunk switch completes
        if (this.globalChunkSwitchPromise) {
          this.globalChunkSwitchPromise.then(retrySelection);
        } else {
          setTimeout(retrySelection, 0);
        }
      }

      return false;
    }

    // Ensure army is available for selection
    if (!this.armyManager.hasArmy(selectedEntityId)) {
      if (
        shouldQueueArmySelectionRecovery({
          deferDuringChunkTransition,
          hasPendingMovement: this.pendingArmyMovements.has(selectedEntityId),
          isChunkTransitioning: this.isChunkTransitioning,
          armyPresentInManager: false,
          recoveryInFlight: this.armySelectionRecoveryInFlight.has(selectedEntityId),
        })
      ) {
        this.queueArmySelectionRecovery(selectedEntityId, playerAddress);
      }

      if (import.meta.env.DEV) {
        console.warn(`[DEBUG] Army ${selectedEntityId} not available in current chunk for selection`);
      }

      return false;
    }

    this.state.updateEntityActionSelectedEntityId(selectedEntityId);
    AudioManager.getInstance().play("unit.selected");

    const armyActionManager = new ArmyActionManager(this.dojo.components, this.dojo.systemCalls, selectedEntityId);

    const { currentDefaultTick, currentArmiesTick } = getBlockTimestamp();
    const armyPosition = this.armiesPositions.get(selectedEntityId);
    const explorerTroopsCoord = getComponentValue(
      this.dojo.components.ExplorerTroops,
      getEntityIdFromKeys([BigInt(selectedEntityId)]),
    )?.coord;
    const { startPositionOverride, hasDivergentOrigin } = resolveArmyActionPathOrigin({
      feltCenter: FELT_CENTER(),
      worldmapArmyPosition: armyPosition,
      explorerTroopsCoord,
    });

    if (import.meta.env.DEV && hasDivergentOrigin && armyPosition) {
      console.warn(
        `[DEBUG] Action-path origin divergence for army ${selectedEntityId}: worldmap=(${armyPosition.col},${armyPosition.row}), ecs=(${explorerTroopsCoord?.x},${explorerTroopsCoord?.y})`,
      );
    }

    const actionPaths = armyActionManager.findActionPaths(
      this.structureHexes,
      this.armyHexes,
      this.exploredTiles,
      this.chestHexes,
      currentDefaultTick,
      currentArmiesTick,
      playerAddress,
      startPositionOverride,
    );

    const paths = actionPaths.getPaths();
    const highlightedHexes = actionPaths.getHighlightDescriptors();

    this.updateEntityActionPaths(paths);
    this.highlightHexManager.highlightHexes(highlightedHexes);

    // Show selection pulse for the selected army
    const selectedArmyData = this.armyManager
      .getArmies()
      .find((army) => Number(army.entityId) === Number(selectedEntityId));
    if (armyPosition) {
      const worldPos = getWorldPositionForHex(armyPosition);
      this.selectionPulseManager.showSelection(worldPos.x, worldPos.z, selectedEntityId);
      this.selectionPulseManager.applyPulsePalette(resolveSelectionPulsePalette("army"));
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

    this.updateStructureOwnershipPulses(owningStructureId ?? undefined, extraHexes, extraHexes);
    this.applyContextualHoverPalette(this.previouslyHoveredHex ?? null);
    return true;
  }

  private queueArmySelectionRecovery(selectedEntityId: ID, playerAddress: ContractAddress): void {
    if (this.armySelectionRecoveryInFlight.has(selectedEntityId)) {
      return;
    }

    this.armySelectionRecoveryInFlight.add(selectedEntityId);

    void (async () => {
      try {
        if (this.globalChunkSwitchPromise) {
          await this.globalChunkSwitchPromise;
        }

        await this.updateVisibleChunks(true, { reason: "default" });

        // Army meshes may not be instantiated immediately after chunk refresh.
        // Retry a few times with short delays to let the army manager populate.
        const MAX_RETRIES = 5;
        const RETRY_DELAY_MS = 200;
        for (let i = 0; i <= MAX_RETRIES; i++) {
          if (this.pendingArmyMovements.has(selectedEntityId)) break;

          if (this.armyManager.hasArmy(selectedEntityId)) {
            this.onArmySelection(selectedEntityId, playerAddress, { deferDuringChunkTransition: false });
            return;
          }

          if (i < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }

        if (import.meta.env.DEV) {
          console.warn(
            `[DEBUG] Army ${selectedEntityId} still unavailable after forced chunk refresh during selection recovery`,
          );
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn(`[DEBUG] Army selection recovery failed for ${selectedEntityId}`, error);
        }
      } finally {
        this.armySelectionRecoveryInFlight.delete(selectedEntityId);
      }
    })();
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

  private updateEntityActionPaths(actionPaths: Map<string, ActionPath[]>) {
    // Stamp token before publishing store updates to avoid transient null-token
    // windows inside synchronous subscribers.
    this.actionPathsTransitionToken = actionPaths.size > 0 ? this.chunkTransitionToken : null;
    this.isApplyingLocalActionPathUpdate = true;
    try {
      this.state.updateEntityActionActionPaths(actionPaths);
    } finally {
      this.isApplyingLocalActionPathUpdate = false;
    }
  }

  private syncEntityActionPathsTransitionToken(): void {
    this.actionPathsTransitionToken = resolveEntityActionPathsTransitionTokenSync({
      selectedEntityId: this.state.entityActions.selectedEntityId,
      actionPathCount: this.state.entityActions.actionPaths.size,
      previousTransitionToken: this.actionPathsTransitionToken,
    });
  }

  private isMissingActionPathOwnershipState(): boolean {
    return shouldClearEntitySelectionForMissingActionPathOwnership({
      selectedEntityId: this.state.entityActions.selectedEntityId,
      actionPathCount: this.state.entityActions.actionPaths.size,
      actionPathsTransitionToken: this.actionPathsTransitionToken,
      allowPendingLocalOwnership: this.isApplyingLocalActionPathUpdate,
    });
  }

  private clearEntitySelection() {
    this.highlightHexManager.highlightHexes([]);
    this.updateEntityActionPaths(new Map());
    this.state.updateEntityActionSelectedEntityId(null);
    this.selectionPulseManager.hideSelection(); // Hide selection pulse
    this.selectionPulseManager.clearOwnershipPulses();
    this.applyContextualHoverPalette(this.previouslyHoveredHex ?? null);
    this.armyManager.addLabelsToScene();
    this.structureManager.showLabels();
    this.chestManager.addLabelsToScene();
  }

  private applyContextualHoverPalette(hexCoords: HexPosition | null): void {
    const selectedEntityId = this.state.entityActions.selectedEntityId;
    const hasSelection = selectedEntityId !== null && selectedEntityId !== undefined;
    const actionType = this.getHoveredActionType(hexCoords);

    this.interactiveHexManager.applyHoverPalette(
      resolveHoverVisualPalette({
        hasSelection,
        actionType,
      }),
    );
  }

  private getHoveredActionType(hexCoords: HexPosition | null): ActionType | undefined {
    if (!hexCoords) {
      return undefined;
    }

    const actionPath = this.state.entityActions.actionPaths.get(
      `${hexCoords.col + FELT_CENTER()},${hexCoords.row + FELT_CENTER()}`,
    );
    return actionPath ? ActionPaths.getActionType(actionPath) : undefined;
  }

  private updateStructureOwnershipPulses(
    structureId: ID | undefined,
    extraHexes: HexPosition[] = [],
    suppressedHexes: HexPosition[] = [],
  ) {
    if (structureId === undefined || structureId === null) {
      this.selectionPulseManager.clearOwnershipPulses();
      return;
    }

    const colors = this.getStructurePulseColors(structureId);
    const ownershipHexes = resolveOwnershipPulseHexes({
      structureHex: this.getStructureHexPosition(structureId),
      ownedArmyHexes: [
        ...this.armyManager
          .getArmies()
          .filter((army) => army.owningStructureId === structureId)
          .map((army) => {
            const normalized = army.hexCoords.getNormalized();
            return { col: normalized.x, row: normalized.y };
          }),
        ...Array.from(this.armyStructureOwners.entries())
          .filter(([, ownerStructureId]) => ownerStructureId === structureId)
          .map(([armyId]) => this.armiesPositions.get(armyId)),
      ],
      extraHexes,
      suppressedHexes,
    });

    const positions = ownershipHexes.map((hex) => {
      const worldPos = getWorldPositionForHex(hex);
      return { x: worldPos.x, z: worldPos.z };
    });

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

  protected getWarpTravelLifecycleAdapter(): WarpTravelLifecycleAdapter {
    return {
      onSetupStart: () => this.configureWarpTravelSetupStart(),
      onInitialSetupStart: () => this.prepareWarpTravelInitialSetup(),
      moveCameraToSceneLocation: () => this.moveCameraToURLLocation(),
      attachLabelGroupsToScene: () => this.attachWorldmapLabelGroupsToScene(),
      attachManagerLabels: () => this.attachWorldmapManagerLabels(),
      registerStoreSubscriptions: () => this.registerStoreSubscriptions(),
      setupCameraZoomHandler: () => this.setupCameraZoomHandler(),
      refreshScene: () => this.refreshWarpTravelScene(),
      onInitialSetupComplete: () => this.preloadWorldmapCosmeticAssets(),
      reportSetupError: (error, phase) => this.reportWarpTravelRefreshError(error, phase),
      disposeStoreSubscriptions: () => this.disposeStoreSubscriptions(),
      onAfterDisposeSubscriptions: () => this.disposeWorldUpdateSubscriptions(),
      detachLabelGroupsFromScene: () => this.detachWorldmapLabelGroupsFromScene(),
      detachManagerLabels: () => this.detachWorldmapManagerLabels(),
    };
  }

  private prepareWarpTravelInitialSetup(): void {
    this.clearTileEntityCache();
  }

  private getWorldmapLabelGroups(): Group[] {
    return [this.armyLabelsGroup, this.structureLabelsGroup, this.chestLabelsGroup];
  }

  private attachWorldmapLabelGroupsToScene(): void {
    this.attachWarpTravelLabelGroupsToScene(this.getWorldmapLabelGroups());
  }

  private detachWorldmapLabelGroupsFromScene(): void {
    this.detachWarpTravelLabelGroupsFromScene(this.getWorldmapLabelGroups());
  }

  private attachWorldmapManagerLabels(): void {
    this.armyManager.addLabelsToScene();
    this.structureManager.showLabels();
    this.chestManager.addLabelsToScene();
  }

  private detachWorldmapManagerLabels(): void {
    this.armyManager.removeLabelsFromScene();
    this.structureManager.removeLabelsFromScene();
    this.chestManager.removeLabelsFromScene();
  }

  private async refreshWarpTravelScene(): Promise<void> {
    await this.updateVisibleChunks(true);
  }

  private commitCurrentChunkAuthority(chunkKey: string): void {
    this.currentChunk = chunkKey;
  }

  private unregisterVisibilityChunk(chunkKey: string): void {
    this.visibilityManager?.unregisterChunk(chunkKey);
  }

  private async restorePreviousChunkVisualsAfterRollback(
    oldStartRow: number,
    oldStartCol: number,
    previousChunk: string,
    transitionToken: number,
  ): Promise<void> {
    this.updateCurrentChunkBounds(oldStartRow, oldStartCol);
    await this.updateHexagonGrid(oldStartRow, oldStartCol, this.renderChunkSize.height, this.renderChunkSize.width);
    await this.updateToriiBoundsSubscription(previousChunk, transitionToken);
  }

  private clearSceneChunkBounds(): void {
    this.applySceneChunkBounds(undefined);
  }

  private forceVisibilityManagerUpdate(): void {
    this.visibilityManager?.forceUpdate();
  }

  private queueChunkVisibilityUnregister(chunkKey: string): void {
    this.unregisterChunkOnNextFrame(chunkKey);
  }

  private configureWarpTravelSetupStart(): void {
    this.syncUrlChangedListenerLifecycle("setup");
    this.controls.maxDistance = this.worldmapMaxZoomDistance;
    this.camera.fov = resolveWorldmapCameraFieldOfViewDegrees();
    this.camera.far = 65;
    this.camera.updateProjectionMatrix();
    this.configureWorldmapShadows();
    this.controls.enablePan = true;
    this.controls.enableZoom = false;
    this.controls.zoomToCursor = false;
    this.lastControlsCameraDistance = this.getCurrentCameraDistance();
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
  }

  private preloadWorldmapCosmeticAssets(): void {
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

  private reportWarpTravelRefreshError(error: unknown, phase: "initial" | "resume"): void {
    const message =
      phase === "initial"
        ? "Failed to update visible chunks during initial setup:"
        : "Failed to update visible chunks while resuming worldmap scene:";
    console.error(message, error);
  }

  private resetZoomHardeningRuntimeState(): void {
    const resetState = resetWorldmapZoomHardeningRuntimeState(
      {
        chunkRefreshTimeout: this.chunkRefreshTimeout,
        chunkRefreshRequestToken: this.chunkRefreshRequestToken,
        chunkRefreshAppliedToken: this.chunkRefreshAppliedToken,
        chunkRefreshRunning: this.chunkRefreshRunning,
        chunkRefreshRerunRequested: this.chunkRefreshRerunRequested,
        pendingChunkRefreshForce: this.pendingChunkRefreshForce,
        zeroTerrainFrames: this.zeroTerrainFrames,
        terrainRecoveryInFlight: this.terrainRecoveryInFlight,
      },
      (timeoutId) => clearTimeout(timeoutId),
    );

    this.chunkRefreshTimeout = resetState.chunkRefreshTimeout;
    this.chunkRefreshDeadlineAtMs = null;
    this.chunkRefreshRequestToken = resetState.chunkRefreshRequestToken;
    this.chunkRefreshAppliedToken = resetState.chunkRefreshAppliedToken;
    this.chunkRefreshRunning = resetState.chunkRefreshRunning;
    this.chunkRefreshRerunRequested = resetState.chunkRefreshRerunRequested;
    this.pendingChunkRefreshForce = resetState.pendingChunkRefreshForce;
    this.pendingChunkRefreshUiReason = "default";
    this.zeroTerrainFrames = resetState.zeroTerrainFrames;
    this.terrainRecoveryInFlight = resetState.terrainRecoveryInFlight;
    this.lowTerrainFrames = 0;
    this.offscreenChunkFrames = 0;
    this.zoomRefreshPlannerState = createWorldmapZoomRefreshPlannerState();
    this.lastPublishedStableCameraView = this.zoomCoordinator.getSnapshot().stableBand;
    this.lastPublishedZoomStatus = "idle";
    this.terrainReferenceInstances = 0;
    this.terrainReferenceChunkKey = null;
    this.lastChunkSwitchMovement = null;
    this.isShortcutArmySelectionInFlight = false;
  }

  onSwitchOff(nextSceneName?: SceneName) {
    if (nextSceneName !== SceneName.WorldMap) {
      this.camera.fov = CAMERA_CONFIG.fov;
      this.camera.updateProjectionMatrix();
    }
    this.isSwitchedOff = true;
    const switchOffTransitionState = invalidateWorldmapSwitchOffTransitionState({
      chunkTransitionToken: this.chunkTransitionToken,
      isChunkTransitioning: this.isChunkTransitioning,
      globalChunkSwitchPromise: this.globalChunkSwitchPromise,
    });
    this.chunkTransitionToken = switchOffTransitionState.chunkTransitionToken;
    this.isChunkTransitioning = switchOffTransitionState.isChunkTransitioning;
    this.globalChunkSwitchPromise = switchOffTransitionState.globalChunkSwitchPromise;
    this.syncUrlChangedListenerLifecycle("switchOff");
    this.cancelHexGridComputation?.();
    this.cancelHexGridComputation = undefined;

    // Clear map loading state so "Charting Territories" doesn't persist
    // when switching away while fetches are still in-flight
    this.toriiLoadingCounter = 0;
    this.state.setLoading(LoadingStateKey.Map, false);

    this.runWarpTravelSwitchOffLifecycle();

    // Clean up wheel event listener
    if (this.wheelHandler) {
      const canvas = document.getElementById("main-canvas");
      if (canvas) {
        canvas.removeEventListener("wheel", this.wheelHandler);
      }
      this.wheelHandler = null;
    }

    this.unregisterTrackedVisibilityChunks();
    this.resetZoomHardeningRuntimeState();

    const runtimeState = applyWorldmapSwitchOffRuntimeState({
      pendingArmyRemovals: this.pendingArmyRemovals,
      pendingArmyRemovalMeta: this.pendingArmyRemovalMeta,
      deferredChunkRemovals: this.deferredChunkRemovals,
      armyLastUpdateAt: this.armyLastUpdateAt,
      pendingArmyMovements: this.pendingArmyMovements,
      pendingArmyMovementStartedAt: this.pendingArmyMovementStartedAt,
      pendingArmyMovementFallbackTimeouts: this.pendingArmyMovementFallbackTimeouts,
      armyStructureOwners: this.armyStructureOwners,
      suppressedArmies: this.armyManager.getSuppressedArmiesRef(),
      fetchedChunks: this.fetchedChunks,
      pendingChunks: this.pendingChunks,
      pinnedChunkKeys: this.pinnedChunkKeys,
      pinnedRenderAreas: this.pinnedRenderAreas,
      hydratedChunkRefreshes: this.hydratedChunkRefreshes,
      hydratedRefreshSuppressionAreaKeys: this.hydratedRefreshSuppressionAreaKeys,
      nextSceneName: nextSceneName,
      clearTimeout: (timeoutId) => clearTimeout(timeoutId),
      clearPendingArmyMovement: (entityId) => this.clearPendingArmyMovement(entityId),
      clearStreamingWork: () => this.clearStreamingWorkState(),
      clearQueuedPrefetchState: () => this.clearQueuedPrefetchState(),
      releaseInactiveResources: () => this.clearCache(),
      invalidatePendingFetches: () => {
        this.pendingChunkFetchGeneration = invalidateWorldmapPendingFetchGeneration(this.pendingChunkFetchGeneration);
      },
    });

    this.isSwitchedOff = runtimeState.isSwitchedOff;
    this.toriiLoadingCounter = runtimeState.toriiLoadingCounter;
    this.lastControlsCameraDistance = runtimeState.lastControlsCameraDistance;
    this.currentChunk = runtimeState.currentChunk;

    // Clear follow camera timeout to prevent callback firing on destroyed UI store state
    if (this.followCameraTimeout) {
      clearTimeout(this.followCameraTimeout);
      this.followCameraTimeout = null;
    }

    // Cancel all travel effects and their internal timeouts (maxLifetimeTimeout up to 90s)
    this.travelEffects.forEach((cleanup) => cleanup());
    this.travelEffects.clear();
    this.travelEffectsByEntity.clear();

    // Note: Don't clean up shortcuts here - they should persist across scene switches
    // Shortcuts will be cleaned up when the scene is actually destroyed
  }

  public deleteArmy(entityId: ID, options: { playDefeatFx?: boolean } = {}) {
    const { playDefeatFx = true } = options;
    this.cancelPendingArmyRemoval(entityId);
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
    this.clearPendingArmyMovement(entityId);
  }

  private resolveSupersededPendingArmyRemoval(
    incomingEntityId: ID,
    incomingOwnerAddress: bigint | undefined,
    incomingOwnerStructureId: ID | null | undefined,
    incomingPosition: HexPosition,
  ): void {
    const pending = Array.from(this.pendingArmyRemovalMeta.entries()).map(([entityId, meta]) => ({
      entityId,
      scheduledAt: meta.scheduledAt,
      chunkKey: meta.chunkKey,
      reason: meta.reason,
      ownerAddress: meta.ownerAddress,
      ownerStructureId: meta.ownerStructureId,
      position: meta.position,
    }));

    const supersededEntityId = findSupersededArmyRemoval({
      incomingEntityId,
      incomingOwnerAddress,
      incomingOwnerStructureId,
      incomingPosition,
      pending,
    });

    if (supersededEntityId === undefined) {
      return;
    }

    this.cancelPendingArmyRemoval(supersededEntityId);
    this.deleteArmy(supersededEntityId, { playDefeatFx: false });
  }

  private scheduleArmyRemoval(
    entityId: ID,
    reason: "tile" | "zero" = "tile",
    context?: { ownerAddress?: bigint; ownerStructureId?: ID | null; position?: HexPosition },
  ) {
    const existing = this.pendingArmyRemovals.get(entityId);
    if (existing) {
      clearTimeout(existing);
    }

    const hasPendingMovement = reason === "tile" && this.pendingArmyMovements.has(entityId);
    // Tile removals wait longer (1500ms) to ensure movement updates arrive
    // Zero troop removals are immediate (0ms) since they're confirmed deaths
    const baseDelay = reason === "tile" ? 1500 : 0;
    const initialDelay = hasPendingMovement ? 3000 : baseDelay;
    const retryDelay = 500;
    const maxPendingWaitMs = 10000;

    const scheduledAt = Date.now();
    const removalPosition = context?.position ?? this.armiesPositions.get(entityId);
    const removalOwnerAddress =
      context?.ownerAddress ??
      (removalPosition ? this.armyHexes.get(removalPosition.col)?.get(removalPosition.row)?.owner : undefined);
    const removalOwnerStructureId = context?.ownerStructureId ?? this.armyStructureOwners.get(entityId);
    this.pendingArmyRemovalMeta.set(entityId, {
      scheduledAt,
      chunkKey: this.currentChunk,
      reason,
      ownerAddress: removalOwnerAddress,
      ownerStructureId: removalOwnerStructureId,
      position: removalPosition,
    });

    // Immediately hide the army visually so it doesn't render at a stale
    // position during the deferred removal window
    this.armyManager.hideArmyVisual(entityId);

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
            this.pendingArmyRemovalMeta.delete(entityId);
            this.pendingArmyRemovals.delete(entityId);
            return;
          }

          if (this.currentChunk !== meta.chunkKey) {
            this.deferArmyRemovalDuringChunkSwitch(entityId, reason, meta.scheduledAt);
            return;
          }

          if (this.pendingArmyMovements.has(entityId)) {
            const elapsed = Date.now() - meta.scheduledAt;
            if (elapsed < maxPendingWaitMs) {
              schedule(retryDelay);
              return;
            }

            this.clearPendingArmyMovement(entityId);
          }
        }

        this.pendingArmyRemovals.delete(entityId);
        this.pendingArmyRemovalMeta.delete(entityId);
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
    this.armyManager.unsuppressArmy(entityId);
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
      } else {
        // New army with 0n owner - MapDataStore likely hasn't cached it yet.
        // Resolve owner directly from ECS Structure component using ownerStructureId.
        const resolvedStructureId = ownerStructureId ?? this.armyStructureOwners.get(entityId);
        if (resolvedStructureId) {
          try {
            const components = this.dojo.components as Parameters<typeof ensureStructureSynced>[0];
            const structureEntity = getEntityIdFromKeys([BigInt(resolvedStructureId)]);
            const structureComponent = components.Structure;
            if (structureComponent) {
              const structure = getComponentValue(structureComponent, structureEntity);
              if (structure?.owner) {
                actualOwnerAddress = BigInt(structure.owner);
              }
            }
          } catch {
            // Fall through with 0n if ECS lookup fails
          }
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

    const movedToDifferentHex = !!oldPos && (oldPos.col !== newPos.col || oldPos.row !== newPos.row);

    // End travel/explore FX as soon as the army starts moving (first onchain position change).
    if (movedToDifferentHex) {
      this.travelEffectsByEntity.get(entityId)?.cleanup();
    }

    // Remove from pending movements only after onchain position change.
    if (movedToDifferentHex && this.pendingArmyMovements.has(entityId)) {
      this.clearPendingArmyMovement(entityId);
    }
  }

  public updateStructureHexes(update: {
    entityId: ID;
    hexCoords: HexPosition;
    owner: { address: bigint | undefined };
  }): { oldPos?: HexPosition; newPos: HexPosition } | null {
    const {
      hexCoords: { col, row },
      owner: { address },
      entityId,
    } = update;

    if (address === undefined) return null;
    const normalized = new Position({ x: col, y: row }).getNormalized();
    const newPos = { col: normalized.x, row: normalized.y };
    const oldPos = this.structuresPositions.get(entityId);

    // Remove from old position if it changed
    if (
      oldPos &&
      (oldPos.col !== newPos.col || oldPos.row !== newPos.row) &&
      this.structureHexes.get(oldPos.col)?.get(oldPos.row)?.id === entityId
    ) {
      this.structureHexes.get(oldPos.col)?.delete(oldPos.row);
      gameWorkerManager.updateStructureHex(oldPos.col, oldPos.row, null);
      this.invalidateAllChunkCachesContainingHex(oldPos.col, oldPos.row);
    }

    // Update structure position
    this.structuresPositions.set(entityId, newPos);

    if (!this.structureHexes.has(newPos.col)) {
      this.structureHexes.set(newPos.col, new Map());
    }
    const structureInfo = { id: entityId, owner: address };
    this.structureHexes.get(newPos.col)?.set(newPos.row, structureInfo);
    gameWorkerManager.updateStructureHex(newPos.col, newPos.row, structureInfo);
    this.invalidateAllChunkCachesContainingHex(newPos.col, newPos.row);
    return { oldPos, newPos };
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

    const existingBiome = this.exploredTiles.get(col)?.get(row);
    // If tile was provisionally set by army spawn, treat as new tile (allow overwrite)
    const wasProvisional = existingBiome !== undefined && this.provisionalBiomes.isProvisional(col, row);
    if (wasProvisional) {
      this.provisionalBiomes.clear(col, row);
    }
    const tileAlreadyKnown = !removeExplored && existingBiome !== undefined && !wasProvisional;
    const hasBiomeDelta = !removeExplored && tileAlreadyKnown && existingBiome !== biome;

    // Duplicate tile updates can happen across chunk/bounds churn. Invalidate overlapping caches
    // and force a refresh when the duplicate impacts the currently visible chunk.
    const duplicateTileDecisionInput = {
      removeExplored,
      tileAlreadyKnown,
      hasBiomeDelta,
      currentChunk: this.currentChunk,
      isChunkTransitioning: this.isChunkTransitioning,
      isVisibleInCurrentChunk:
        this.currentChunk !== "null" && !this.isChunkTransitioning ? this.isColRowInVisibleChunk(col, row) : false,
    };
    const duplicateTilePlan = resolveDuplicateTileReconcilePlan(duplicateTileDecisionInput);

    if (duplicateTilePlan.shouldInvalidateCaches) {
      // Critical fix (Stage 0): persist biome delta to authoritative state BEFORE
      // early-returning for reconcile scheduling. Without this, incoming biome
      // changes on already-known tiles are silently dropped from exploredTiles.
      if (duplicateTilePlan.shouldUpdateAuthoritativeState) {
        if (!this.exploredTiles.has(col)) {
          this.exploredTiles.set(col, new Map());
        }
        this.exploredTiles.get(col)!.set(row, biome);
        this.exploredTilesGeneration.bump();
        gameWorkerManager.updateExploredTile(col, row, biome);
        incrementWorldmapRenderCounter("duplicateTileAuthoritativeUpdates");
      }

      this.invalidateAllChunkCachesContainingHex(col, row);
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "duplicate_tile_cache_invalidated");

      if (duplicateTilePlan.reconcileMode === "invalidate_only") {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "duplicate_tile_reconcile_mode_invalidate_only");
      } else if (duplicateTilePlan.reconcileMode === "local_terrain_patch") {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "duplicate_tile_reconcile_mode_local_reconcile");
      } else if (duplicateTilePlan.reconcileMode === "atomic_chunk_refresh") {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "duplicate_tile_reconcile_mode_atomic_refresh");
      }

      if (duplicateTilePlan.refreshStrategy !== "none") {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "duplicate_tile_reconcile_requested");
        if (duplicateTilePlan.refreshStrategy === "immediate") {
          this.requestChunkRefresh(true, "duplicate_tile");
        } else {
          this.requestChunkRefresh(true, "duplicate_tile");
        }
      }

      return;
    }

    // Check if there's a compass effect for this hex and end it
    const key = `${hexCoords.col},${hexCoords.row}`;
    const pendingExploreEntities = resolveExploreCompletionPendingClearPlan({
      exploredHexKey: key,
      trackedEffectsByEntity: this.travelEffectsByEntity,
      pendingArmyMovements: this.pendingArmyMovements,
    });
    for (const entityId of pendingExploreEntities) {
      this.clearPendingArmyMovement(entityId);
    }

    const endCompass = this.travelEffects.get(key);
    if (endCompass && !this.hasPendingTravelEffectForHex(key)) {
      endCompass();
    }

    if (removeExplored) {
      this.exploredTiles.get(col)?.delete(row);
      this.exploredTilesGeneration.bump();

      const [chunkRow, chunkCol] = this.currentChunk.split(",").map(Number);
      if (Number.isFinite(chunkRow) && Number.isFinite(chunkCol)) {
        this.removeCachedMatricesForChunk(chunkRow, chunkCol);
        this.removeCachedMatricesAroundChunk(chunkRow, chunkCol);
      }

      this.requestChunkRefresh(true);
      return;
    }

    // At this point, we know the tile is new (early check at top of function ensures this)
    if (!this.exploredTiles.has(col)) {
      this.exploredTiles.set(col, new Map());
    }
    this.exploredTiles.get(col)!.set(row, biome);
    this.exploredTilesGeneration.bump();
    gameWorkerManager.updateExploredTile(col, row, biome);

    const pos = getWorldPositionForHex({ row, col });

    const isStructure = this.structureManager.structureHexCoords.get(col)?.has(row) || false;
    const shouldHideTile = isStructure;

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

      const hexKey = `${col},${row}`;
      const biomeVariant = getBiomeVariant(biome, col, row);
      const visibleTerrainReconcileMode = resolveVisibleTerrainReconcileMode({
        isVisibleInCurrentChunk: true,
        currentOwner: this.visibleTerrainMembership.get(hexKey) ?? null,
        nextBiomeKey: biomeVariant,
        canDirectReplace: false,
      });

      if (visibleTerrainReconcileMode === "none") {
        return;
      }

      if (visibleTerrainReconcileMode === "atomic_chunk_refresh") {
        incrementWorldmapRenderCounter("terrainVisibleOverlapRepairCount");
        incrementWorldmapRenderCounter("terrainVisibleRebuildCount");
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "refresh_reason_tile_overlap_repair");
        this.requestChunkRefresh(true, "tile_overlap_repair");
        return;
      }

      if (this.isChunkTransitioning) {
        this.requestChunkRefresh(true, "deferred_transition_tile");
        return;
      }

      // Add hex to all interactive hexes
      this.interactiveHexManager.addHex({ col, row });

      // Update which hexes are visible in the current chunk
      this.interactiveHexManager.updateVisibleHexes(chunkCenterRow, chunkCenterCol, chunkWidth, chunkHeight);

      await Promise.all(this.modelLoadPromises);
      dummy.position.copy(pos);
      dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);

      const exploredHexTransform = resolveExploredHexTransform({ isFlatMode: IS_FLAT_MODE });
      dummy.rotation.y = exploredHexTransform.rotationY;
      dummy.position.y += exploredHexTransform.yOffset;

      dummy.updateMatrix();

      const hexMesh = this.biomeModels.get(biomeVariant as BiomeType)!;
      const currentCount = hexMesh.getCount();
      hexMesh.setMatrixAt(currentCount, dummy.matrix);
      hexMesh.setCount(currentCount + 1);
      this.visibleTerrainMembership.set(hexKey, {
        biomeKey: biomeVariant,
        chunkKey: this.currentChunk,
        instanceIndex: currentCount,
      });
      incrementWorldmapRenderCounter("terrainVisibleAppendCount");

      // Cache the updated matrices for the chunk
      const expectedExploredTerrainInstances = this.getExpectedExploredTerrainInstances(
        renderedChunkStartRow,
        renderedChunkStartCol,
      );
      this.cacheMatricesForChunk(renderedChunkStartRow, renderedChunkStartCol, expectedExploredTerrainInstances);
    }
  }

  isColRowInVisibleChunk(col: number, row: number) {
    const startRow = parseInt(this.currentChunk.split(",")[0]);
    const startCol = parseInt(this.currentChunk.split(",")[1]);
    const bounds = getRenderBounds(startRow, startCol, this.renderChunkSize, this.chunkSize);
    const insideChunkBounds =
      col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;

    if (!insideChunkBounds) {
      return false;
    }

    const worldPosition = getWorldPositionForHex({ col, row });
    return this.visibilityManager.isPointVisible(worldPosition);
  }

  /**
   * Structures hide the underlying biome tile. When they change within the current
   * render window we need to refresh the hex grid so tiles don't linger underneath.
   */
  private scheduleTileRefreshIfAffectsCurrentRenderBounds(
    oldHex?: { col: number; row: number } | null,
    newHex?: { col: number; row: number } | null,
  ): void {
    if (
      shouldRequestTileRefreshForStructureBoundsChange({
        currentChunk: this.currentChunk,
        isChunkTransitioning: this.isChunkTransitioning,
        oldHex,
        newHex,
        renderSize: this.renderChunkSize,
        chunkSize: this.chunkSize,
      })
    ) {
      this.requestChunkRefresh(true);
    }
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
    return getRenderOverlapChunkKeys({
      centerChunkKey: chunkKey,
      renderSize: this.renderChunkSize,
      chunkSize: this.chunkSize,
    });
  }

  removeCachedMatricesAroundChunk(chunkRow: number, chunkCol: number) {
    const centerChunkKey = `${chunkRow},${chunkCol}`;
    const neighbors = getRenderOverlapNeighborChunkKeys({
      centerChunkKey,
      renderSize: this.renderChunkSize,
      chunkSize: this.chunkSize,
    });

    neighbors.forEach((chunkKey) => {
      const [startRow, startCol] = chunkKey.split(",").map(Number);
      if (!Number.isFinite(startRow) || !Number.isFinite(startCol)) {
        return;
      }
      this.removeCachedMatricesForChunk(startRow, startCol);
    });
  }

  private aggressivelyInvalidateChunkTerrainCaches(
    centerChunkKey: string,
    options?: { includeSurroundingChunks?: string[]; invalidateFetchAreas?: boolean },
  ): void {
    const targetChunkKeys = new Set<string>([centerChunkKey, ...this.getChunksAround(centerChunkKey)]);
    options?.includeSurroundingChunks?.forEach((chunkKey) => targetChunkKeys.add(chunkKey));

    targetChunkKeys.forEach((chunkKey) => {
      const [chunkRow, chunkCol] = chunkKey.split(",").map(Number);
      if (!Number.isFinite(chunkRow) || !Number.isFinite(chunkCol)) {
        return;
      }
      this.removeCachedMatricesForChunk(chunkRow, chunkCol);
      if (options?.invalidateFetchAreas) {
        this.fetchedChunks.delete(this.getRenderAreaKeyForChunk(chunkKey));
      }
    });
  }

  /**
   * Derive a stable Torii render-area key for a chunk key.
   * Key by Torii "super-area" so overlapping render windows coalesce.
   */
  private getRenderAreaKeyForChunk(chunkKey: string): string {
    return getCanonicalRenderAreaKeyForChunk(
      chunkKey,
      this.chunkSize,
      WORLDMAP_CHUNK_POLICY.toriiFetch.superAreaStrides,
    );
  }

  /**
   * Compute integer fetch bounds that fully cover all render windows inside a Torii super-area.
   */
  private getRenderFetchBoundsForArea(areaKey: string): {
    minCol: number;
    maxCol: number;
    minRow: number;
    maxRow: number;
  } {
    return getCanonicalRenderFetchBoundsForArea(
      areaKey,
      this.renderChunkSize,
      this.chunkSize,
      WORLDMAP_CHUNK_POLICY.toriiFetch.superAreaStrides,
    );
  }

  private invalidateAllChunkCachesContainingHex(col: number, row: number) {
    const overlappingChunkKeys = getChunkKeysContainingHexInRenderBoundsAnalytically({
      col,
      row,
      renderSize: this.renderChunkSize,
      chunkSize: this.chunkSize,
      hasChunkKey: (chunkKey) => this.cachedMatrices.has(chunkKey),
    });

    if (overlappingChunkKeys.length > 0) {
      overlappingChunkKeys.forEach((chunkKey) => {
        const [chunkRow, chunkCol] = chunkKey.split(",").map(Number);
        if (Number.isFinite(chunkRow) && Number.isFinite(chunkCol)) {
          this.removeCachedMatricesForChunk(chunkRow, chunkCol);
        }
      });
      return;
    }

    const pos = getWorldPositionForHex({ row, col });
    const { chunkX, chunkZ } = this.worldToChunkCoordinates(pos.x, pos.z);

    const chunkCol = chunkX * this.chunkSize;
    const chunkRow = chunkZ * this.chunkSize;

    // Fallback: invalidate the containing stride chunk when no cached overlaps are found.
    this.removeCachedMatricesForChunk(chunkRow, chunkCol);
  }

  /**
   * Compute a forward chunk key based on camera movement to prefetch ahead.
   */
  private getDirectionalPrefetchAnchor(focusPoint: Vector3): DirectionalPrefetchAnchor | null {
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
    const movementAxis: "x" | "z" = primaryAxisIsX ? "x" : "z";
    const movementSign = stepSign > 0 ? 1 : -1;

    const strideWorldX = this.chunkSize * HEX_SIZE * Math.sqrt(3);
    const strideWorldZ = this.chunkSize * HEX_SIZE * 1.5;

    const forwardOffsetStrides = WORLDMAP_CHUNK_POLICY.prefetch.forwardDepthStrides;
    const aheadX = primaryAxisIsX ? focusPoint.x + stepSign * strideWorldX * forwardOffsetStrides : focusPoint.x;
    const aheadZ = primaryAxisIsX ? focusPoint.z : focusPoint.z + stepSign * strideWorldZ * forwardOffsetStrides;

    const { chunkX, chunkZ } = this.worldToChunkCoordinates(aheadX, aheadZ);
    return {
      forwardChunkKey: `${chunkZ * this.chunkSize},${chunkX * this.chunkSize}`,
      movementAxis,
      movementSign,
    };
  }

  /**
   * Prefetch the chunk in front of the camera to reduce pop-in.
   */
  private prefetchDirectionalChunks(focusPoint: Vector3) {
    const prefetchPlan = resolveWarpTravelDirectionalPrefetchPlan({
      anchor: this.getDirectionalPrefetchAnchor(focusPoint),
      chunkSize: this.chunkSize,
      forwardDepthStrides: WORLDMAP_CHUNK_POLICY.prefetch.forwardDepthStrides,
      sideRadiusStrides: WORLDMAP_CHUNK_POLICY.prefetch.sideRadiusStrides,
      pinnedChunkKeys: this.pinnedChunkKeys,
      currentChunk: this.currentChunk,
      prefetchedAhead: this.prefetchedAhead,
      maxPrefetchedAhead: this.maxPrefetchedAhead,
      getRenderAreaKeyForChunk: (chunkKey) => this.getRenderAreaKeyForChunk(chunkKey),
    });

    this.directionalPrefetchAreaKeys = new Set(prefetchPlan.desiredAreaKeys);
    this.directionalPresentationChunkKeys = WORLDMAP_STREAMING_ROLLOUT.stagedPathEnabled
      ? new Set(prefetchPlan.presentationChunkKeysToPrewarm)
      : new Set();
    this.pruneQueuedDirectionalPrefetches();
    this.prefetchedAhead.splice(0, this.prefetchedAhead.length, ...prefetchPlan.nextPrefetchedAhead);

    prefetchPlan.chunkKeysToEnqueue.forEach((chunkKey) => {
      // Directional prefetch is lowest priority compared to pinned neighborhood.
      this.enqueueChunkPrefetch(chunkKey, 2);
    });

    if (WORLDMAP_STREAMING_ROLLOUT.stagedPathEnabled) {
      this.directionalPresentationChunkKeys.forEach((chunkKey) => {
        const presentationFetchKey = this.getRenderAreaKeyForChunk(chunkKey);
        if (this.fetchedChunks.has(presentationFetchKey)) {
          void this.prewarmDirectionalPresentationChunk(chunkKey);
        }
      });
    }
  }

  private pruneQueuedDirectionalPrefetches(): void {
    prunePrefetchQueueByFetchKey(this.prefetchQueue, this.directionalPrefetchAreaKeys);
    this.queuedPrefetchAreaKeys = new Set(this.prefetchQueue.map((item) => item.fetchKey));
  }

  private clearQueuedPrefetchState(): void {
    this.prefetchQueue = [];
    this.queuedPrefetchAreaKeys.clear();
    this.directionalPrefetchAreaKeys.clear();
    this.directionalPresentationChunkKeys.clear();
    this.prefetchedAhead.length = 0;
  }

  private enqueueChunkPrefetch(chunkKey: string, priority: number): void {
    const fetchKey = this.getRenderAreaKeyForChunk(chunkKey);
    const enqueueResult = enqueueWarpTravelPrefetch({
      chunkKey,
      fetchKey,
      priority,
      queue: this.prefetchQueue,
      queuedFetchKeys: this.queuedPrefetchAreaKeys,
      fetchedFetchKeys: this.fetchedChunks,
      pendingFetchKeys: this.pendingChunks,
    });
    if (enqueueResult.skipped) {
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "prefetch_skipped");
      return;
    }

    recordChunkDiagnosticsEvent(this.chunkDiagnostics, "prefetch_queued");
    this.processPrefetchQueue();
  }

  private processPrefetchQueue(): void {
    const drainResult = drainWarpTravelPrefetchQueue({
      isSwitchedOff: this.isSwitchedOff,
      queue: this.prefetchQueue,
      queuedFetchKeys: this.queuedPrefetchAreaKeys,
      activePrefetches: this.activePrefetches,
      maxConcurrentPrefetches: this.maxConcurrentPrefetches,
      desiredFetchKeys: this.directionalPrefetchAreaKeys,
      fetchedFetchKeys: this.fetchedChunks,
      pendingFetchKeys: this.pendingChunks,
      pinnedAreaKeys: this.pinnedRenderAreas,
    });

    if (drainResult.shouldClearQueuedState) {
      this.clearQueuedPrefetchState();
      return;
    }

    drainResult.skippedItems.forEach(() => {
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "prefetch_skipped");
    });
    drainResult.startedItems.forEach((item) => {
      this.activePrefetches += 1;
      void (async () => {
        try {
          if (item.fetchTiles) {
            recordChunkDiagnosticsEvent(this.chunkDiagnostics, "prefetch_executed");
            const tileFetchSucceeded = await this.computeTileEntities(item.chunkKey);
            if (tileFetchSucceeded && this.directionalPresentationChunkKeys.has(item.chunkKey)) {
              await this.prewarmDirectionalPresentationChunk(item.chunkKey);
            }
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn("[CHUNK PREFETCH] Prefetch failed for chunk", item.chunkKey, error);
          }
        } finally {
          this.activePrefetches -= 1;
          this.processPrefetchQueue();
        }
      })();
    });
  }

  private async prewarmDirectionalPresentationChunk(chunkKey: string): Promise<void> {
    if (
      !chunkKey ||
      !this.directionalPresentationChunkKeys.has(chunkKey) ||
      this.activeDirectionalPresentationPrewarms.has(chunkKey) ||
      this.cachedMatrices.has(chunkKey)
    ) {
      return;
    }

    const [startRow, startCol] = chunkKey.split(",").map(Number);
    if (!Number.isFinite(startRow) || !Number.isFinite(startCol)) {
      return;
    }

    this.activeDirectionalPresentationPrewarms.add(chunkKey);
    try {
      const prewarmToken = this.chunkTransitionToken;
      await prewarmWorldmapChunkPresentation({
        chunkKey,
        prewarmToken,
        isLatestToken: (token) =>
          token === this.chunkTransitionToken &&
          this.directionalPresentationChunkKeys.has(chunkKey) &&
          !this.isSwitchedOff,
        isPresentationHot: (targetChunkKey) => this.cachedMatrices.has(targetChunkKey),
        preparePresentation: () =>
          prepareWorldmapChunkPresentation({
            chunkKey,
            startRow,
            startCol,
            renderSize: this.renderChunkSize,
            tileFetchPromise: this.computeTileEntities(chunkKey),
            tileHydrationReadyPromise: this.waitForTileHydrationIdle(chunkKey),
            boundsReadyPromise: Promise.resolve(),
            structureReadyPromise: this.waitForStructureHydrationIdle(chunkKey),
            assetPrewarmPromise: this.structureManager.prewarmChunkAssets(chunkKey),
            prepareTerrainChunk: (targetStartRow, targetStartCol, height, width) =>
              this.prepareTerrainChunk(targetStartRow, targetStartCol, height, width),
          }),
        cachePreparedTerrain: (preparedTerrain) =>
          this.cachePreparedTerrainChunk(preparedTerrain as PreparedTerrainChunk),
      });
    } finally {
      this.activeDirectionalPresentationPrewarms.delete(chunkKey);
    }
  }

  private deferManagerCatchUpForChunk(
    chunkKey: string,
    options?: {
      force?: boolean;
      transitionToken?: number;
    },
  ): void {
    if (!WORLDMAP_STREAMING_ROLLOUT.stagedPathEnabled) {
      void this.updateManagersForChunk(chunkKey, options).catch((error) => {
        console.error("[WorldMap] Legacy manager catch-up failed:", error);
      });
      return;
    }

    const uploadWork = classifyWorldmapUploadWork({
      matrixInstanceCount:
        this.armyManager.getVisibleCount() +
        this.structureManager.getVisibleCount() +
        this.chestManager.getVisibleCount(),
      colorInstanceCount: 0,
      isCachedReplay: false,
      stage: "visible_commit",
    });
    const postCommitWorkAction = resolveWorldmapPostCommitWorkAction({
      estimatedUploadBytes: uploadWork.estimatedUploadBytes,
      budgetBytes: this.postCommitManagerCatchUpBudgetBytes,
    });

    this.postCommitManagerCatchUpQueue.push({
      chunkKey,
      options,
      estimatedUploadBytes: uploadWork.estimatedUploadBytes,
      deferredCount: postCommitWorkAction === "deferred" ? 0 : undefined,
    });
    this.schedulePostCommitManagerCatchUpDrain();
  }

  private schedulePostCommitManagerCatchUpDrain(): void {
    if (this.postCommitManagerCatchUpFrameHandle !== null) {
      return;
    }

    const schedule = (callback: () => void) => {
      if (typeof window.requestAnimationFrame === "function") {
        this.postCommitManagerCatchUpFrameHandle = window.requestAnimationFrame(() => callback());
        return;
      }

      this.postCommitManagerCatchUpFrameHandle = window.setTimeout(callback, 0) as unknown as number;
    };

    schedule(() => {
      this.postCommitManagerCatchUpFrameHandle = null;
      this.drainPostCommitManagerCatchUpQueue();
    });
  }

  private drainPostCommitManagerCatchUpQueue(): void {
    const drainResult = drainMultiBudgetedDeferredManagerCatchUpQueue({
      queue: this.postCommitManagerCatchUpQueue,
      budgetBytes: this.postCommitManagerCatchUpBudgetBytes,
    });
    this.postCommitManagerCatchUpQueue = drainResult.remainingQueue;

    if (drainResult.didDeferHeadTask) {
      incrementWorldmapRenderCounter("postCommitManagerCatchUpDeferred");
      this.schedulePostCommitManagerCatchUpDrain();
      return;
    }

    if (drainResult.tasksToRun.length === 0) {
      return;
    }

    void (async () => {
      for (const task of drainResult.tasksToRun) {
        if ((task.deferredCount ?? 0) === 0) {
          incrementWorldmapRenderCounter("postCommitManagerCatchUpImmediate");
        }

        try {
          await deferWarpTravelManagerFanout({
            shouldRun: () =>
              shouldRunManagerUpdate({
                transitionToken: task.options?.transitionToken,
                expectedTransitionToken: this.chunkTransitionToken,
                currentChunk: this.currentChunk,
                targetChunk: task.chunkKey,
              }),
            run: () => this.updateManagersForChunk(task.chunkKey, task.options),
            schedule: (callback) => callback(),
          });
        } catch (error) {
          console.error("[WorldMap] Deferred manager catch-up failed:", error);
        }
      }
    })().finally(() => {
      if (this.postCommitManagerCatchUpQueue.length > 0) {
        this.schedulePostCommitManagerCatchUpDrain();
      }
    });
  }

  private clearStreamingWorkState(): void {
    if (this.postCommitManagerCatchUpFrameHandle !== null) {
      if (typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(this.postCommitManagerCatchUpFrameHandle);
      } else {
        window.clearTimeout(this.postCommitManagerCatchUpFrameHandle);
      }
      this.postCommitManagerCatchUpFrameHandle = null;
    }

    this.postCommitManagerCatchUpQueue = [];
    this.directionalPresentationChunkKeys.clear();
    this.activeDirectionalPresentationPrewarms.clear();
  }

  private unregisterTrackedVisibilityChunks(): void {
    const trackedChunkKeys = new Set<string>(this.pinnedChunkKeys);
    if (this.currentChunk !== "null") {
      trackedChunkKeys.add(this.currentChunk);
    }

    trackedChunkKeys.forEach((chunkKey) => {
      this.visibilityManager?.unregisterChunk(chunkKey);
    });
  }

  clearCache() {
    this.unregisterTrackedVisibilityChunks();
    for (const chunkKey of this.cachedMatrices.keys()) {
      this.disposeCachedMatrices(chunkKey);
    }
    this.cachedMatrices.clear();
    this.cachedMatrixOrder = [];
    this.tileHydrationFetches.clear();
    MatrixPool.getInstance().clear();
    InstancedMatrixAttributePool.getInstance().clear();
    this.pinnedChunkKeys.clear();
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

    if (this.globalChunkSwitchPromise) {
      try {
        await this.globalChunkSwitchPromise;
      } catch (error) {
        console.warn("Previous global chunk switch failed before hydrated refresh:", error);
      }
    }

    const refreshPlan = resolveHydratedChunkRefreshFlushPlan({
      queuedChunkKeys: Array.from(this.hydratedChunkRefreshes),
      currentChunk: this.currentChunk,
      isChunkTransitioning: this.isChunkTransitioning,
    });
    this.hydratedChunkRefreshes = new Set(refreshPlan.remainingQueuedChunkKeys);

    if (refreshPlan.shouldDefer) {
      this.hydratedRefreshScheduled = true;
      Promise.resolve().then(() => this.flushHydratedChunkRefreshes());
      return;
    }

    if (!refreshPlan.shouldForceRefreshCurrentChunk) {
      return;
    }

    try {
      const refreshToken = this.requestChunkRefresh(true, "hydrated_chunk");
      await this.waitForRequestedChunkRefresh(refreshToken);
      this.retryDeferredChunkRemovals();
    } catch (error) {
      console.error(`[CHUNK SYNC] Hydrated chunk refresh failed for ${this.currentChunk}`, error);
    }
  }

  private computeInteractiveHexes(startRow: number, startCol: number, width: number, height: number) {
    const normalizedWidth = Math.max(0, Math.floor(width));
    const normalizedHeight = Math.max(0, Math.floor(height));
    const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);
    const interactiveStartRow = chunkCenterRow - Math.floor(normalizedHeight / 2);
    const interactiveStartCol = chunkCenterCol - Math.floor(normalizedWidth / 2);

    const nextInteractiveHexWindowKey = `${interactiveStartRow}:${interactiveStartCol}:${normalizedWidth}:${normalizedHeight}`;

    if (this.interactiveHexWindowKey !== nextInteractiveHexWindowKey) {
      // Keep interaction state bounded to the active rendered window.
      this.interactiveHexManager.clearHexes();
      for (let row = interactiveStartRow; row < interactiveStartRow + normalizedHeight; row++) {
        for (let col = interactiveStartCol; col < interactiveStartCol + normalizedWidth; col++) {
          this.interactiveHexManager.addHex({ col, row });
        }
      }
      this.interactiveHexWindowKey = nextInteractiveHexWindowKey;
    }

    this.interactiveHexManager.updateVisibleHexes(chunkCenterRow, chunkCenterCol, normalizedWidth, normalizedHeight);
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
    const { row: snapshotCenterRow, col: snapshotCenterCol } = this.getChunkCenter(startRow, startCol);
    const exploredTilesSnapshot = snapshotExploredTilesRegion(this.exploredTiles, {
      centerCol: snapshotCenterCol,
      centerRow: snapshotCenterRow,
      halfCols,
      halfRows,
    });
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
      let expectedExploredTerrainInstances = 0;
      const visibleTerrainOwnership: Array<[string, VisibleTerrainInstanceRef]> = [];
      const fingerprintEntries: Array<{ hexKey: string; biomeKey: string }> = [];

      const tempMatrix = new Matrix4();
      const tempPosition = new Vector3();
      const matrixPool = matrixPoolInstance;
      const hexRadius = HEX_SIZE;
      const hexHeight = hexRadius * 2;
      const hexWidth = Math.sqrt(3) * hexRadius;
      const vertDist = hexHeight * 0.75;
      const horizDist = hexWidth;
      const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);

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
        releaseAllMatrices();
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
            hexMesh.updateMeshVisibility(); // Hide meshes with 0 instances to skip draw calls
            continue;
          }

          matrices.forEach((matrix, index) => {
            hexMesh.setMatrixAt(index, matrix);
          });
          hexMesh.setCount(matrices.length);
          hexMesh.updateMeshVisibility(); // Show meshes that have instances
        }

        this.setVisibleTerrainMembership(visibleTerrainOwnership);
        this.cacheMatricesForChunk(
          startRow,
          startCol,
          expectedExploredTerrainInstances,
          createWorldmapTerrainFingerprint(fingerprintEntries),
          visibleTerrainOwnership,
        );
        this.computeInteractiveHexes(startRow, startCol, cols, rows);

        releaseAllMatrices();

        if (memoryMonitor && preUpdateStats) {
          const postStats = memoryMonitor.getCurrentStats(`hex-grid-generated-${startRow}-${startCol}`);
          const memoryDelta = postStats.heapUsedMB - preUpdateStats.heapUsedMB;

          if (memoryDelta > 15) {
            console.warn(`[HEX GRID] Unexpected memory usage: ${memoryDelta.toFixed(1)}MB`);
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
        const shouldHideTile = isStructure;
        const isExplored = lookupSnapshotBiome(exploredTilesSnapshot, globalCol, globalRow) || false;

        if (shouldHideTile) {
          return;
        }

        tempMatrix.makeScale(HEX_SIZE, HEX_SIZE, HEX_SIZE);
        tempPosition.y += 0.05;

        // Performance simulation: treat all hexes as explored when flag is set
        const effectivelyExplored = isExplored || this.simulateAllExplored;

        if (effectivelyExplored) {
          expectedExploredTerrainInstances += 1;
          // Use actual biome if explored, or generate deterministic biome for simulation
          const biome = isExplored
            ? (isExplored as BiomeType)
            : this.perfSimulation!.getSimulatedBiome(globalCol, globalRow);
          const biomeVariant = getBiomeVariant(biome, globalCol, globalRow);
          const hexKey = `${globalCol},${globalRow}`;
          const instanceIndex = biomeHexes[biomeVariant].length;
          tempMatrix.setPosition(tempPosition);

          const pooledMatrix = matrixPool.getMatrix();
          pooledMatrix.copy(tempMatrix);
          biomeHexes[biomeVariant].push(pooledMatrix);
          visibleTerrainOwnership.push([
            hexKey,
            {
              biomeKey: biomeVariant,
              chunkKey: `${startRow},${startCol}`,
              instanceIndex,
            },
          ]);
          fingerprintEntries.push({ hexKey, biomeKey: biomeVariant });
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

  private cloneInstancedAttribute(attribute: InstancedBufferAttribute, count: number): InstancedBufferAttribute {
    const clone = InstancedMatrixAttributePool.getInstance().acquire(count);
    const requiredFloats = count * clone.itemSize;
    (clone.array as Float32Array).set((attribute.array as Float32Array).subarray(0, requiredFloats));
    return clone;
  }

  private cloneCachedMatrixEntry(entry: CachedMatrixEntry): CachedMatrixEntry {
    return {
      ...entry,
      matrices: entry.matrices ? this.cloneInstancedAttribute(entry.matrices, entry.count) : null,
      landColors: entry.landColors ? new Float32Array(entry.landColors) : null,
      box: entry.box?.clone(),
      sphere: entry.sphere?.clone(),
    };
  }

  private createPreparedTerrainChunkFromCache(startRow: number, startCol: number): PreparedTerrainChunk | null {
    const chunkKey = `${startRow},${startCol}`;
    const cachedMatrices = this.cachedMatrices.get(chunkKey);
    if (!cachedMatrices) {
      return null;
    }

    let totalCachedTerrainInstances = 0;
    let cachedExploredTerrainInstances = 0;
    for (const [biome, entry] of cachedMatrices) {
      if (biome === "__bounds__" || biome === "__meta__") {
        continue;
      }
      const count = Math.max(0, Math.floor(entry.count ?? 0));
      totalCachedTerrainInstances += count;
      if (this.isExploredBiomeCacheKey(biome)) {
        cachedExploredTerrainInstances += count;
      }
    }

    const cachedMetadata = cachedMatrices.get("__meta__");
    if (isTerrainCacheStale(cachedMetadata?.generation, this.exploredTilesGeneration.current())) {
      this.removeCachedMatricesForChunk(startRow, startCol);
      return null;
    }
    const expectedExploredTerrainInstances =
      cachedMetadata?.expectedExploredTerrainInstances ?? this.getExpectedExploredTerrainInstances(startRow, startCol);
    const terrainFingerprint = this.getTerrainFingerprintForChunk(startRow, startCol);
    if (
      this.shouldRejectTerrainCacheSnapshot(totalCachedTerrainInstances) ||
      this.shouldRejectExploredTerrainCacheSnapshot(cachedExploredTerrainInstances, expectedExploredTerrainInstances) ||
      shouldRejectCachedTerrainFingerprintMismatch({
        cachedTerrainFingerprint: cachedMetadata?.terrainFingerprint,
        currentTerrainFingerprint: terrainFingerprint,
      })
    ) {
      if (
        shouldRejectCachedTerrainFingerprintMismatch({
          cachedTerrainFingerprint: cachedMetadata?.terrainFingerprint,
          currentTerrainFingerprint: terrainFingerprint,
        })
      ) {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "cache_reject_fingerprint");
        incrementWorldmapRenderCounter("staleTerrainCacheFingerprintRejectCount");
      }
      this.removeCachedMatricesForChunk(startRow, startCol);
      return null;
    }

    const cachedBounds = cachedMatrices.get("__bounds__");
    const biomeEntries = new Map<string, CachedMatrixEntry>();
    for (const [biome, entry] of cachedMatrices) {
      if (biome === "__bounds__" || biome === "__meta__") {
        continue;
      }
      biomeEntries.set(biome, this.cloneCachedMatrixEntry(entry));
    }

    return {
      chunkKey,
      startRow,
      startCol,
      bounds: {
        box: cachedBounds?.box?.clone() ?? this.computeChunkBounds(startRow, startCol).box,
        sphere: cachedBounds?.sphere?.clone() ?? this.computeChunkBounds(startRow, startCol).sphere,
      },
      expectedExploredTerrainInstances,
      terrainFingerprint: cachedMetadata?.terrainFingerprint ?? terrainFingerprint,
      visibleTerrainOwnership: cachedMetadata?.visibleTerrainOwnership ?? [],
      biomeEntries,
    };
  }

  private async prepareTerrainChunk(
    startRow: number,
    startCol: number,
    rows: number,
    cols: number,
  ): Promise<PreparedTerrainChunk> {
    const cachedChunk = this.createPreparedTerrainChunkFromCache(startRow, startCol);
    if (cachedChunk) {
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "prepared_chunk_prewarm_hit");
      incrementWorldmapRenderCounter("preparedChunkPrewarmHits");
      return cachedChunk;
    }

    recordChunkDiagnosticsEvent(this.chunkDiagnostics, "prepared_chunk_prewarm_miss");
    incrementWorldmapRenderCounter("preparedChunkPrewarmMisses");
    const { row: prepCenterRow, col: prepCenterCol } = this.getChunkCenter(startRow, startCol);
    const prepHalfCols = cols / 2;
    const prepHalfRows = rows / 2;
    const prepSnapshot = snapshotExploredTilesRegion(this.exploredTiles, {
      centerCol: prepCenterCol,
      centerRow: prepCenterRow,
      halfCols: prepHalfCols,
      halfRows: prepHalfRows,
    });
    await Promise.all(this.modelLoadPromises);

    return new Promise<PreparedTerrainChunk>((resolve) => {
      const matrixPool = MatrixPool.getInstance();
      const totalHexes = rows * cols;
      matrixPool.ensureCapacity(totalHexes + 512);

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

      const halfRows = rows / 2;
      const halfCols = cols / 2;
      const minBatch = Math.min(this.hexGridMinBatch, totalHexes);
      const maxBatch = Math.max(minBatch, Math.min(this.hexGridMaxBatch, totalHexes));
      const frameBudget = this.hexGridFrameBudgetMs;
      const tempMatrix = new Matrix4();
      const tempPosition = new Vector3();
      const hexRadius = HEX_SIZE;
      const hexHeight = hexRadius * 2;
      const hexWidth = Math.sqrt(3) * hexRadius;
      const vertDist = hexHeight * 0.75;
      const horizDist = hexWidth;
      const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);
      let currentIndex = 0;
      let expectedExploredTerrainInstances = 0;
      let frameHandle: number | null = null;
      const visibleTerrainOwnership: Array<[string, VisibleTerrainInstanceRef]> = [];
      const fingerprintEntries: Array<{ hexKey: string; biomeKey: string }> = [];

      const releaseAllMatrices = () => {
        Object.values(biomeHexes).forEach((matrices) => {
          matrices.forEach((matrix) => matrixPool.releaseMatrix(matrix));
          matrices.length = 0;
        });
      };

      const finalizeSuccess = () => {
        const biomeEntries = new Map<string, CachedMatrixEntry>();
        for (const [biome, matrices] of Object.entries(biomeHexes)) {
          if (matrices.length === 0) {
            biomeEntries.set(biome, { matrices: null, count: 0, landColors: null });
            continue;
          }

          const attribute = InstancedMatrixAttributePool.getInstance().acquire(matrices.length);
          const targetArray = attribute.array as Float32Array;
          matrices.forEach((matrix, index) => {
            targetArray.set(matrix.elements, index * 16);
          });
          biomeEntries.set(biome, {
            matrices: attribute,
            count: matrices.length,
            landColors: null,
          });
        }

        releaseAllMatrices();
        if (frameHandle !== null) {
          cancelAnimationFrame(frameHandle);
        }
        resolve({
          chunkKey: `${startRow},${startCol}`,
          startRow,
          startCol,
          bounds: this.computeChunkBounds(startRow, startCol),
          expectedExploredTerrainInstances,
          terrainFingerprint: createWorldmapTerrainFingerprint(fingerprintEntries),
          visibleTerrainOwnership,
          biomeEntries,
        });
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
        const isExplored = lookupSnapshotBiome(prepSnapshot, globalCol, globalRow) || false;

        if (isStructure) {
          return;
        }

        tempMatrix.makeScale(HEX_SIZE, HEX_SIZE, HEX_SIZE);
        tempPosition.y += 0.05;

        const effectivelyExplored = isExplored || this.simulateAllExplored;
        if (effectivelyExplored) {
          expectedExploredTerrainInstances += 1;
          const biome = isExplored
            ? (isExplored as BiomeType)
            : this.perfSimulation!.getSimulatedBiome(globalCol, globalRow);
          const biomeVariant = getBiomeVariant(biome, globalCol, globalRow);
          const hexKey = `${globalCol},${globalRow}`;
          const instanceIndex = biomeHexes[biomeVariant].length;
          tempMatrix.setPosition(tempPosition);

          const pooledMatrix = matrixPool.getMatrix();
          pooledMatrix.copy(tempMatrix);
          biomeHexes[biomeVariant].push(pooledMatrix);
          visibleTerrainOwnership.push([
            hexKey,
            {
              biomeKey: biomeVariant,
              chunkKey: `${startRow},${startCol}`,
              instanceIndex,
            },
          ]);
          fingerprintEntries.push({ hexKey, biomeKey: biomeVariant });
          return;
        }

        tempPosition.y = 0.01;
        tempMatrix.setPosition(tempPosition);

        const pooledMatrix = matrixPool.getMatrix();
        pooledMatrix.copy(tempMatrix);
        biomeHexes.Outline.push(pooledMatrix);
      };

      const processFrame = () => {
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
          frameHandle = requestAnimationFrame(processFrame);
        } else {
          finalizeSuccess();
        }
      };

      frameHandle = requestAnimationFrame(processFrame);
    });
  }

  private cachePreparedTerrainChunk(preparedTerrain: PreparedTerrainChunk): void {
    const chunkKey = preparedTerrain.chunkKey;
    this.disposeCachedMatrices(chunkKey);

    const cachedChunk = new Map<string, CachedMatrixEntry>();
    preparedTerrain.biomeEntries.forEach((entry, biome) => {
      cachedChunk.set(biome, {
        matrices: entry.matrices,
        count: entry.count,
        landColors: entry.landColors ? new Float32Array(entry.landColors) : null,
      });
    });
    cachedChunk.set("__bounds__", {
      matrices: null,
      count: 0,
      box: preparedTerrain.bounds.box.clone(),
      sphere: preparedTerrain.bounds.sphere.clone(),
    });
    cachedChunk.set("__meta__", {
      matrices: null,
      count: 0,
      expectedExploredTerrainInstances: preparedTerrain.expectedExploredTerrainInstances,
      terrainFingerprint: preparedTerrain.terrainFingerprint,
      visibleTerrainOwnership: preparedTerrain.visibleTerrainOwnership,
      generation: this.exploredTilesGeneration.current(),
    });

    this.cachedMatrices.set(chunkKey, cachedChunk);
    this.touchMatrixCache(chunkKey);
    this.ensureMatrixCacheLimit();
  }

  private applyPreparedTerrainChunk(preparedTerrain: PreparedTerrainChunk): void {
    this.biomeModels.forEach((hexMesh, biome) => {
      const entry = preparedTerrain.biomeEntries.get(String(biome));
      if (!entry) {
        hexMesh.setCount(0);
        hexMesh.updateMeshVisibility();
        return;
      }

      if (entry.matrices) {
        hexMesh.setMatricesAndCount(entry.matrices, entry.count);
      } else {
        hexMesh.setCount(entry.count);
      }
      hexMesh.updateMeshVisibility();

      if (entry.landColors && entry.count > 0) {
        const landMeshes = hexMesh.instancedMeshes.filter((mesh) => mesh.name === LAND_NAME);
        landMeshes.forEach((mesh) => {
          if (!mesh.instanceColor || (mesh.instanceColor.array as Float32Array).length < entry.count * 3) {
            mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 3), 3);
            mesh.geometry.setAttribute("instanceColor", mesh.instanceColor);
          }
          (mesh.instanceColor.array as Float32Array).set(entry.landColors!);
          mesh.instanceColor.needsUpdate = true;
        });
      }
    });

    this.cachePreparedTerrainChunk(preparedTerrain);
    this.setVisibleTerrainMembership(preparedTerrain.visibleTerrainOwnership);
    this.computeInteractiveHexes(
      preparedTerrain.startRow,
      preparedTerrain.startCol,
      this.renderChunkSize.width,
      this.renderChunkSize.height,
    );
  }

  private updatePinnedChunks(newChunkKeys: string[]): void {
    const nextPinned = new Set(newChunkKeys);
    const prevPinned = this.pinnedChunkKeys;
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

    prevPinned.forEach((chunkKey) => {
      if (!nextPinned.has(chunkKey)) {
        removedPinnedChunks.push(chunkKey);
      }
    });

    // Drop cached tile data for render areas that are no longer covered.
    // Keep in-flight pending promises for dedupe stability while they resolve.
    removedPinnedAreas.forEach((areaKey) => {
      this.fetchedChunks.delete(areaKey);
    });

    this.pinnedChunkKeys = nextPinned;
    this.pinnedRenderAreas = nextPinnedAreas;
    this.pruneQueuedDirectionalPrefetches();

    removedPinnedChunks.forEach((chunkKey) => {
      if (chunkKey !== this.currentChunk) {
        this.visibilityManager?.unregisterChunk(chunkKey);
      }
    });
  }

  private incrementToriiBoundsCounter(key: ToriiBoundsCounterKey): void {
    if (!TORII_BOUNDS_DEBUG) {
      return;
    }

    this.toriiBoundsUpdateCounts[key] += 1;
  }

  private resetToriiBoundsCounters(): void {
    this.toriiBoundsUpdateCounts = {
      tiles: 0,
      structureTiles: 0,
      structures: 0,
      structureBuildings: 0,
      explorerTiles: 0,
      explorerTroops: 0,
    };
  }

  private startToriiBoundsCounterLog(): void {
    if (!TORII_BOUNDS_DEBUG || this.toriiBoundsLogInterval) {
      return;
    }

    this.resetToriiBoundsCounters();
    this.toriiBoundsLogInterval = setInterval(() => {
      const snapshot = { ...this.toriiBoundsUpdateCounts };
      const total = Object.values(snapshot).reduce((sum, value) => sum + value, 0);
      console.log("[ToriiBounds] Update counts (last 5s)", {
        areaKey: this.toriiBoundsAreaKey,
        chunkKey: this.currentChunk,
        counts: snapshot,
        total,
      });
      this.resetToriiBoundsCounters();
    }, 5000);
  }

  private stopToriiBoundsCounterLog(): void {
    if (!this.toriiBoundsLogInterval) {
      return;
    }

    clearInterval(this.toriiBoundsLogInterval);
    this.toriiBoundsLogInterval = null;
  }

  private async updateToriiBoundsSubscription(chunkKey: string, transitionToken?: number): Promise<void> {
    if (transitionToken !== undefined && transitionToken !== this.chunkTransitionToken) {
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "bounds_switch_skipped_stale_token");
      return;
    }

    if (!this.toriiStreamManager || !chunkKey || chunkKey === "null") {
      return;
    }

    recordChunkDiagnosticsEvent(this.chunkDiagnostics, "bounds_switch_requested");

    const areaKey = this.getRenderAreaKeyForChunk(chunkKey);
    if (areaKey === this.toriiBoundsAreaKey) {
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "bounds_switch_skipped_same_signature");
      if (TORII_BOUNDS_DEBUG) {
        console.log("[ToriiBounds] Skip switch (area unchanged)", { chunkKey, areaKey });
      }
      return;
    }

    const { minCol, maxCol, minRow, maxRow } = this.getRenderFetchBoundsForArea(areaKey);
    const feltCenter = FELT_CENTER();
    const descriptor: BoundsDescriptor = {
      minCol: minCol + feltCenter,
      maxCol: maxCol + feltCenter,
      minRow: minRow + feltCenter,
      maxRow: maxRow + feltCenter,
      models: TORII_BOUNDS_MODELS,
    };

    try {
      if (TORII_BOUNDS_DEBUG) {
        console.log("[ToriiBounds] Switching bounds", {
          chunkKey,
          areaKey,
          bounds: { minCol, maxCol, minRow, maxRow },
          models: TORII_BOUNDS_MODELS.map((model) => model.model),
        });
      }
      const result = await this.toriiStreamManager.switchBounds(descriptor);
      if (result.outcome === "stale_dropped") {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "bounds_switch_stale_dropped");
        return;
      }
      if (result.outcome === "skipped_same_signature") {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "bounds_switch_skipped_same_signature");
      }
      if (transitionToken !== undefined && transitionToken !== this.chunkTransitionToken) {
        return;
      }
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "bounds_switch_applied");
      this.toriiBoundsAreaKey = areaKey;
    } catch (error) {
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "bounds_switch_failed");
      console.warn("[WorldmapScene] Failed to switch Torii bounds subscription", error);
    }
  }

  private addWorldUpdateSubscription(unsub: unknown) {
    if (typeof unsub === "function") {
      this.worldUpdateUnsubscribes.push(unsub as () => void);
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

  private beginToriiFetch() {
    if (this.isSwitchedOff) return;
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

  private async computeTileEntities(chunkKey: string): Promise<boolean> {
    if (this.isSwitchedOff) {
      return false;
    }

    const fetchKey = this.getRenderAreaKeyForChunk(chunkKey);
    if (this.fetchedChunks.has(fetchKey)) {
      return true;
    }

    const existingPromise = this.pendingChunks.get(fetchKey);
    if (existingPromise) {
      return existingPromise;
    }

    const { minCol, maxCol, minRow, maxRow } = this.getRenderFetchBoundsForArea(fetchKey);

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

    this.beginTileHydrationFetch(fetchKey, this.pendingChunkFetchGeneration, minCol, maxCol, minRow, maxRow);
    this.beginStructureHydrationFetch(fetchKey, this.pendingChunkFetchGeneration, minCol, maxCol, minRow, maxRow);
    const fetchPromise = this.executeTileEntitiesFetch(
      fetchKey,
      minCol,
      maxCol,
      minRow,
      maxRow,
      this.pendingChunkFetchGeneration,
    );
    const ownedFetchPromise = fetchPromise.finally(() => {
      finalizePendingChunkFetchOwnership({
        pendingChunks: this.pendingChunks,
        fetchKey,
        fetchPromise: ownedFetchPromise,
      });
    });
    recordChunkDiagnosticsEvent(this.chunkDiagnostics, "tile_fetch_started");
    this.pendingChunks.set(fetchKey, ownedFetchPromise);

    return ownedFetchPromise;
  }

  private beginStructureHydrationFetch(
    fetchKey: string,
    fetchGeneration: number,
    minCol: number,
    maxCol: number,
    minRow: number,
    maxRow: number,
  ): void {
    this.structureHydrationFetches.set(fetchKey, {
      fetchGeneration,
      minCol,
      maxCol,
      minRow,
      maxRow,
      pendingCount: 0,
      fetchSettled: false,
      waiters: [],
    });
  }

  private beginTileHydrationFetch(
    fetchKey: string,
    fetchGeneration: number,
    minCol: number,
    maxCol: number,
    minRow: number,
    maxRow: number,
  ): void {
    this.tileHydrationFetches.set(fetchKey, {
      fetchGeneration,
      minCol,
      maxCol,
      minRow,
      maxRow,
      pendingCount: 0,
      fetchSettled: false,
      waiters: [],
    });
  }

  private settleStructureHydrationFetch(fetchKey: string, fetchGeneration: number): void {
    const state = this.structureHydrationFetches.get(fetchKey);
    if (!state || state.fetchGeneration !== fetchGeneration) {
      return;
    }

    state.fetchSettled = true;
    this.flushStructureHydrationWaiters(fetchKey, state);
  }

  private flushStructureHydrationWaiters(fetchKey: string, state: StructureHydrationFetchState): void {
    if (!state.fetchSettled || state.pendingCount > 0) {
      return;
    }

    const waiters = [...state.waiters];
    state.waiters.length = 0;
    waiters.forEach((resolve) => resolve());
    this.structureHydrationFetches.set(fetchKey, state);
  }

  private settleTileHydrationFetch(fetchKey: string, fetchGeneration: number): void {
    const state = this.tileHydrationFetches.get(fetchKey);
    if (!state || state.fetchGeneration !== fetchGeneration) {
      return;
    }

    state.fetchSettled = true;
    this.flushTileHydrationWaiters(fetchKey, state);
  }

  private flushTileHydrationWaiters(fetchKey: string, state: TileHydrationFetchState): void {
    if (!state.fetchSettled || state.pendingCount > 0) {
      return;
    }

    const waiters = [...state.waiters];
    state.waiters.length = 0;
    waiters.forEach((resolve) => resolve());
    this.tileHydrationFetches.set(fetchKey, state);
  }

  private async waitForStructureHydrationIdle(chunkKey: string): Promise<void> {
    const fetchKey = this.getRenderAreaKeyForChunk(chunkKey);

    while (true) {
      const state = this.structureHydrationFetches.get(fetchKey);
      if (!state) {
        return;
      }

      if (state.fetchSettled && state.pendingCount === 0) {
        await Promise.resolve();
        const refreshed = this.structureHydrationFetches.get(fetchKey);
        if (!refreshed || (refreshed.fetchSettled && refreshed.pendingCount === 0)) {
          return;
        }
      }

      await new Promise<void>((resolve) => {
        const currentState = this.structureHydrationFetches.get(fetchKey);
        if (!currentState) {
          resolve();
          return;
        }
        currentState.waiters.push(resolve);
        this.flushStructureHydrationWaiters(fetchKey, currentState);
      });

      await Promise.resolve();
      const refreshed = this.structureHydrationFetches.get(fetchKey);
      if (!refreshed || (refreshed.fetchSettled && refreshed.pendingCount === 0)) {
        return;
      }
    }
  }

  private async waitForTileHydrationIdle(chunkKey: string): Promise<void> {
    const fetchKey = this.getRenderAreaKeyForChunk(chunkKey);

    while (true) {
      const state = this.tileHydrationFetches.get(fetchKey);
      if (!state) {
        return;
      }

      if (state.fetchSettled && state.pendingCount === 0) {
        await Promise.resolve();
        const refreshed = this.tileHydrationFetches.get(fetchKey);
        if (!refreshed || (refreshed.fetchSettled && refreshed.pendingCount === 0)) {
          return;
        }
      }

      await new Promise<void>((resolve) => {
        const currentState = this.tileHydrationFetches.get(fetchKey);
        if (!currentState) {
          resolve();
          return;
        }
        currentState.waiters.push(resolve);
        this.flushTileHydrationWaiters(fetchKey, currentState);
      });

      await Promise.resolve();
      const refreshed = this.tileHydrationFetches.get(fetchKey);
      if (!refreshed || (refreshed.fetchSettled && refreshed.pendingCount === 0)) {
        return;
      }
    }
  }

  private trackStructureHydrationUpdate(update: { hexCoords: HexPosition }, work: Promise<void>): Promise<void> {
    const normalized = new Position({ x: update.hexCoords.col, y: update.hexCoords.row }).getNormalized();
    const matchedFetchKeys: string[] = [];

    this.structureHydrationFetches.forEach((state, fetchKey) => {
      if (
        normalized.x >= state.minCol &&
        normalized.x <= state.maxCol &&
        normalized.y >= state.minRow &&
        normalized.y <= state.maxRow
      ) {
        state.pendingCount += 1;
        matchedFetchKeys.push(fetchKey);
      }
    });

    if (matchedFetchKeys.length === 0) {
      return work;
    }

    return work.finally(() => {
      matchedFetchKeys.forEach((fetchKey) => {
        const state = this.structureHydrationFetches.get(fetchKey);
        if (!state) {
          return;
        }
        state.pendingCount = Math.max(0, state.pendingCount - 1);
        this.flushStructureHydrationWaiters(fetchKey, state);
      });
    });
  }

  private trackTileHydrationUpdate(update: { hexCoords: HexPosition }, work: Promise<void>): Promise<void> {
    const normalized = new Position({ x: update.hexCoords.col, y: update.hexCoords.row }).getNormalized();
    const matchedFetchKeys: string[] = [];

    this.tileHydrationFetches.forEach((state, fetchKey) => {
      if (
        normalized.x >= state.minCol &&
        normalized.x <= state.maxCol &&
        normalized.y >= state.minRow &&
        normalized.y <= state.maxRow
      ) {
        state.pendingCount += 1;
        matchedFetchKeys.push(fetchKey);
      }
    });

    if (matchedFetchKeys.length === 0) {
      return work;
    }

    return work.finally(() => {
      matchedFetchKeys.forEach((fetchKey) => {
        const state = this.tileHydrationFetches.get(fetchKey);
        if (!state) {
          return;
        }
        state.pendingCount = Math.max(0, state.pendingCount - 1);
        this.flushTileHydrationWaiters(fetchKey, state);
      });
    });
  }

  private async executeTileEntitiesFetch(
    fetchKey: string,
    minCol: number,
    maxCol: number,
    minRow: number,
    maxRow: number,
    fetchGeneration: number,
  ): Promise<boolean> {
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
      if (
        shouldApplyWorldmapFetchResult({
          fetchGeneration,
          activeFetchGeneration: this.pendingChunkFetchGeneration,
          fetchKey,
          pinnedRenderAreas: this.pinnedRenderAreas,
        })
      ) {
        this.fetchedChunks.add(fetchKey);
        const currentAreaKey = this.currentChunk !== "null" ? this.getRenderAreaKeyForChunk(this.currentChunk) : null;
        if (
          shouldScheduleHydratedChunkRefreshForFetch({
            fetchAreaKey: fetchKey,
            currentAreaKey,
            suppressedAreaKeys: this.hydratedRefreshSuppressionAreaKeys,
          })
        ) {
          this.scheduleHydratedChunkRefresh(this.currentChunk);
        }
      }
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "tile_fetch_succeeded");
      return true;
    } catch (error) {
      console.error("Error fetching tile entities:", error);
      // Don't add to fetchedChunks on error so it can be retried
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "tile_fetch_failed");
      return false;
    } finally {
      this.settleTileHydrationFetch(fetchKey, fetchGeneration);
      this.settleStructureHydrationFetch(fetchKey, fetchGeneration);
      this.endToriiFetch();
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
    const { evictedKeys, limitedByPinning } = computeMatrixCacheEvictions(
      this.cachedMatrixOrder,
      this.pinnedChunkKeys,
      this.maxMatrixCacheSize,
    );

    for (const key of evictedKeys) {
      this.disposeCachedMatrices(key);
      this.cachedMatrices.delete(key);
    }

    // Rebuild the order array without evicted keys (preserves relative order).
    if (evictedKeys.length > 0) {
      const evictedSet = new Set(evictedKeys);
      this.cachedMatrixOrder = this.cachedMatrixOrder.filter((k) => !evictedSet.has(k));
    }

    if (limitedByPinning) {
      console.warn(
        `[CACHE] Unable to evict matrices below limit because pinned chunks exceed capacity (${this.maxMatrixCacheSize})`,
      );
    }
  }

  private getRenderHexCapacity(): number {
    return Math.max(1, this.renderChunkSize.width * this.renderChunkSize.height);
  }

  private shouldRejectTerrainCacheSnapshot(totalCachedTerrainInstances: number): boolean {
    return shouldRejectCachedTerrainSnapshot({
      totalCachedTerrainInstances,
      renderHexCapacity: this.getRenderHexCapacity(),
      minCoverageFraction: this.minCachedTerrainCoverageFraction,
    });
  }

  private shouldRejectExploredTerrainCacheSnapshot(
    cachedExploredTerrainInstances: number,
    expectedExploredTerrainInstances: number,
  ): boolean {
    return shouldRejectCachedExploredTerrainSnapshot({
      cachedExploredTerrainInstances,
      expectedExploredTerrainInstances,
      minRetentionFraction: this.minCachedExploredRetentionFraction,
      minExpectedExploredInstances: this.minExpectedExploredForCacheValidation,
    });
  }

  private isExploredBiomeCacheKey(biomeKey: string): boolean {
    const normalizedKey = biomeKey.toLowerCase();
    return normalizedKey !== "outline" && normalizedKey !== "none";
  }

  private setVisibleTerrainMembership(ownershipEntries: Array<[string, VisibleTerrainInstanceRef]>): void {
    const membershipResult = buildVisibleTerrainMembership(
      ownershipEntries.map(([hexKey, owner]) => ({
        hexKey,
        biomeKey: owner.biomeKey,
        chunkKey: owner.chunkKey,
        instanceIndex: owner.instanceIndex,
      })),
    );

    this.visibleTerrainMembership = membershipResult.membership;
  }

  private getTerrainFingerprintForChunk(startRow: number, startCol: number): string {
    const bounds = getRenderBounds(startRow, startCol, this.renderChunkSize, this.chunkSize);
    const fingerprintEntries: Array<{ hexKey: string; biomeKey: string }> = [];

    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
      for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
        const isStructure = this.structureManager.structureHexCoords.get(col)?.has(row) || false;
        if (isStructure) {
          continue;
        }

        const exploredBiome = this.exploredTiles.get(col)?.get(row);
        if (!exploredBiome && !this.simulateAllExplored) {
          continue;
        }

        const biome = exploredBiome ?? this.perfSimulation!.getSimulatedBiome(col, row);
        fingerprintEntries.push({
          hexKey: `${col},${row}`,
          biomeKey: getBiomeVariant(biome, col, row),
        });
      }
    }

    return createWorldmapTerrainFingerprint(fingerprintEntries);
  }

  private getExpectedExploredTerrainInstances(startRow: number, startCol: number): number {
    const bounds = getRenderBounds(startRow, startCol, this.renderChunkSize, this.chunkSize);
    let expectedExploredTerrainInstances = 0;

    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
      for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
        const isStructure = this.structureManager.structureHexCoords.get(col)?.has(row) || false;
        if (isStructure) {
          continue;
        }

        if (this.simulateAllExplored || this.exploredTiles.get(col)?.has(row)) {
          expectedExploredTerrainInstances += 1;
        }
      }
    }

    return expectedExploredTerrainInstances;
  }

  private cacheMatricesForChunk(
    startRow: number,
    startCol: number,
    expectedExploredTerrainInstances: number,
    terrainFingerprint: string = this.getTerrainFingerprintForChunk(startRow, startCol),
    visibleTerrainOwnership: Array<[string, VisibleTerrainInstanceRef]> = Array.from(
      this.visibleTerrainMembership.entries(),
    ),
  ) {
    const chunkKey = `${startRow},${startCol}`;
    if (!this.cachedMatrices.has(chunkKey)) {
      this.cachedMatrices.set(chunkKey, new Map());
    }

    const cachedChunk = this.cachedMatrices.get(chunkKey)!;
    let totalCachedTerrainInstances = 0;
    let cachedExploredTerrainInstances = 0;

    const { box, sphere } = this.computeChunkBounds(startRow, startCol);
    for (const [biome, model] of this.biomeModels) {
      const existing = cachedChunk.get(biome);
      if (existing) {
        if (existing.matrices) {
          this.releaseInstancedAttribute(existing.matrices);
        }
      }
      const { matrices, count } = model.getMatricesAndCount();
      totalCachedTerrainInstances += count;
      if (this.isExploredBiomeCacheKey(String(biome))) {
        cachedExploredTerrainInstances += count;
      }
      if (count === 0) {
        this.releaseInstancedAttribute(matrices);
        cachedChunk.set(biome, { matrices: null, count, landColors: null });
        continue;
      }
      const landMesh = model.instancedMeshes.find((mesh) => mesh.name === LAND_NAME);
      let landColors: Float32Array | null = null;
      if (landMesh?.instanceColor) {
        const source = landMesh.instanceColor.array as Float32Array;
        const requiredFloats = count * 3;
        landColors = new Float32Array(requiredFloats);
        landColors.set(source.subarray(0, requiredFloats));
      }

      cachedChunk.set(biome, { matrices, count, landColors });
    }

    if (
      this.shouldRejectTerrainCacheSnapshot(totalCachedTerrainInstances) ||
      this.shouldRejectExploredTerrainCacheSnapshot(cachedExploredTerrainInstances, expectedExploredTerrainInstances)
    ) {
      if (import.meta.env.DEV) {
        console.warn("[CACHE] Rejecting suspicious terrain snapshot", {
          chunkKey,
          totalCachedTerrainInstances,
          cachedExploredTerrainInstances,
          expectedExploredTerrainInstances,
          renderHexCapacity: this.getRenderHexCapacity(),
          minCoverageFraction: this.minCachedTerrainCoverageFraction,
          minExploredRetentionFraction: this.minCachedExploredRetentionFraction,
        });
      }
      this.disposeCachedMatrices(chunkKey);
      this.cachedMatrices.delete(chunkKey);
      const existingIndex = this.cachedMatrixOrder.indexOf(chunkKey);
      if (existingIndex !== -1) {
        this.cachedMatrixOrder.splice(existingIndex, 1);
      }
      return;
    }

    cachedChunk.set("__bounds__", {
      matrices: null as InstancedBufferAttribute | null,
      count: 0,
      box,
      sphere,
    });
    cachedChunk.set("__meta__", {
      matrices: null,
      count: 0,
      expectedExploredTerrainInstances,
      terrainFingerprint,
      visibleTerrainOwnership,
      generation: this.exploredTilesGeneration.current(),
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
      let totalCachedTerrainInstances = 0;
      let cachedExploredTerrainInstances = 0;
      for (const [biome, entry] of cachedMatrices) {
        if (biome === "__bounds__" || biome === "__meta__") {
          continue;
        }
        const count = Math.max(0, Math.floor(entry.count ?? 0));
        totalCachedTerrainInstances += count;
        if (this.isExploredBiomeCacheKey(biome)) {
          cachedExploredTerrainInstances += count;
        }
      }

      const cachedMetadata = cachedMatrices.get("__meta__");
      const expectedExploredTerrainInstances =
        cachedMetadata?.expectedExploredTerrainInstances ??
        this.getExpectedExploredTerrainInstances(startRow, startCol);
      const terrainFingerprint = this.getTerrainFingerprintForChunk(startRow, startCol);
      if (
        this.shouldRejectTerrainCacheSnapshot(totalCachedTerrainInstances) ||
        this.shouldRejectExploredTerrainCacheSnapshot(
          cachedExploredTerrainInstances,
          expectedExploredTerrainInstances,
        ) ||
        shouldRejectCachedTerrainFingerprintMismatch({
          cachedTerrainFingerprint: cachedMetadata?.terrainFingerprint,
          currentTerrainFingerprint: terrainFingerprint,
        })
      ) {
        if (
          shouldRejectCachedTerrainFingerprintMismatch({
            cachedTerrainFingerprint: cachedMetadata?.terrainFingerprint,
            currentTerrainFingerprint: terrainFingerprint,
          })
        ) {
          recordChunkDiagnosticsEvent(this.chunkDiagnostics, "cache_reject_fingerprint");
          incrementWorldmapRenderCounter("staleTerrainCacheFingerprintRejectCount");
        }
        if (import.meta.env.DEV) {
          console.warn("[CACHE] Evicting suspicious cached terrain before apply", {
            chunkKey,
            totalCachedTerrainInstances,
            cachedExploredTerrainInstances,
            expectedExploredTerrainInstances,
            terrainFingerprint,
            cachedTerrainFingerprint: cachedMetadata?.terrainFingerprint,
            renderHexCapacity: this.getRenderHexCapacity(),
            minCoverageFraction: this.minCachedTerrainCoverageFraction,
            minExploredRetentionFraction: this.minCachedExploredRetentionFraction,
          });
        }
        this.removeCachedMatricesForChunk(startRow, startCol);
        return false;
      }

      this.touchMatrixCache(chunkKey);
      for (const [biome, entry] of cachedMatrices) {
        if (biome === "__bounds__" || biome === "__meta__") {
          continue;
        }
        const { matrices, count, landColors } = entry;
        const hexMesh = this.biomeModels.get(biome as BiomeType)!;
        if (matrices) {
          hexMesh.setMatricesAndCount(matrices, count);
          const matrixUploadBytes = count * Float32Array.BYTES_PER_ELEMENT * 16;
          incrementWorldmapRenderUploadBytes("cachedChunkReplay", matrixUploadBytes);
          recordRendererMatrixUploadBytes(count, "worldmap-cache-replay");
        } else {
          hexMesh.setCount(count);
        }
        hexMesh.updateMeshVisibility(); // Update visibility based on count

        if (landColors && count > 0) {
          const landMeshes = hexMesh.instancedMeshes.filter((mesh) => mesh.name === LAND_NAME);
          landMeshes.forEach((mesh) => {
            if (!mesh.instanceColor || (mesh.instanceColor.array as Float32Array).length < count * 3) {
              mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 3), 3);
              mesh.geometry.setAttribute("instanceColor", mesh.instanceColor);
            }
            (mesh.instanceColor.array as Float32Array).set(landColors);
            mesh.instanceColor.needsUpdate = true;
          });
          const colorUploadBytes = count * Float32Array.BYTES_PER_ELEMENT * 3;
          incrementWorldmapRenderUploadBytes("cachedChunkReplay", colorUploadBytes);
          recordRendererColorUploadBytes(count, "worldmap-cache-replay");
        }
      }
      this.setVisibleTerrainMembership(cachedMetadata?.visibleTerrainOwnership ?? []);
      this.ensureMatrixCacheLimit();
      return true;
    }
    return false;
  }

  private computeChunkBounds(startRow: number, startCol: number) {
    return resolveTerrainPresentationWorldBounds({
      startRow,
      startCol,
      renderSize: this.renderChunkSize,
      chunkSize: this.chunkSize,
    });
  }

  private combineChunkBounds(
    first: { box: Box3; sphere: Sphere },
    second: { box: Box3; sphere: Sphere },
  ): { box: Box3; sphere: Sphere } {
    const box = first.box.clone().union(second.box);
    const sphere = new Sphere();
    box.getBoundingSphere(sphere);
    return { box, sphere };
  }

  private applySceneChunkBounds(bounds: { box: Box3; sphere: Sphere } | undefined): void {
    this.currentChunkBounds = bounds;
    this.biomeModels.forEach((biome) => biome.setWorldBounds(bounds));
    this.structureManager.setChunkBounds(bounds);
  }

  private updateCurrentChunkBounds(startRow: number, startCol: number) {
    const bounds = this.computeChunkBounds(startRow, startCol);
    this.applySceneChunkBounds(bounds);

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
    if (this.currentChunk !== "null") {
      const [currentChunkStartRow, currentChunkStartCol] = this.currentChunk.split(",").map(Number);
      if (Number.isFinite(currentChunkStartRow) && Number.isFinite(currentChunkStartCol)) {
        const focusChunkSelection = resolveWorldmapChunkFromWorldPosition({
          worldX: cameraPosition.x,
          worldZ: cameraPosition.z,
          chunkSize: this.chunkSize,
        });

        if (focusChunkSelection.chunkKey !== this.currentChunk) {
          const hysteresisDecision = resolveWorldmapChunkHysteresis({
            focusCol: focusChunkSelection.focusCol,
            focusRow: focusChunkSelection.focusRow,
            currentChunkStartRow,
            currentChunkStartCol,
            chunkSize: this.chunkSize,
            renderSize: this.renderChunkSize,
          });

          if (hysteresisDecision.shouldStayInCurrentChunk) {
            return true;
          }
        }
      }
    }

    return shouldDelayWorldmapChunkSwitch({
      hasChunkSwitchAnchor: this.hasChunkSwitchAnchor,
      lastChunkSwitchPosition: this.lastChunkSwitchPosition,
      cameraPosition,
      chunkSize: this.chunkSize,
      hexSize: HEX_SIZE,
      chunkSwitchPadding: this.chunkSwitchPadding,
    });
  }

  private getChunkCenter(startRow: number, startCol: number): { row: number; col: number } {
    return getChunkCenterAligned(startRow, startCol, this.chunkSize);
  }

  private resolveChunkKeyForHexPosition(position: { col: number; row: number }): string {
    const worldPosition = getWorldPositionForHex(position);
    const { chunkX, chunkZ } = this.worldToChunkCoordinates(worldPosition.x, worldPosition.z);
    return `${chunkZ * this.chunkSize},${chunkX * this.chunkSize}`;
  }

  private async prewarmShortcutChunk(targetChunkKey: string): Promise<void> {
    if (!targetChunkKey || targetChunkKey === "null") {
      return;
    }

    try {
      await this.computeTileEntities(targetChunkKey);
      const [targetStartRow, targetStartCol] = targetChunkKey.split(",").map(Number);
      if (!Number.isFinite(targetStartRow) || !Number.isFinite(targetStartCol)) {
        return;
      }

      // Fire-and-forget surrounding prewarm to reduce edge pop-in on cross-chunk tabbing.
      this.getSurroundingChunkKeys(targetStartRow, targetStartCol).forEach((chunkKey) => {
        void this.computeTileEntities(chunkKey);
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[WorldMap] Shortcut chunk prewarm failed", { targetChunkKey, error });
      }
    }
  }

  private waitForShortcutCameraSettle(transitionDurationSeconds: number): Promise<void> {
    const settleDelayMs = Math.max(0, Math.round(transitionDurationSeconds * 1000) + 16);
    if (settleDelayMs === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => window.setTimeout(resolve, settleDelayMs));
  }

  private unregisterChunkOnNextFrame(chunkKey: string): void {
    if (!chunkKey || chunkKey === "null") {
      return;
    }

    const runUnregister = () => {
      if (this.currentChunk !== chunkKey) {
        this.visibilityManager?.unregisterChunk(chunkKey);
      }
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(runUnregister);
      return;
    }

    window.setTimeout(runUnregister, 0);
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

  public requestChunkRefresh(force: boolean = false, reason: WorldmapForceRefreshReason = "default"): number {
    if (this.isSwitchedOff) {
      return this.chunkRefreshRequestToken;
    }

    incrementWorldmapRenderCounter("chunkRefreshRequests");
    recordChunkDiagnosticsEvent(this.chunkDiagnostics, "refresh_requested");
    this.chunkRefreshRequestToken += 1;
    this.pendingChunkRefreshUiReason = resolvePendingChunkRefreshUiReason({
      currentReason: this.pendingChunkRefreshUiReason,
      isShortcutArmySelectionInFlight: this.isShortcutArmySelectionInFlight,
    });
    if (force) {
      this.pendingChunkRefreshForce = true;
      incrementWorldmapForceRefreshReason(reason);
      if (reason === "default") {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "refresh_reason_default");
      } else if (reason === "hydrated_chunk") {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "refresh_reason_hydrated_chunk");
      } else if (reason === "duplicate_tile") {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "refresh_reason_duplicate_tile");
      } else if (reason === "tile_overlap_repair") {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "refresh_reason_tile_overlap_repair");
      }
    }

    if (!WORLDMAP_ZOOM_HARDENING.latestWinsRefresh) {
      const debounceMs = resolveWorldmapChunkRefreshDebounceMs({ force, reason });
      this.scheduleLegacyChunkRefresh(debounceMs);
      return this.chunkRefreshRequestToken;
    }

    const debounceMs = resolveWorldmapChunkRefreshDebounceMs({ force, reason });
    this.scheduleChunkRefreshExecution(debounceMs);
    return this.chunkRefreshRequestToken;
  }

  private waitForRequestedChunkRefresh(requestToken: number): Promise<void> {
    if (this.isSwitchedOff) {
      return Promise.resolve();
    }

    if (!WORLDMAP_ZOOM_HARDENING.latestWinsRefresh) {
      return new Promise((resolve) => window.setTimeout(resolve, WORLDMAP_GENERIC_FORCED_REFRESH_DEBOUNCE_MS));
    }

    return new Promise((resolve) => {
      const poll = () => {
        if (
          this.chunkRefreshAppliedToken >= requestToken &&
          !this.chunkRefreshRunning &&
          this.chunkRefreshTimeout === null
        ) {
          resolve();
          return;
        }
        window.setTimeout(poll, 0);
      };

      poll();
    });
  }

  private scheduleLegacyChunkRefresh(requestedDelayMs: number): void {
    const scheduleDecision = resolveWorldmapChunkRefreshSchedule({
      existingDeadlineAtMs: this.chunkRefreshDeadlineAtMs,
      nowMs: performance.now(),
      requestedDelayMs,
    });
    if (!scheduleDecision.shouldScheduleTimer) {
      return;
    }

    if (this.chunkRefreshTimeout !== null) {
      window.clearTimeout(this.chunkRefreshTimeout);
    }

    this.chunkRefreshDeadlineAtMs = scheduleDecision.deadlineAtMs;

    this.chunkRefreshTimeout = window.setTimeout(() => {
      const shouldForce = this.pendingChunkRefreshForce;
      const refreshReason = this.pendingChunkRefreshUiReason;
      this.pendingChunkRefreshForce = false;
      this.pendingChunkRefreshUiReason = "default";
      this.chunkRefreshTimeout = null;
      this.chunkRefreshDeadlineAtMs = null;
      void this.updateVisibleChunks(shouldForce, { reason: refreshReason }).catch((error) => {
        console.error("[WorldMap] Legacy chunk refresh failed:", error);
      });
    }, scheduleDecision.delayMs);
  }

  private scheduleChunkRefreshExecution(requestedDelayMs: number): void {
    const scheduleDecision = resolveWorldmapChunkRefreshSchedule({
      existingDeadlineAtMs: this.chunkRefreshDeadlineAtMs,
      nowMs: performance.now(),
      requestedDelayMs,
    });
    if (!scheduleDecision.shouldScheduleTimer) {
      return;
    }

    if (this.chunkRefreshTimeout !== null) {
      window.clearTimeout(this.chunkRefreshTimeout);
    }

    const scheduledToken = this.chunkRefreshRequestToken;
    this.chunkRefreshDeadlineAtMs = scheduleDecision.deadlineAtMs;
    this.chunkRefreshTimeout = window.setTimeout(() => {
      this.chunkRefreshTimeout = null;
      this.chunkRefreshDeadlineAtMs = null;
      void this.flushChunkRefresh(scheduledToken);
    }, scheduleDecision.delayMs);
  }

  private async flushChunkRefresh(scheduledToken: number): Promise<void> {
    const latestToken = this.chunkRefreshRequestToken;
    const refreshExecutionPlan = resolveRefreshExecutionPlan(scheduledToken, latestToken);
    const { executionToken, shouldRecordSuperseded } = refreshExecutionPlan;

    if (shouldRecordSuperseded) {
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "refresh_superseded");
      this.emitZoomHardeningTelemetry("refresh_superseded", {
        scheduledToken,
        latestToken,
        executionToken,
      });
    }

    if (this.chunkRefreshRunning) {
      const runningActions = resolveRefreshRunningActions(scheduledToken, this.chunkRefreshRequestToken);
      this.chunkRefreshRerunRequested = runningActions.shouldMarkRerunRequested;
      if (runningActions.shouldRescheduleTimer) {
        this.emitZoomHardeningTelemetry("refresh_rescheduled", {
          scheduledToken,
          latestToken: this.chunkRefreshRequestToken,
        });
        this.scheduleChunkRefreshExecution(0);
      }
      return;
    }

    this.chunkRefreshRunning = true;
    const shouldForce = this.pendingChunkRefreshForce;
    const refreshReason = this.pendingChunkRefreshUiReason;
    this.pendingChunkRefreshForce = false;
    this.pendingChunkRefreshUiReason = "default";

    try {
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "refresh_executed");
      await this.updateVisibleChunks(shouldForce, { reason: refreshReason });
    } catch (error) {
      console.error("[WorldMap] Chunk refresh failed:", error);
    } finally {
      this.chunkRefreshRunning = false;
      this.chunkRefreshAppliedToken = executionToken;

      const completionActions = resolveRefreshCompletionActions({
        appliedToken: this.chunkRefreshAppliedToken,
        latestToken: this.chunkRefreshRequestToken,
        rerunRequested: this.chunkRefreshRerunRequested,
      });
      this.emitZoomHardeningTelemetry("refresh_applied", {
        executionToken: this.chunkRefreshAppliedToken,
        latestToken: this.chunkRefreshRequestToken,
        hasNewerRequest: completionActions.hasNewerRequest,
      });
      if (completionActions.shouldClearRerunRequested) {
        this.chunkRefreshRerunRequested = false;
      }
      if (completionActions.shouldScheduleRerun) {
        this.scheduleChunkRefreshExecution(0);
      }
    }
  }

  async updateVisibleChunks(force: boolean = false, options?: { reason?: "default" | "shortcut" }): Promise<boolean> {
    if (this.isSwitchedOff) {
      return false;
    }
    incrementWorldmapRenderCounter("updateVisibleChunksCalls");
    const updateStartedAt = performance.now();

    try {
      await waitForChunkTransitionToSettle(
        () => this.globalChunkSwitchPromise,
        (error) => console.warn(`Previous global chunk switch failed:`, error),
        { isSwitchedOff: () => this.isSwitchedOff },
      );

      const focusPoint = this.getCameraGroundIntersection().clone();
      const chunkDecision = resolveWarpTravelVisibleChunkDecision({
        isSwitchedOff: this.isSwitchedOff,
        focusPoint,
        chunkSize: this.chunkSize,
        hexSize: HEX_SIZE,
        currentChunk: this.currentChunk,
        force,
        reason: options?.reason ?? "default",
        shouldDelayChunkSwitch: this.shouldDelayChunkSwitch(focusPoint),
      });

      if (chunkDecision.action === "noop" && !chunkDecision.shouldPrefetch) {
        return false;
      }

      // Proactively prefetch the forward chunk while staying in the current one to hide pop-in.
      if (chunkDecision.shouldPrefetch) {
        this.prefetchDirectionalChunks(focusPoint);
      }

      if (chunkDecision.action === "switch_chunk") {
        const { chunkKey, startCol, startRow } = chunkDecision;
        if (chunkKey === null || startCol === null || startRow === null) {
          return false;
        }
        // Create and track the global chunk switch promise
        const transitionToken = ++this.chunkTransitionToken;
        const switchStartedAt = performance.now();
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "transition_started");
        this.isChunkTransitioning = true;
        this.globalChunkSwitchPromise = this.performChunkSwitch(
          chunkKey,
          startCol,
          startRow,
          force,
          transitionToken,
          options?.reason ?? "default",
          focusPoint.clone(),
        );

        try {
          await this.globalChunkSwitchPromise;
          this.retryDeferredChunkRemovals();
          return true;
        } finally {
          recordChunkDiagnosticsEvent(this.chunkDiagnostics, "switch_duration_recorded", {
            durationMs: performance.now() - switchStartedAt,
          });
          this.globalChunkSwitchPromise = null;
          this.isChunkTransitioning = false;
        }
      }

      if (chunkDecision.action === "refresh_current_chunk") {
        const { chunkKey, startCol, startRow } = chunkDecision;
        if (chunkKey === null || startCol === null || startRow === null) {
          return false;
        }
        const transitionToken = ++this.chunkTransitionToken;
        this.actionPathsTransitionToken = resolveEntityActionPathsTransitionTokenForForcedRefresh({
          selectedEntityId: this.state.entityActions.selectedEntityId,
          actionPathCount: this.state.entityActions.actionPaths.size,
          currentChunk: this.currentChunk,
          targetChunk: chunkKey,
          nextTransitionToken: transitionToken,
          previousTransitionToken: this.actionPathsTransitionToken,
        });
        this.isChunkTransitioning = true;
        this.globalChunkSwitchPromise = this.refreshCurrentChunk(chunkKey, startCol, startRow, transitionToken);
        try {
          await this.globalChunkSwitchPromise;
          this.retryDeferredChunkRemovals();
          return true;
        } finally {
          this.globalChunkSwitchPromise = null;
          this.isChunkTransitioning = false;
        }
      }

      return false;
    } finally {
      recordWorldmapRenderDuration("updateVisibleChunks", performance.now() - updateStartedAt);
    }
  }

  private async performChunkSwitch(
    chunkKey: string,
    startCol: number,
    startRow: number,
    force: boolean,
    transitionToken: number,
    reason: "default" | "shortcut",
    switchPosition?: Vector3,
  ) {
    const chunkSwitchStartedAt = performance.now();
    const presentationPhaseDurations = {
      terrainPreparedMs: 0,
      tileHydrationDrainMs: 0,
      structureHydrationDrainMs: 0,
      structureAssetPrewarmMs: 0,
    };
    // Track memory usage during chunk switch
    const memoryMonitor = (window as { __gameRenderer?: { memoryMonitor?: MemoryMonitor } }).__gameRenderer
      ?.memoryMonitor;
    const preChunkStats = memoryMonitor?.getCurrentStats(`chunk-switch-pre-${chunkKey}`);

    try {
      // Keep selection continuity during shortcut tabbing, including any
      // overlapping scheduled refresh that still routes through the default branch.
      if (
        shouldClearEntitySelectionForChunkSwitch({
          reason,
          isShortcutArmySelectionInFlight: this.isShortcutArmySelectionInFlight,
        })
      ) {
        this.clearEntitySelection();
      }

      const oldChunk = this.currentChunk;
      const reversalRefreshDecision = resolveChunkReversalRefreshDecision({
        previousSwitchPosition: this.lastChunkSwitchPosition
          ? {
              x: this.lastChunkSwitchPosition.x,
              z: this.lastChunkSwitchPosition.z,
            }
          : null,
        nextSwitchPosition: switchPosition
          ? {
              x: switchPosition.x,
              z: switchPosition.z,
            }
          : null,
        previousMovementVector: this.lastChunkSwitchMovement,
        minMovementDistance: 0.001,
      });
      const shouldAggressiveReversalRefresh = reversalRefreshDecision.shouldForceRefresh;
      const effectiveForce = force || shouldAggressiveReversalRefresh;
      const previousPinnedChunks = Array.from(this.pinnedChunkKeys);
      const oldChunkCoordinates = oldChunk !== "null" ? oldChunk.split(",").map(Number) : null;
      const hasFiniteOldChunkCoordinates =
        oldChunkCoordinates !== null &&
        Number.isFinite(oldChunkCoordinates[0]) &&
        Number.isFinite(oldChunkCoordinates[1]);
      prepareWarpTravelChunkBounds({
        targetChunkKey: chunkKey,
        startRow,
        startCol,
        hasFiniteOldChunkCoordinates,
        oldChunkCoordinates:
          hasFiniteOldChunkCoordinates && oldChunkCoordinates !== null
            ? [oldChunkCoordinates[0], oldChunkCoordinates[1]]
            : null,
        computeChunkBounds: (targetStartRow, targetStartCol) => this.computeChunkBounds(targetStartRow, targetStartCol),
        registerChunk: (targetChunkKey, bounds) => this.visibilityManager?.registerChunk(targetChunkKey, bounds),
        combineChunkBounds: (previousBounds, nextBounds) => this.combineChunkBounds(previousBounds, nextBounds),
        applySceneChunkBounds: (bounds) => this.applySceneChunkBounds(bounds),
      });

      // Load surrounding pinned chunks for better UX.
      const surroundingChunks = this.getSurroundingChunkKeys(startRow, startCol);
      if (shouldAggressiveReversalRefresh) {
        this.aggressivelyInvalidateChunkTerrainCaches(chunkKey, {
          includeSurroundingChunks: surroundingChunks,
          invalidateFetchAreas: true,
        });
      } else if (effectiveForce) {
        this.removeCachedMatricesForChunk(startRow, startCol);
      }

      const { tileFetchSucceeded, preparedTerrain } = await hydrateWarpTravelChunk({
        chunkKey,
        startRow,
        startCol,
        surroundingChunks,
        transitionToken,
        renderSize: this.renderChunkSize,
        computeTileEntities: (targetChunkKey) => this.computeTileEntities(targetChunkKey),
        updatePinnedChunks: (chunkKeys) => this.updatePinnedChunks(chunkKeys),
        updateBoundsSubscription: (targetChunkKey, nextTransitionToken) =>
          this.updateToriiBoundsSubscription(targetChunkKey, nextTransitionToken),
        waitForTileHydrationIdle: async (targetChunkKey) => {
          const startedAt = performance.now();
          await this.waitForTileHydrationIdle(targetChunkKey);
          presentationPhaseDurations.tileHydrationDrainMs = performance.now() - startedAt;
          recordWorldmapRenderDuration("tileHydrationDrainMs", presentationPhaseDurations.tileHydrationDrainMs);
          recordChunkDiagnosticsEvent(this.chunkDiagnostics, "tile_hydration_drain_completed");
        },
        waitForStructureHydrationIdle: async (targetChunkKey) => {
          const startedAt = performance.now();
          await this.waitForStructureHydrationIdle(targetChunkKey);
          presentationPhaseDurations.structureHydrationDrainMs = performance.now() - startedAt;
          recordWorldmapRenderDuration(
            "structureHydrationDrainMs",
            presentationPhaseDurations.structureHydrationDrainMs,
          );
        },
        prewarmChunkAssets: async (targetChunkKey) => {
          const startedAt = performance.now();
          await this.structureManager.prewarmChunkAssets(targetChunkKey);
          presentationPhaseDurations.structureAssetPrewarmMs = performance.now() - startedAt;
          recordWorldmapRenderDuration("structureAssetPrewarmMs", presentationPhaseDurations.structureAssetPrewarmMs);
        },
        prepareTerrainChunk: async (targetStartRow, targetStartCol, height, width) => {
          const startedAt = performance.now();
          const preparedChunk = await this.prepareTerrainChunk(targetStartRow, targetStartCol, height, width);
          presentationPhaseDurations.terrainPreparedMs = performance.now() - startedAt;
          recordWorldmapRenderDuration("terrainPreparedMs", presentationPhaseDurations.terrainPreparedMs);
          return preparedChunk;
        },
        onChunkHydrated: (hydratedChunkKey) => {
          this.hydratedChunkRefreshes.delete(hydratedChunkKey);
        },
      });

      if (tileFetchSucceeded && preparedTerrain) {
        const terrainReadyDurationMs = performance.now() - chunkSwitchStartedAt;
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "terrain_ready_duration_recorded", {
          durationMs: terrainReadyDurationMs,
        });
        recordWorldmapRenderDuration("chunkTerrainReadyMs", terrainReadyDurationMs);
      }

      let managerCatchUpPromise: Promise<void> | null = null;
      const finalizeResult = await finalizeWarpTravelChunkSwitch({
        fetchSucceeded: tileFetchSucceeded,
        isCurrentTransition: transitionToken === this.chunkTransitionToken,
        targetChunk: chunkKey,
        previousChunk: oldChunk,
        currentChunk: this.currentChunk,
        previousPinnedChunks,
        hasFiniteOldChunkCoordinates,
        oldChunkCoordinates:
          hasFiniteOldChunkCoordinates && oldChunkCoordinates !== null
            ? [oldChunkCoordinates[0], oldChunkCoordinates[1]]
            : null,
        startRow,
        startCol,
        force: effectiveForce,
        transitionToken,
        preparedTerrain,
        applyPreparedTerrain: (nextPreparedTerrain) => {
          const terrainCommitStartedAt = performance.now();
          this.applyPreparedTerrainChunk(nextPreparedTerrain as PreparedTerrainChunk);
          const commitCompletedAt = performance.now();
          const terrainCommitDurationMs = commitCompletedAt - terrainCommitStartedAt;
          const firstVisibleCommitDurationMs = commitCompletedAt - chunkSwitchStartedAt;
          recordChunkDiagnosticsEvent(this.chunkDiagnostics, "terrain_commit_duration_recorded", {
            durationMs: terrainCommitDurationMs,
          });
          recordChunkDiagnosticsEvent(this.chunkDiagnostics, "first_visible_commit_duration_recorded", {
            durationMs: firstVisibleCommitDurationMs,
          });
          recordChunkDiagnosticsEvent(this.chunkDiagnostics, "terrain_visible_commit");
          recordWorldmapRenderDuration("chunkTerrainCommitMs", terrainCommitDurationMs);
          recordWorldmapRenderDuration("presentationCommittedMs", firstVisibleCommitDurationMs);
          incrementWorldmapRenderCounter("terrainVisibleCommits");
          const readinessDurations = Object.values(presentationPhaseDurations).filter((value) => value > 0);
          if (readinessDurations.length > 0) {
            recordWorldmapRenderDuration(
              "presentationSkewMs",
              Math.max(...readinessDurations) - Math.min(...readinessDurations),
            );
          }
        },
        setCurrentChunk: (targetChunkKey) => this.commitCurrentChunkAuthority(targetChunkKey),
        updatePinnedChunks: (chunkKeys) => this.updatePinnedChunks(chunkKeys),
        unregisterChunk: (targetChunkKey) => this.unregisterVisibilityChunk(targetChunkKey),
        restorePreviousChunkVisuals: (oldStartRow, oldStartCol, previousChunk, previousTransitionToken) =>
          this.restorePreviousChunkVisualsAfterRollback(
            oldStartRow,
            oldStartCol,
            previousChunk,
            previousTransitionToken,
          ),
        clearSceneChunkBounds: () => this.clearSceneChunkBounds(),
        forceVisibilityUpdate: () => this.forceVisibilityManagerUpdate(),
        updateCurrentChunkBounds: (targetStartRow, targetStartCol) =>
          this.updateCurrentChunkBounds(targetStartRow, targetStartCol),
        scheduleManagerCatchUp: (targetChunkKey, managerOptions) => {
          if (WORLDMAP_STREAMING_ROLLOUT.stagedPathEnabled) {
            this.deferManagerCatchUpForChunk(targetChunkKey, managerOptions);
            return;
          }

          managerCatchUpPromise = this.updateManagersForChunk(targetChunkKey, managerOptions);
        },
        unregisterPreviousChunkOnNextFrame: (targetChunkKey) => this.queueChunkVisibilityUnregister(targetChunkKey),
      });

      if (finalizeResult.status === "rolled_back") {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "transition_rolled_back");
        return;
      }

      if (finalizeResult.status === "stale_dropped") {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "transition_prepare_stale_dropped");
        return;
      }

      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "transition_committed");

      if (managerCatchUpPromise) {
        await managerCatchUpPromise;
      }

      // Track memory usage after chunk switch
      if (memoryMonitor) {
        const postChunkStats = memoryMonitor.getCurrentStats(`chunk-switch-post-${chunkKey}`);
        if (preChunkStats && postChunkStats) {
          const memoryDelta = postChunkStats.heapUsedMB - preChunkStats.heapUsedMB;
          // Memory monitoring hooks - intentionally silent unless threshold exceeded
          void memoryDelta;
        }
      }

      if (switchPosition) {
        this.lastChunkSwitchPosition = switchPosition;
        this.lastChunkSwitchMovement = reversalRefreshDecision.nextMovementVector ?? this.lastChunkSwitchMovement;
        this.hasChunkSwitchAnchor = true;
      }
    } finally {
      recordWorldmapRenderDuration("performChunkSwitch", performance.now() - chunkSwitchStartedAt);
    }
  }

  private async refreshCurrentChunk(chunkKey: string, startCol: number, startRow: number, transitionToken: number) {
    const presentationPhaseDurations = {
      terrainPreparedMs: 0,
      tileHydrationDrainMs: 0,
      structureHydrationDrainMs: 0,
      structureAssetPrewarmMs: 0,
    };
    const memoryMonitor = (window as { __gameRenderer?: { memoryMonitor?: MemoryMonitor } }).__gameRenderer
      ?.memoryMonitor;
    const preChunkStats = memoryMonitor?.getCurrentStats(`chunk-refresh-pre-${chunkKey}`);
    const refreshAreaKey = this.getRenderAreaKeyForChunk(chunkKey);

    const surroundingChunks = this.getSurroundingChunkKeys(startRow, startCol);
    this.removeCachedMatricesForChunk(startRow, startCol);
    this.hydratedRefreshSuppressionAreaKeys.add(refreshAreaKey);

    try {
      const refreshStartedAt = performance.now();
      const { tileFetchSucceeded, preparedTerrain } = await hydrateWarpTravelChunk({
        chunkKey,
        startRow,
        startCol,
        surroundingChunks,
        transitionToken,
        renderSize: this.renderChunkSize,
        computeTileEntities: (targetChunkKey) => this.computeTileEntities(targetChunkKey),
        updatePinnedChunks: (chunkKeys) => this.updatePinnedChunks(chunkKeys),
        updateBoundsSubscription: (targetChunkKey, nextTransitionToken) =>
          this.updateToriiBoundsSubscription(targetChunkKey, nextTransitionToken),
        waitForTileHydrationIdle: async (targetChunkKey) => {
          const startedAt = performance.now();
          await this.waitForTileHydrationIdle(targetChunkKey);
          presentationPhaseDurations.tileHydrationDrainMs = performance.now() - startedAt;
          recordWorldmapRenderDuration("tileHydrationDrainMs", presentationPhaseDurations.tileHydrationDrainMs);
          recordChunkDiagnosticsEvent(this.chunkDiagnostics, "tile_hydration_drain_completed");
        },
        waitForStructureHydrationIdle: async (targetChunkKey) => {
          const startedAt = performance.now();
          await this.waitForStructureHydrationIdle(targetChunkKey);
          presentationPhaseDurations.structureHydrationDrainMs = performance.now() - startedAt;
          recordWorldmapRenderDuration(
            "structureHydrationDrainMs",
            presentationPhaseDurations.structureHydrationDrainMs,
          );
        },
        prewarmChunkAssets: async (targetChunkKey) => {
          const startedAt = performance.now();
          await this.structureManager.prewarmChunkAssets(targetChunkKey);
          presentationPhaseDurations.structureAssetPrewarmMs = performance.now() - startedAt;
          recordWorldmapRenderDuration("structureAssetPrewarmMs", presentationPhaseDurations.structureAssetPrewarmMs);
        },
        prepareTerrainChunk: async (targetStartRow, targetStartCol, height, width) => {
          const startedAt = performance.now();
          const preparedChunk = await this.prepareTerrainChunk(targetStartRow, targetStartCol, height, width);
          presentationPhaseDurations.terrainPreparedMs = performance.now() - startedAt;
          recordWorldmapRenderDuration("terrainPreparedMs", presentationPhaseDurations.terrainPreparedMs);
          return preparedChunk;
        },
        onChunkHydrated: (hydratedChunkKey) => {
          this.hydratedChunkRefreshes.delete(hydratedChunkKey);
        },
      });
      if (!tileFetchSucceeded) {
        return;
      }

      if (preparedTerrain) {
        const terrainReadyDurationMs = performance.now() - refreshStartedAt;
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "terrain_ready_duration_recorded", {
          durationMs: terrainReadyDurationMs,
        });
        recordWorldmapRenderDuration("chunkTerrainReadyMs", terrainReadyDurationMs);
      }

      // Verify the refresh is still valid before committing terrain
      const commitDecision = resolveSameChunkRefreshCommit({
        refreshToken: transitionToken,
        currentRefreshToken: this.chunkTransitionToken,
        currentChunk: this.currentChunk,
        targetChunk: chunkKey,
        preparedTerrain,
      });

      if (commitDecision.shouldDropAsStale) {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "stale_terrain_refresh_dropped");
        return;
      }

      if (commitDecision.shouldCommit && preparedTerrain) {
        const terrainCommitStartedAt = performance.now();
        this.applyPreparedTerrainChunk(preparedTerrain);
        this.updateCurrentChunkBounds(startRow, startCol);
        const commitCompletedAt = performance.now();
        const terrainCommitDurationMs = commitCompletedAt - terrainCommitStartedAt;
        const firstVisibleCommitDurationMs = commitCompletedAt - refreshStartedAt;
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "terrain_commit_duration_recorded", {
          durationMs: terrainCommitDurationMs,
        });
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "first_visible_commit_duration_recorded", {
          durationMs: firstVisibleCommitDurationMs,
        });
        recordWorldmapRenderDuration("chunkTerrainCommitMs", terrainCommitDurationMs);
        recordWorldmapRenderDuration("presentationCommittedMs", firstVisibleCommitDurationMs);
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "terrain_visible_commit");
        incrementWorldmapRenderCounter("terrainVisibleCommits");
        const readinessDurations = Object.values(presentationPhaseDurations).filter((value) => value > 0);
        if (readinessDurations.length > 0) {
          recordWorldmapRenderDuration(
            "presentationSkewMs",
            Math.max(...readinessDurations) - Math.min(...readinessDurations),
          );
        }
        if (WORLDMAP_STREAMING_ROLLOUT.stagedPathEnabled) {
          this.deferManagerCatchUpForChunk(chunkKey, { force: true, transitionToken });
        } else {
          await this.updateManagersForChunk(chunkKey, { force: true, transitionToken });
        }
      }
    } finally {
      this.hydratedRefreshSuppressionAreaKeys.delete(refreshAreaKey);
    }

    if (memoryMonitor) {
      const postChunkStats = memoryMonitor.getCurrentStats(`chunk-refresh-post-${chunkKey}`);
      if (preChunkStats && postChunkStats) {
        const memoryDelta = postChunkStats.heapUsedMB - preChunkStats.heapUsedMB;
        // Memory monitoring hooks - intentionally silent unless threshold exceeded
        void memoryDelta;
      }
    }
  }

  private async updateManagersForChunk(chunkKey: string, options?: { force?: boolean; transitionToken?: number }) {
    if (
      !shouldRunManagerUpdate({
        transitionToken: options?.transitionToken,
        expectedTransitionToken: this.chunkTransitionToken,
        currentChunk: this.currentChunk,
        targetChunk: chunkKey,
      })
    ) {
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "manager_update_skipped_stale");
      return;
    }
    const managerStartedAt = performance.now();
    recordChunkDiagnosticsEvent(this.chunkDiagnostics, "manager_update_started");

    try {
      await runWarpTravelManagerFanout({
        chunkKey,
        options,
        managers: [
          {
            label: "army",
            updateChunk: (targetChunkKey, targetOptions) => this.armyManager.updateChunk(targetChunkKey, targetOptions),
          },
          {
            label: "structure",
            updateChunk: (targetChunkKey, targetOptions) =>
              this.structureManager.updateChunk(targetChunkKey, targetOptions),
          },
          {
            label: "chest",
            updateChunk: (targetChunkKey, targetOptions) =>
              this.chestManager.updateChunk(targetChunkKey, targetOptions),
          },
        ],
        onManagerFailed: (label, reason) => {
          recordChunkDiagnosticsEvent(this.chunkDiagnostics, "manager_update_failed");
          console.error(`[CHUNK SYNC] ${label} manager failed for chunk ${chunkKey}`, reason);
        },
      });
    } finally {
      const durationMs = performance.now() - managerStartedAt;
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "manager_duration_recorded", {
        durationMs,
      });
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "manager_catch_up_duration_recorded", {
        durationMs,
      });
      recordWorldmapRenderDuration("chunkManagerCatchUpMs", durationMs);
      recordWorldmapRenderDuration("updateManagersForChunk", durationMs);
      setWorldmapRenderGauge("visibleArmies", this.armyManager.getVisibleCount());
      setWorldmapRenderGauge("visibleStructures", this.structureManager.getVisibleCount());
      setWorldmapRenderGauge("activePaths", this.armyManager.getActivePathCount());
      setWorldmapRenderGauge("activeLabels", this.hoverLabelManager.getActiveLabelCount());
    }

    if (import.meta.env.DEV) {
      const debugFetchKey = this.getRenderAreaKeyForChunk(chunkKey);
      console.info("[CHUNK DEBUG]", {
        currentChunk: this.currentChunk,
        fetchKey: debugFetchKey,
        visible: {
          armies: this.armyManager.getVisibleCount(),
          structures: this.structureManager.getVisibleCount(),
          chests: this.chestManager.getVisibleCount(),
        },
        pendingFetches: this.pendingChunks.size,
      });
    }
  }

  update(deltaTime: number) {
    const animationContext = this.getAnimationVisibilityContext();
    this.updateWorldmapZoom(deltaTime);
    super.update(deltaTime);
    this.armyManager.update(deltaTime, animationContext);
    this.fxManager.update(deltaTime);
    this.resourceFXManager.update(deltaTime);
    this.selectionPulseManager.update(deltaTime);
    this.selectedHexManager.update(deltaTime);
    this.structureManager.updateAnimations(deltaTime, animationContext);
    this.chestManager.update(deltaTime);
    this.updateCameraTargetHexThrottled?.();
    setWorldmapRenderGauge("activeLabels", this.hoverLabelManager.getActiveLabelCount());
    if (WORLDMAP_ZOOM_HARDENING.terrainSelfHeal) {
      this.monitorTerrainVisibilityHealth();
    } else {
      this.zeroTerrainFrames = 0;
      this.lowTerrainFrames = 0;
      this.offscreenChunkFrames = 0;
    }
  }

  private updateWorldmapZoom(deltaTime: number): void {
    const zoomFrame = this.zoomCoordinator.tick({
      cameraPosition: this.controls.object.position,
      target: this.controls.target,
      deltaMs: deltaTime * 1000,
      nowMs: performance.now(),
    });

    if (!zoomFrame.didMove) {
      this.publishWorldmapZoomSnapshot(zoomFrame.snapshot);
      return;
    }

    this.controls.object.position.copy(zoomFrame.cameraPosition);
    this.controls.target.copy(zoomFrame.target);
    this.notifyControlsChanged();
    this.frustumManager?.forceUpdate();
    this.publishWorldmapZoomSnapshot(zoomFrame.snapshot);
  }

  private emitZoomHardeningTelemetry(event: string, payload: Record<string, unknown>): void {
    if (!WORLDMAP_ZOOM_HARDENING.telemetry) {
      return;
    }

    console.info("[WorldMap Hardening]", {
      event,
      ...payload,
    });
  }

  private snapshotChunkDiagnostics(): WorldmapChunkDiagnostics {
    return snapshotChunkDiagnosticsState(this.chunkDiagnostics);
  }

  private captureChunkDiagnosticsBaseline(label: string = "manual"): WorldmapChunkDiagnosticsBaselineEntry {
    const result = captureChunkDiagnosticsBaseline({
      baselines: this.chunkDiagnosticsBaselines,
      diagnostics: this.chunkDiagnostics,
      label,
      maxEntries: 20,
    });
    this.chunkDiagnosticsBaselines = result.baselines;
    return result.captured;
  }

  private resetChunkDiagnostics(): void {
    this.chunkDiagnostics = createWorldmapChunkDiagnostics();
    this.chunkDiagnosticsBaselines = [];
    resetWorldmapRenderDiagnostics();
  }

  private getChunkDiagnosticsSnapshot(): ReturnType<
    NonNullable<WorldmapChunkDiagnosticsDebugWindow["getWorldmapChunkDiagnostics"]>
  > {
    return {
      diagnostics: this.snapshotChunkDiagnostics(),
      baselines: cloneChunkDiagnosticsBaselines(this.chunkDiagnosticsBaselines),
      currentChunk: this.currentChunk,
      chunkTransitionToken: this.chunkTransitionToken,
      chunkRefreshRequestToken: this.chunkRefreshRequestToken,
      chunkRefreshAppliedToken: this.chunkRefreshAppliedToken,
    };
  }

  private findChunkDiagnosticsBaseline(baselineLabel?: string): WorldmapChunkDiagnosticsBaselineEntry | undefined {
    if (baselineLabel) {
      for (let i = this.chunkDiagnosticsBaselines.length - 1; i >= 0; i--) {
        const candidate = this.chunkDiagnosticsBaselines[i];
        if (candidate?.label === baselineLabel) {
          return candidate;
        }
      }
      return undefined;
    }

    return this.chunkDiagnosticsBaselines[this.chunkDiagnosticsBaselines.length - 1];
  }

  private evaluateChunkP95RegressionAgainstBaseline(
    metric: ChunkSwitchP95RegressionMetric,
    baselineLabel?: string,
    allowedRegressionFraction: number = 0.1,
  ): WorldmapChunkSwitchP95RegressionDebugResult {
    const selectedBaseline = this.findChunkDiagnosticsBaseline(baselineLabel);

    if (!selectedBaseline) {
      return {
        baselineLabel: null,
        result: {
          status: "pending",
          reason: "No baseline found. Capture one first with captureWorldmapChunkBaseline(label).",
          metric,
          baselineP95Ms: null,
          currentP95Ms: null,
          allowedRegressionFraction: Math.max(0, allowedRegressionFraction),
          regressionFraction: null,
        },
      };
    }

    return {
      baselineLabel: selectedBaseline.label,
      result: evaluateChunkSwitchP95Regression({
        baseline: selectedBaseline.diagnostics,
        current: this.chunkDiagnostics,
        metric,
        allowedRegressionFraction,
      }),
    };
  }

  private evaluateChunkSwitchP95RegressionAgainstBaseline(
    baselineLabel?: string,
    allowedRegressionFraction: number = 0.1,
  ): WorldmapChunkSwitchP95RegressionDebugResult {
    return this.evaluateChunkP95RegressionAgainstBaseline("switch_duration", baselineLabel, allowedRegressionFraction);
  }

  private evaluateChunkFirstVisibleCommitP95RegressionAgainstBaseline(
    baselineLabel?: string,
    allowedRegressionFraction: number = 0.1,
  ): WorldmapChunkFirstVisibleCommitP95RegressionDebugResult {
    return this.evaluateChunkP95RegressionAgainstBaseline(
      "first_visible_commit",
      baselineLabel,
      allowedRegressionFraction,
    );
  }

  private evaluateTileFetchVolumeRegressionAgainstBaseline(
    baselineLabel?: string,
    allowedIncreaseFraction: number = 0,
  ): WorldmapTileFetchVolumeRegressionDebugResult {
    let selectedBaseline: WorldmapChunkDiagnosticsBaselineEntry | undefined;
    if (baselineLabel) {
      for (let i = this.chunkDiagnosticsBaselines.length - 1; i >= 0; i--) {
        const candidate = this.chunkDiagnosticsBaselines[i];
        if (candidate?.label === baselineLabel) {
          selectedBaseline = candidate;
          break;
        }
      }
    } else {
      selectedBaseline = this.chunkDiagnosticsBaselines[this.chunkDiagnosticsBaselines.length - 1];
    }

    if (!selectedBaseline) {
      return {
        baselineLabel: null,
        result: {
          status: "fail",
          reason: "No baseline found. Capture one first with captureWorldmapChunkBaseline(label).",
          baselineFetchCount: 0,
          currentFetchCount: Math.max(0, Math.floor(this.chunkDiagnostics.tileFetchStarted)),
          allowedIncreaseFraction: Math.max(0, allowedIncreaseFraction),
          increaseFraction: Number.POSITIVE_INFINITY,
        },
      };
    }

    return {
      baselineLabel: selectedBaseline.label,
      result: evaluateTileFetchVolumeRegression({
        baseline: selectedBaseline.diagnostics,
        current: this.chunkDiagnostics,
        allowedIncreaseFraction,
      }),
    };
  }

  private installChunkDiagnosticsDebugHooks(): void {
    if (!import.meta.env.DEV) {
      return;
    }

    const debugWindow = window as WorldmapChunkDiagnosticsDebugWindow;
    debugWindow.getWorldmapChunkDiagnostics = () => this.getChunkDiagnosticsSnapshot();
    debugWindow.resetWorldmapChunkDiagnostics = () => this.resetChunkDiagnostics();
    debugWindow.getWorldmapRenderDiagnostics = () => snapshotWorldmapRenderDiagnostics();
    debugWindow.resetWorldmapRenderDiagnostics = () => resetWorldmapRenderDiagnostics();
    debugWindow.captureWorldmapChunkBaseline = (label?: string) => this.captureChunkDiagnosticsBaseline(label);
    debugWindow.evaluateWorldmapChunkSwitchP95Regression = (
      baselineLabel?: string,
      allowedRegressionFraction?: number,
    ) => this.evaluateChunkSwitchP95RegressionAgainstBaseline(baselineLabel, allowedRegressionFraction);
    debugWindow.evaluateWorldmapChunkFirstVisibleCommitP95Regression = (
      baselineLabel?: string,
      allowedRegressionFraction?: number,
    ) => this.evaluateChunkFirstVisibleCommitP95RegressionAgainstBaseline(baselineLabel, allowedRegressionFraction);
    debugWindow.evaluateWorldmapTileFetchVolumeRegression = (
      baselineLabel?: string,
      allowedIncreaseFraction?: number,
    ) => this.evaluateTileFetchVolumeRegressionAgainstBaseline(baselineLabel, allowedIncreaseFraction);
  }

  private removeChunkDiagnosticsDebugHooks(): void {
    if (!import.meta.env.DEV) {
      return;
    }

    const debugWindow = window as WorldmapChunkDiagnosticsDebugWindow;
    debugWindow.getWorldmapChunkDiagnostics = undefined;
    debugWindow.resetWorldmapChunkDiagnostics = undefined;
    debugWindow.getWorldmapRenderDiagnostics = undefined;
    debugWindow.resetWorldmapRenderDiagnostics = undefined;
    debugWindow.captureWorldmapChunkBaseline = undefined;
    debugWindow.evaluateWorldmapChunkSwitchP95Regression = undefined;
    debugWindow.evaluateWorldmapChunkFirstVisibleCommitP95Regression = undefined;
    debugWindow.evaluateWorldmapTileFetchVolumeRegression = undefined;
  }

  private monitorTerrainVisibilityHealth(): void {
    if (
      this.sceneManager.getCurrentScene() !== SceneName.WorldMap ||
      this.isSwitchedOff ||
      this.currentChunk === "null" ||
      !this.currentChunkBounds
    ) {
      this.zeroTerrainFrames = 0;
      this.lowTerrainFrames = 0;
      this.offscreenChunkFrames = 0;
      return;
    }

    const isCurrentChunkVisible = this.visibilityManager.isBoxVisible(this.currentChunkBounds.box);
    const chunkVisibilityAnomaly = evaluateChunkVisibilityAnomaly({
      isCurrentChunkVisible,
      offscreenChunkFrames: this.offscreenChunkFrames,
      offscreenChunkFrameThreshold: this.offscreenChunkFrameThreshold,
    });
    this.offscreenChunkFrames = chunkVisibilityAnomaly.offscreenChunkFrames;

    if (!isCurrentChunkVisible) {
      this.zeroTerrainFrames = 0;
      this.lowTerrainFrames = 0;

      if (!chunkVisibilityAnomaly.shouldTriggerRecovery) {
        return;
      }

      const now = performance.now();
      if (this.terrainRecoveryInFlight || now - this.lastTerrainRecoveryAtMs < this.terrainRecoveryCooldownMs) {
        return;
      }

      this.lastTerrainRecoveryAtMs = now;
      this.terrainRecoveryInFlight = true;

      console.warn("[WorldMap] Current chunk bounds remained offscreen; forcing chunk refresh", {
        chunk: this.currentChunk,
        offscreenChunkFrames: this.offscreenChunkFrames,
      });
      this.emitZoomHardeningTelemetry("self_heal_start", {
        chunk: this.currentChunk,
        reason: "offscreen",
        offscreenChunkFrames: this.offscreenChunkFrames,
      });

      const refreshToken = this.requestChunkRefresh(true, "offscreen_chunk");
      void this.waitForRequestedChunkRefresh(refreshToken)
        .catch((error) => {
          console.error("[WorldMap] Offscreen chunk recovery failed:", error);
          this.emitZoomHardeningTelemetry("self_heal_failed", {
            chunk: this.currentChunk,
            reason: "offscreen",
            error: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => {
          this.emitZoomHardeningTelemetry("self_heal_complete", {
            chunk: this.currentChunk,
            reason: "offscreen",
          });
          this.terrainRecoveryInFlight = false;
          this.offscreenChunkFrames = 0;
        });
      return;
    }

    let totalTerrainInstances = 0;
    this.biomeModels.forEach((biome) => {
      totalTerrainInstances += biome.getCount();
    });

    if (this.terrainReferenceChunkKey !== this.currentChunk) {
      this.terrainReferenceChunkKey = this.currentChunk;
      this.terrainReferenceInstances = totalTerrainInstances;
      this.zeroTerrainFrames = 0;
      this.lowTerrainFrames = 0;
      return;
    }

    const anomalyResult = evaluateTerrainVisibilityAnomaly({
      terrainInstances: totalTerrainInstances,
      terrainReferenceInstances: this.terrainReferenceInstances,
      zeroTerrainFrames: this.zeroTerrainFrames,
      lowTerrainFrames: this.lowTerrainFrames,
      zeroTerrainFrameThreshold: this.zeroTerrainFrameThreshold,
      lowTerrainFrameThreshold: this.lowTerrainFrameThreshold,
      minRetainedTerrainFraction: this.minRetainedTerrainFraction,
      minReferenceTerrainInstances: this.minReferenceTerrainInstances,
    });

    this.zeroTerrainFrames = anomalyResult.zeroTerrainFrames;
    this.lowTerrainFrames = anomalyResult.lowTerrainFrames;
    if (!anomalyResult.shouldTriggerRecovery) {
      if (totalTerrainInstances > 0 && this.lowTerrainFrames === 0) {
        this.terrainReferenceInstances = totalTerrainInstances;
      }
      return;
    }

    const now = performance.now();
    if (this.terrainRecoveryInFlight || now - this.lastTerrainRecoveryAtMs < this.terrainRecoveryCooldownMs) {
      return;
    }

    this.lastTerrainRecoveryAtMs = now;
    this.terrainRecoveryInFlight = true;

    console.warn("[WorldMap] Terrain visibility anomaly detected; forcing chunk refresh", {
      chunk: this.currentChunk,
      reason: anomalyResult.recoveryReason,
      terrainInstances: totalTerrainInstances,
      terrainReferenceInstances: this.terrainReferenceInstances,
      zeroTerrainFrames: this.zeroTerrainFrames,
      lowTerrainFrames: this.lowTerrainFrames,
    });
    this.emitZoomHardeningTelemetry("self_heal_start", {
      chunk: this.currentChunk,
      reason: anomalyResult.recoveryReason,
      terrainInstances: totalTerrainInstances,
      terrainReferenceInstances: this.terrainReferenceInstances,
      zeroTerrainFrames: this.zeroTerrainFrames,
      lowTerrainFrames: this.lowTerrainFrames,
    });

    const refreshToken = this.requestChunkRefresh(true, "terrain_self_heal");
    void this.waitForRequestedChunkRefresh(refreshToken)
      .catch((error) => {
        console.error("[WorldMap] Terrain visibility recovery failed:", error);
        this.emitZoomHardeningTelemetry("self_heal_failed", {
          chunk: this.currentChunk,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        this.emitZoomHardeningTelemetry("self_heal_complete", {
          chunk: this.currentChunk,
        });
        this.terrainRecoveryInFlight = false;
        this.zeroTerrainFrames = 0;
        this.lowTerrainFrames = 0;
        this.offscreenChunkFrames = 0;
        if (totalTerrainInstances > this.terrainReferenceInstances) {
          this.terrainReferenceInstances = totalTerrainInstances;
        }
      });
  }

  public hasActiveLabelAnimations(): boolean {
    return (
      this.armyManager.hasMovingArmies() ||
      this.resourceFXManager.hasActiveFx() ||
      this.fxManager.hasActiveLabelFx() ||
      this.hoverLabelManager.hasActiveLabels()
    );
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
    this.clearQueuedPrefetchState();
    this.fetchedChunks.clear();
    this.pendingChunks.clear();
    this.pinnedRenderAreas.clear();
    this.clearCache();
    this.armyLastUpdateAt.clear();
    // Also clear the interactive hexes when clearing the entire cache
    this.interactiveHexManager.clearHexes();
  }

  destroy() {
    this.onSwitchOff();
    this.syncUrlChangedListenerLifecycle("destroy");
    this.resetZoomHardeningRuntimeState();
    this.removeChunkDiagnosticsDebugHooks();
    uninstallWorldmapDebugHooks(window);
    if (this.hexGridFrameHandle !== null) {
      cancelAnimationFrame(this.hexGridFrameHandle);
      this.hexGridFrameHandle = null;
    }
    this.currentHexGridTask = null;

    this.disposeStoreSubscriptions();
    this.disposeWorldUpdateSubscriptions();
    this.pendingArmyMovements.forEach((entityId) => this.clearPendingArmyMovement(entityId));
    this.pendingArmyMovements.clear();
    this.stopToriiBoundsCounterLog();
    if (this.toriiStreamManager === activeSpatialStreamManager) {
      activeSpatialStreamManager = null;
    }
    this.toriiStreamManager?.shutdown();
    this.toriiBoundsAreaKey = null;

    destroyWorldmapOwnedManagers({
      armyManager: this.armyManager,
      structureManager: this.structureManager,
      chestManager: this.chestManager,
      fxManager: this.fxManager,
      resourceFXManager: this.resourceFXManager,
    });
    this.updateCameraTargetHexThrottled?.cancel();
    this.minimapCameraMoveThrottled?.cancel();
    this.controls.removeEventListener("change", this.handleWorldmapControlsChange);
    window.removeEventListener("minimapCameraMove", this.minimapCameraMoveHandler as EventListener);
    window.removeEventListener("minimapZoom", this.minimapZoomHandler as EventListener);
    this.clearCache();

    // Clean up selection pulse manager
    this.selectionPulseManager.dispose();

    // Dispose hover label and selected hex managers to release Three.js resources
    this.hoverLabelManager.dispose();
    this.selectedHexManager.dispose();

    if (this.visibilityChangeHandler) {
      document.removeEventListener("visibilitychange", this.visibilityChangeHandler);
      this.visibilityChangeHandler = undefined;
    }
    this.cosmeticsSubscriptionCleanup?.();
    this.cosmeticsSubscriptionCleanup = undefined;

    super.destroy();
  }

  private syncUrlChangedListenerLifecycle(phase: "setup" | "switchOff" | "destroy"): void {
    const listenerDecision = resolveUrlChangedListenerLifecycle({
      phase,
      isUrlChangedListenerAttached: this.isUrlChangedListenerAttached,
    });

    if (listenerDecision.shouldAttach) {
      window.addEventListener("urlChanged", this.urlChangedHandler);
    }

    if (listenerDecision.shouldDetach) {
      window.removeEventListener("urlChanged", this.urlChangedHandler);
    }

    this.isUrlChangedListenerAttached = listenerDecision.nextIsUrlChangedListenerAttached;
  }

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

  private async selectNextArmy(): Promise<void> {
    if (this.selectableArmies.length === 0) return;
    const account = ContractAddress(useAccountStore.getState().account?.address || "");
    this.isShortcutArmySelectionInFlight = true;
    if (this.chunkRefreshTimeout !== null || this.chunkRefreshRunning) {
      this.pendingChunkRefreshUiReason = resolvePendingChunkRefreshUiReason({
        currentReason: this.pendingChunkRefreshUiReason,
        isShortcutArmySelectionInFlight: true,
      });
    }

    try {
      // Find the next army that can actually be selected.
      let attempts = 0;
      while (attempts < this.selectableArmies.length) {
        this.armyIndex = (this.armyIndex + 1) % this.selectableArmies.length;
        const army = this.selectableArmies[this.armyIndex];
        const hasPendingMovement = this.pendingArmyMovements.has(army.entityId);

        // Skip armies with pending movement transactions
        if (hasPendingMovement) {
          attempts++;
          continue;
        }

        const selectableArmyNormalizedPosition = new Position({
          x: army.position.col,
          y: army.position.row,
        }).getNormalized();
        const resolvedPosition = resolveArmyTabSelectionPosition({
          renderedArmyPosition: this.armiesPositions.get(army.entityId),
          selectableArmyNormalizedPosition: {
            col: selectableArmyNormalizedPosition.x,
            row: selectableArmyNormalizedPosition.y,
          },
        });
        this.moveCameraToColRow(resolvedPosition.col, resolvedPosition.row, SHORTCUT_NAVIGATION_DURATION_SECONDS);

        try {
          await this.refreshChunksAfterShortcutNavigation(resolvedPosition, SHORTCUT_NAVIGATION_DURATION_SECONDS);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error(
              `[WorldMap] Failed to update visible chunks while cycling armies (entityId=${army.entityId}):`,
              error,
            );
          }
        }

        this.handleHexSelection(resolvedPosition, true);
        let selectionSucceeded = this.onArmySelection(army.entityId, account, {
          deferDuringChunkTransition: false,
        });

        if (!selectionSucceeded) {
          try {
            await this.updateVisibleChunks(true, { reason: "shortcut" });
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn(
                `[WorldMap] Forced chunk refresh failed while selecting army (entityId=${army.entityId}):`,
                error,
              );
            }
          }

          selectionSucceeded = this.onArmySelection(army.entityId, account, {
            deferDuringChunkTransition: false,
          });
        }

        if (selectionSucceeded) {
          this.state.setLeftNavigationView(LeftView.EntityView);
        } else {
          // Army not yet rendered in this chunk — queue recovery so it gets
          // selected once the chunk finishes loading instead of skipping it.
          this.queueArmySelectionRecovery(army.entityId, account);
          this.state.setLeftNavigationView(LeftView.EntityView);
        }
        // Always stop on this army — don't skip to the next one,
        // which would cause the camera to flicker between positions.
        break;
      }
      // If all armies have pending movements, do nothing
    } finally {
      const shouldHoldProtection = shouldHoldShortcutArmySelectionProtection({
        hasPendingChunkRefreshTimer: this.chunkRefreshTimeout !== null,
        isChunkRefreshRunning: this.chunkRefreshRunning,
        hasGlobalChunkSwitchPromise: this.globalChunkSwitchPromise !== null,
      });

      if (shouldHoldProtection) {
        const pendingRefreshToken = this.chunkRefreshRequestToken;

        if (this.globalChunkSwitchPromise) {
          try {
            await this.globalChunkSwitchPromise;
          } catch (error) {
            console.warn("[WorldMap] Shortcut selection wait failed for chunk switch settlement", error);
          }
        }

        if (pendingRefreshToken > 0 && (this.chunkRefreshTimeout !== null || this.chunkRefreshRunning)) {
          try {
            await this.waitForRequestedChunkRefresh(pendingRefreshToken);
          } catch (error) {
            console.warn("[WorldMap] Shortcut selection wait failed for refresh settlement", error);
          }
        }
      }

      this.isShortcutArmySelectionInFlight = false;
      if (this.chunkRefreshTimeout === null && !this.chunkRefreshRunning && this.globalChunkSwitchPromise === null) {
        this.pendingChunkRefreshUiReason = "default";
      }
    }
  }

  private async refreshChunksAfterShortcutNavigation(
    targetPosition: { col: number; row: number },
    transitionDurationSeconds: number,
  ): Promise<void> {
    const targetChunkKey = this.resolveChunkKeyForHexPosition(targetPosition);
    const chunkChanged = this.currentChunk === "null" || this.currentChunk !== targetChunkKey;
    const forceChunkRefresh = shouldForceShortcutNavigationRefresh({
      isShortcutNavigation: true,
      transitionDurationSeconds,
      chunkChanged,
    });

    if (!chunkChanged) {
      return;
    }

    void this.prewarmShortcutChunk(targetChunkKey);
    await this.waitForShortcutCameraSettle(transitionDurationSeconds);

    const switched = await this.updateVisibleChunks(forceChunkRefresh, { reason: "shortcut" });
    if (
      shouldRunShortcutForceFallback({
        isShortcutNavigation: true,
        chunkChanged,
        initialSwitchSucceeded: switched,
      })
    ) {
      await this.updateVisibleChunks(true, { reason: "shortcut" });
    }
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
        (nextEntityActions, previousEntityActions) => {
          this.state.entityActions = nextEntityActions;
          this.syncEntityActionPathsTransitionToken();
          if (this.isMissingActionPathOwnershipState()) {
            this.clearEntitySelection();
            return;
          }
          if (
            shouldClearEntitySelectionForEntityActionTransition(
              previousEntityActions?.selectedEntityId,
              nextEntityActions.selectedEntityId,
            )
          ) {
            this.clearEntitySelection();
          }
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

    // NOTE: isSoundOn and effectsLevel subscriptions removed - AudioManager is now
    // the single source of truth for audio settings. See AudioManager.state.muted
    // and AudioManager.state.categoryVolumes.

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.enableMapZoom,
        () => {
          if (this.controls) {
            this.controls.enableZoom = false;
          }
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
    this.syncEntityActionPathsTransitionToken();
    if (this.isMissingActionPathOwnershipState()) {
      this.clearEntitySelection();
      return;
    }
    this.state.selectedHex = uiState.selectedHex;
    // NOTE: isSoundOn and effectsLevel removed - AudioManager is now the source of truth

    if (this.controls) {
      this.controls.enableZoom = false;
    }

    const selectedEntityId = uiState.entityActions.selectedEntityId;
    if (selectedEntityId === null || selectedEntityId === undefined) {
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

    navigateToStructure(structure.position.x, structure.position.y, "map");
    this.handleHexSelection({ col: structure.position.x, row: structure.position.y }, true);
    this.onStructureSelection(structure.entityId, { col: structure.position.x, row: structure.position.y });

    const worldMapPosition = { col: Number(structure.position.x), row: Number(structure.position.y) };
    this.state.setStructureEntityId(structure.entityId, {
      worldMapPosition,
      spectator: this.state.isSpectating,
    });

    const normalizedPosition = new Position({ x: structure.position.x, y: structure.position.y }).getNormalized();
    this.moveCameraToColRow(normalizedPosition.x, normalizedPosition.y, SHORTCUT_NAVIGATION_DURATION_SECONDS);
    void this.refreshChunksAfterShortcutNavigation(
      { col: normalizedPosition.x, row: normalizedPosition.y },
      SHORTCUT_NAVIGATION_DURATION_SECONDS,
    ).catch((error) => {
      if (import.meta.env.DEV) {
        console.error(
          `[WorldMap] Failed to update visible chunks while cycling realm structures (entityId=${structure.entityId}):`,
          error,
        );
      }
    });
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
      this.moveCameraToColRow(normalizedPosition.x, normalizedPosition.y, SHORTCUT_NAVIGATION_DURATION_SECONDS);
      void this.refreshChunksAfterShortcutNavigation(
        { col: normalizedPosition.x, row: normalizedPosition.y },
        SHORTCUT_NAVIGATION_DURATION_SECONDS,
      ).catch((error) => {
        if (import.meta.env.DEV) {
          console.error(
            `[WorldMap] Failed to update visible chunks while cycling structures (entityId=${structure.entityId}):`,
            error,
          );
        }
      });
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
