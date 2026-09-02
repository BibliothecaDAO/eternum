import { playUnitCommandSound, playUnitCommandSoundForWorldmapAction } from "@/audio/unit-command-audio";
import { runWithFrameWorkOwner } from "@/three/frame-work-owner";
import { DEV_MODE_ENABLED, VERBOSE_LOGS_ENABLED, verboseLog } from "@/utils/dev-mode";
import { formatReadableErrorForConsole } from "@/utils/error-message";
import { toast } from "sonner";

import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { resolveMovementStamina, type MovementStaminaResolution } from "@/lib/army-stamina/movement-affordability";
import { resolveStoredWorldmapCameraDistance, useCameraZoomStore } from "@/hooks/store/use-camera-zoom-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getCurrentPlayRouteBootToken, usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { parsePlayRoute } from "@/play/navigation/play-route";
import { resolvePlayRouteWorldPosition } from "@/play/navigation/play-route-target";
import {
  clearPendingReservedHyperstructureCreation,
  isPendingReservedHyperstructureCreation,
  submitActiveWorldBlitzHyperstructureCreation,
} from "@/services/blitz/blitz-hyperstructure-creation";
import { HEX_SIZE, WORLD_CHUNK_CONFIG } from "@/three/constants";
import type { ProceduralMeleeContactEvent, ProceduralRangedReleaseEvent } from "@/three/characters";
import type { ProceduralImpactAuthority } from "@/three/characters/collision/procedural-impact";
import { ArmyManager } from "@/three/managers/army-manager";
import { CombatPresentationCoordinator } from "@/three/combat/combat-presentation-coordinator";
import { BattleDirectionManager } from "@/three/managers/battle-direction-manager";
import { ChestManager } from "@/three/managers/chest-manager";
import { ReservedHyperstructureManager } from "@/three/managers/reserved-hyperstructure-manager";
import { SelectedHexManager } from "@/three/managers/selected-hex-manager";
import { SelectionPulseManager } from "@/three/managers/selection-pulse-manager";
import { StructureManager } from "@/three/managers/structure-manager";
import {
  FrameBudgetWorkQueue,
  isFrameBudgetWorkQueueDisposedError,
  type FrameBudgetWorkLane,
} from "@/three/frame-budget-work-queue";
import { SceneManager } from "@/three/scene-manager";
import { CameraView } from "@/three/scenes/camera-view";
import { CAMERA_CONFIG } from "@/three/constants";
import { type SceneSetupContext } from "@/three/scenes/hexagon-scene";
import { renderProfile, type RenderVisualProfile } from "@/three/render-profile";
import { WorldmapPerfSimulation } from "@/three/scenes/worldmap-perf-simulation";
import { playResourceSound } from "@/three/sound/utils";
import { LeftView } from "@/types";
import { configManager, NEUTRAL_BIOME_CLIMATE, Position } from "@bibliothecadao/eternum";
import {
  requireActiveGameSyncRuntime,
  type ArmySpatialProjectionChange,
  type StructureSpatialProjectionChange,
  type ArmySpatialRenderable,
  type StructureSpatialRenderable,
  type TileSpatialProjectionChange,
  type WorldSpatialHex,
  type TileSpatialRenderable,
  type WorldSpatialProjection,
} from "@bibliothecadao/eternum/game-sync";
import {
  gameWorkerManager,
  type GameWorkerEntityHex,
  type GameWorkerExploredTile,
  type GameWorkerWorldState,
} from "../../managers/game-worker-manager";

import { FELT_CENTER } from "@/ui/config";
import { ChestModal, HelpModal } from "@/ui/features/military";
import { QuickAttackPreview } from "@/ui/features/military/battle/quick-attack-preview";
import { SpireTravelModal } from "@/ui/features/world/components/actions/spire-travel-modal";
import { markGameEntryMilestone, recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";
import {
  beginClientActionLatency,
  type ClientActionLatencyPhase,
  recordClientActionFailed,
  recordClientActionPhase,
  recordClientActionPreConfirmed,
  recordClientActionRendered,
  recordClientActionSubmitted,
} from "@/observability/client-action-latency";
import { SetupResult } from "@bibliothecadao/dojo";
import {
  ActionPath,
  ActionPaths,
  ActionType,
  ArmyActionManager,
  BattleEventSystemUpdate,
  ExplorerRewardSystemUpdate,
  getBlockTimestamp,
  getGuardsByStructure,
  getTileAt,
  recordArmyMovementLatencyPhase,
  SelectableArmy,
  StructureActionManager,
} from "@bibliothecadao/eternum";
import {
  ActorType,
  BiomeIdToType,
  BiomeType,
  ContractAddress,
  Direction,
  findResourceById,
  getDirectionBetweenAdjacentHexes,
  getTroopAttackRange,
  HexEntityInfo,
  HexPosition,
  ID,
  ResourcesIds,
  Structure,
  StructureType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import throttle from "lodash/throttle";
import { Account, AccountInterface } from "starknet";
import { Box3, Group, Raycaster, Sphere, Vector2, Vector3 } from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { WorldmapProceduralTerrain, type TerrainPresentMetrics } from "@/three/terrain/worldmap-procedural-terrain";
import { WorldBiomeSurface } from "@/three/terrain/world-biome-surface";
import {
  StrategicMarkerLayer,
  type StrategicArmyMarkerTier,
  type StrategicStructureMarkerKind,
} from "@/three/managers/strategic-marker-layer";
import { playerColorManager } from "@/three/systems/player-colors";
import { isVillageLikeStructureCategory } from "@/lib/structure-type-utils";
import {
  normalizeOwnerAddress,
  resolveWorldmapContentLadder,
  type WorldmapContentLadder,
  type WorldmapLabelPriorityContext,
} from "./worldmap-content-ladder";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { LeaderboardManager } from "@bibliothecadao/eternum";
import type { TerrainUploadMetrics } from "@/three/terrain/procedural-terrain";
import { hexCellKey } from "@/three/terrain/hex-cell-key";
import type { TerrainRoadAnchor, TerrainSettlementAnchor } from "@/three/terrain/terrain-types";
import type { TerrainSurface } from "@/three/terrain/terrain-surface";
import type { TerrainMovementInteraction } from "@/three/terrain/terrain-movement-effects";
import { env } from "../../../env";
import { playerCosmeticsStore } from "../cosmetics";
import { FXManager } from "../managers/fx-manager";
import { HoverLabelManager, type HoverLabelReconcileResult } from "../managers/hover-label-manager";
import { resolveWorldmapHoverLabelEntity } from "./worldmap-hover-label-entities";
import { resolveWorldmapHoverLabelTargets } from "./worldmap-hover-label-targets";
import {
  shouldReconcileWorldmapHover,
  type WorldmapHoverReconciliationSnapshot,
} from "./worldmap-hover-reconciliation";
import { ResourceFXManager } from "../managers/resource-fx-manager";
import { ArrivalGhostManager } from "../managers/arrival-ghost-manager";
import { resolveHoverVisualPalette, resolveSelectionPulsePalette } from "../managers/worldmap-interaction-palette";
import { isCommittedManagerChunk } from "../managers/manager-update-convergence";
import { SceneName } from "../types/common";
import { getWorldPositionForHex, isAddressEqualToAccount } from "../utils";
import {
  getChunkKeysContainingHexInRenderBoundsAnalytically,
  getChunkCenter as getChunkCenterAligned,
  getRenderBounds,
} from "../utils/chunk-geometry";
import { MemoryMonitor } from "../utils/memory-monitor";
import {
  navigateToStructure,
  toggleMapHexView,
  selectNextStructure as utilSelectNextStructure,
} from "../utils/navigation";
import { snapshotRendererFxCapabilities } from "../renderer-fx-capabilities";
import { SceneShortcutManager } from "../utils/shortcuts";
import { createWorldmapInteractionAdapter } from "./worldmap-interaction-adapter";
import {
  claimWorldmapInteractionOwner,
  getWorldmapInteractionOwnerInstanceId,
  isWorldmapInteractionOwner,
  releaseWorldmapInteractionOwner,
} from "./worldmap-interaction-owner";
import { getLiveWorldmapEntityActions, resetWorldmapEntityActions } from "./worldmap-interaction-state";
import { resolveWorldmapHexClickPlan } from "./worldmap-selection-routing";
import { getMinEffectCleanupDelayMs } from "./travel-effect";
import {
  createWorldmapHydratedRefreshQueueState,
  flushWorldmapHydratedChunkRefreshQueue,
  queueWorldmapHydratedChunkRefresh,
  trackWorldmapHydratedRefreshQueueFlush,
  waitForWorldmapHydratedRefreshQueueIdle,
} from "./worldmap-hydrated-refresh-runtime";
import {
  cancelWorldmapChunkRefreshWaiters,
  createWorldmapChunkRefreshRuntimeState,
  requestWorldmapChunkRefreshToken,
  runWorldmapChunkRefreshExecution,
  scheduleWorldmapChunkRefreshTimer,
  waitForWorldmapRequestedChunkRefresh,
} from "./worldmap-chunk-refresh-runtime";
import {
  createWorldmapChunkTransitionRuntimeState,
  resolveWorldmapChunkTransitionTimeoutRecovery,
  runWorldmapChunkTransition,
  type WorldmapChunkTransitionHardTimeoutInfo,
} from "./worldmap-chunk-transition-runtime";
import {
  settleWorldmapShortcutSelectionProtection,
  shouldResetWorldmapShortcutRefreshUiReason,
} from "./worldmap-shortcut-selection-runtime";
import {
  clearWorldmapPostCommitManagerCatchUpState,
  createWorldmapPostCommitManagerCatchUpState,
  drainWorldmapPostCommitManagerCatchUpQueue,
  enqueueWorldmapPostCommitManagerCatchUpTask,
  scheduleWorldmapPostCommitManagerCatchUpDrain,
} from "./worldmap-post-commit-manager-catchup-runtime";
import { prepareWorldmapChunkRuntime } from "./worldmap-chunk-preparation-runtime";
import {
  WorldmapExactTerrainPreparationRuntime,
  type WorldmapExactTerrainPreparation,
} from "./worldmap-exact-terrain-preparation-runtime";
import { handleWorldmapChunkFinalizeResult } from "./worldmap-chunk-finalize-runtime";
import { prepareWorldmapChunkSwitchRuntime } from "./worldmap-chunk-switch-runtime";
import { commitOwnedWorldmapPreparedTerrain } from "./worldmap-owned-terrain-commit";
import { catchUpCommittedWorldmapChunkManagers } from "./worldmap-committed-chunk-manager-catchup";
import {
  recordWorldmapChunkMemoryDelta,
  resolveWorldmapChunkSwitchAnchorState,
} from "./worldmap-chunk-success-runtime";
import { handleWorldmapRefreshCommitRuntime } from "./worldmap-refresh-commit-runtime";
import { runWorldmapRefreshRuntime } from "./worldmap-refresh-runtime";
import {
  handleWorldmapCriticalManagerCatchUpFailures,
  runWorldmapCriticalManagerCatchUp,
  type WorldmapCriticalManagerCatchUpFailure,
} from "./worldmap-critical-manager-catchup-runtime";
import {
  commitWorldmapPreparedTerrainPresentation,
  recordWorldmapTerrainReadyDuration,
} from "./worldmap-terrain-commit-runtime";
import { runWorldmapArmySelectionRecovery } from "./worldmap-army-selection-recovery-runtime";
import { shouldQueueArmySelectionRecovery } from "./worldmap-army-tab-selection";
import { shouldPlayArmyMovementFx } from "./worldmap-movement-fx-policy";
import { resolveArrivalGhostVisualStyle, shouldCreatePredictiveArrivalGhost } from "../managers/arrival-ghost-policy";
import {
  resolveExploreCompletionVisualCleanup,
  shouldCleanupTrackedTravelEffect,
  type MovementEffectClearReason,
  type TravelEffectType,
} from "./worldmap-travel-effect-policy";
import { WorldmapOwnershipPulsePresenter } from "./worldmap-structure-ownership-pulses";
import {
  resolveEntityActionPathLookup,
  resolveEntityActionPathsTransitionTokenForForcedRefresh,
  resolveEntityActionPathsTransitionTokenSync,
  resolvePendingChunkRefreshUiReason,
  shouldRequestTileRefreshForStructureBoundsChange,
  shouldClearEntitySelectionForChunkSwitch,
  shouldClearEntitySelectionForEntityActionTransition,
  shouldClearEntitySelectionForMissingActionPathOwnership,
  shouldForceShortcutNavigationRefresh,
  shouldRunShortcutForceFallback,
  shouldRunManagerUpdate,
  shouldForceChunkRefreshForZoomDistanceChange,
  waitForChunkTransitionToSettle,
} from "./worldmap-chunk-transition";
import { createWorldmapChunkPolicy } from "./worldmap-chunk-policy";
import { createWorldmapZoomHardeningConfig, resetWorldmapZoomHardeningRuntimeState } from "./worldmap-zoom-hardening";
import { WorldmapHoverLabelRecovery, type HoverLabelRecoveryReason } from "./worldmap-hover-label-recovery";
import { WorldmapTerrainVisibilityHealthMonitor } from "./worldmap-terrain-visibility-health-monitor";
import { WorldmapZoomCoordinator } from "./worldmap-zoom/worldmap-zoom-coordinator";
import {
  normalizeWorldmapWheelDelta,
  resolveWorldmapWheelPixelDelta,
} from "./worldmap-zoom/worldmap-zoom-input-normalizer";
import {
  createWorldmapZoomRefreshPlannerState,
  planWorldmapZoomRefresh,
} from "./worldmap-zoom/worldmap-zoom-refresh-planner";
import type { WorldmapCameraSnapshot, ZoomIntent } from "./worldmap-zoom/worldmap-zoom-types";
import {
  resolveWorldmapChunkRefreshDebounceMs,
  shouldDelayWorldmapChunkSwitch,
} from "./worldmap-chunk-switch-delay-policy";
import { classifyWorldmapUploadWork, resolveWorldmapPostCommitWorkAction } from "./worldmap-upload-budget-policy";
import {
  applyWorldmapSwitchOffRuntimeState,
  invalidateWorldmapSwitchOffTransitionState,
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
  isHexInsideAnyBounds,
} from "./worldmap-chunk-bounds";
import { resolveTerrainPresentationWorldBounds } from "./worldmap-terrain-bounds-policy";
import { getRenderOverlapChunkKeys, getRenderOverlapNeighborChunkKeys } from "./worldmap-chunk-neighbors";
import { prunePrefetchQueueByAreaKey, type PrefetchQueueItem } from "./worldmap-prefetch-queue";
import { resolveUrlChangedListenerLifecycle } from "./worldmap-lifecycle-policy";
import {
  disposeWorldmapStoreBridge,
  registerWorldmapStoreBridge,
  syncWorldmapStoreBridgeState,
  type WorldmapStoreState,
} from "./worldmap-store-bridge";
import { shouldCastWorldmapDirectionalShadow } from "./worldmap-shadow-policy";
import {
  createWorldmapChunkDiagnostics,
  recordChunkDiagnosticsEvent,
  type WorldmapChunkDiagnostics,
} from "./worldmap-chunk-diagnostics";
import {
  incrementWorldmapRenderCounter,
  incrementWorldmapForceRefreshReason,
  recordWorldmapRenderDuration,
  resetWorldmapRenderDiagnostics,
  setWorldmapRenderGauge,
  snapshotWorldmapRenderDiagnostics,
  type WorldmapForceRefreshReason,
  type WorldmapRenderDurationMetric,
} from "../perf/worldmap-render-diagnostics";
import { resolveSpireTraversalAction } from "./worldmap-spire-travel-policy";
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
  evaluateProjectionSyncVolumeRegression,
  type ProjectionSyncVolumeRegressionResult,
} from "./worldmap-projection-sync-volume-regression";
import { prepareWarpTravelChunkBounds } from "./warp-travel-chunk-bounds-preparation";
import { resolveWarpTravelDirectionalPrefetchPlan } from "./warp-travel-directional-prefetch";
import { drainWarpTravelPrefetchQueue } from "./warp-travel-prefetch-drain";
import { enqueueWarpTravelPrefetch } from "./warp-travel-prefetch-enqueue";
import { resolveWarpTravelVisibleChunkDecision } from "./warp-travel-chunk-runtime";
import { finalizeWarpTravelChunkSwitch } from "./warp-travel-chunk-switch-commit";
import { resolveSameChunkRefreshCommit } from "./worldmap-same-chunk-refresh-commit";
import { runWarpTravelManagerFanout } from "./warp-travel-manager-fanout";
import { WarpTravel, type WarpTravelLifecycleAdapter } from "./warp-travel";
import { startWorldmapEntryReadiness } from "./worldmap-entry-readiness";
import { completeWorldmapInteractiveRefresh, type WorldmapWarpTravelPhase } from "./worldmap-warp-travel-refresh";
import { resolveWorldmapChunkHysteresis } from "./worldmap-chunk-hysteresis-policy";
import {
  prepareWorldmapChunkPresentation,
  prewarmWorldmapChunkPresentation,
  type WorldmapChunkPresentationTimeoutInfo,
} from "./worldmap-chunk-presentation";
import {
  resolveWorldmapChunkFromHexPosition,
  resolveWorldmapChunkFromWorldPosition,
} from "./worldmap-chunk-selection-policy";
import { registerActiveWorldmapRecoveryHandle } from "./worldmap-reconnect-recovery-handle";
import {
  createReconnectRefreshQueueState,
  drainReconnectRefreshQueue,
  queueOrRunReconnectRefresh,
} from "./worldmap-reconnect-refresh-queue";
import { computeMatrixCacheEvictions } from "./worldmap-matrix-cache-eviction";
import { snapshotExploredTilesRegion, lookupSnapshotBiome } from "./explored-tiles-snapshot";
import { createTerrainCacheGeneration, isTerrainCacheStale } from "./terrain-cache-generation";
import { gameEntityKey } from "@/sync/game-scope";
import {
  WORLDMAP_CAMERA_ZOOM,
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchRadians,
} from "./worldmap-camera-view-profile";
import {
  appendWorldmapChunkTrace,
  createWorldmapChunkTraceBuffer,
  formatWorldmapChunkWarning,
  snapshotWorldmapChunkTrace,
  type WorldmapChunkTraceEntry,
  type WorldmapChunkTraceEvent,
} from "./worldmap-chunk-trace";
import {
  applyWorldmapTerrainPresentation,
  applyWorldmapVisualTerrainPage,
  composeWorldmapTerrainPresentations,
  createWorldmapTerrainPresentationState,
  getPrioritizedWorldmapTerrainPresentations,
  partitionPreparedTerrainIntoVisualPages,
  resolveWorldmapVisualTerrainPageKeyForHex,
  resolveWorldmapVisualTerrainWindow,
  type WorldmapTerrainCellRef,
  type WorldmapTerrainComposite,
  type WorldmapTerrainPresentation,
  type WorldmapTerrainPresentationKind,
  type WorldmapTerrainPresentationRuntimeState,
  type WorldmapTerrainSourceCellRef,
  type WorldmapVisualTerrainWindow,
} from "./worldmap-terrain-presentation-runtime";

interface CachedTerrainEntry {
  box?: Box3;
  sphere?: Sphere;
  expectedExploredTerrainInstances?: number;
  terrainFingerprint?: string;
  terrainCells?: WorldmapTerrainSourceCellRef[];
  generation?: number;
}

interface PreparedTerrainChunk {
  chunkKey: string;
  startRow: number;
  startCol: number;
  bounds: { box: Box3; sphere: Sphere };
  expectedExploredTerrainInstances: number;
  terrainFingerprint: string;
  terrainCells: WorldmapTerrainSourceCellRef[];
  biomeEntries: Map<string, CachedTerrainEntry>;
}

type PreparedWorldmapChunkRuntime = Awaited<ReturnType<typeof prepareWorldmapChunkRuntime<PreparedTerrainChunk>>>;

interface WorldmapLocalBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

type WorldmapTerrainPresentationEntry = WorldmapTerrainPresentation<
  Map<string, CachedTerrainEntry>,
  PreparedTerrainChunk["bounds"]
>;
type WorldmapTerrainPresentationState = WorldmapTerrainPresentationRuntimeState<
  Map<string, CachedTerrainEntry>,
  PreparedTerrainChunk["bounds"]
>;
type WorldmapTerrainPresentationComposite = WorldmapTerrainComposite<
  Map<string, CachedTerrainEntry>,
  PreparedTerrainChunk["bounds"]
>;

interface WorldmapChunkSwitchTerrainShellInput {
  chunkKey: string;
  startCol: number;
  startRow: number;
  transitionToken: number;
}

interface WorldmapVisualTerrainPageBuildRequest {
  generation: number;
  pageKey: string;
  priority: "critical" | "visible";
  revision: number;
  preserveCoverageAuthority?: boolean;
  transitionToken?: number;
}

interface WorldmapVisibleChunkUpdateOptions {
  reason: "default" | "shortcut";
  triggerReason: string;
}

interface WorldmapManagerCatchUpOptions {
  force?: boolean;
  transitionToken?: number;
  triggerReason: string;
}

interface VisualTerrainPagePhaseTimings {
  commitMs: number;
  cpuBuildMs: number;
  modelWaitMs: number;
  totalMs: number;
}

type WorldmapChunkSwitchP95RegressionDebugResult = {
  baselineLabel: string | null;
  result: ChunkSwitchP95RegressionResult;
};

type WorldmapChunkFirstVisibleCommitP95RegressionDebugResult = {
  baselineLabel: string | null;
  result: ChunkSwitchP95RegressionResult;
};

interface WorldmapManagerChunkRecoveryInput {
  chunkKey: string;
  transitionToken: number;
}

interface CriticalManagerStallRecoveryResolver {
  resolveRecoveryInput: () => WorldmapManagerChunkRecoveryInput;
  getRecoveryDetails: () => Record<string, unknown>;
  shouldScheduleRecoveryRefresh: () => boolean;
}

type WorldmapProjectionSyncVolumeRegressionDebugResult = {
  baselineLabel: string | null;
  result: ProjectionSyncVolumeRegressionResult;
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
  evaluateWorldmapProjectionSyncVolumeRegression?: (
    baselineLabel?: string,
    allowedIncreaseFraction?: number,
  ) => WorldmapProjectionSyncVolumeRegressionDebugResult;
  getWorldmapRenderDiagnostics?: () => ReturnType<typeof snapshotWorldmapRenderDiagnostics>;
  getWorldBiomeSurface?: () => WorldBiomeSurface;
  getStrategicMarkers?: () => StrategicMarkerLayer;
  getTerrainUploadMetrics?: () => TerrainUploadMetrics;
  getTerrainPresentMetrics?: () => TerrainPresentMetrics;
  resetWorldmapRenderDiagnostics?: () => void;
  getWorldmapChunkTrace?: () => WorldmapChunkTraceEntry[];
};

const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;
const MIN_TRAVEL_EFFECT_VISIBLE_MS = 600;
const MAX_TRAVEL_EFFECT_LIFETIME_MS = 90_000;
const SHORTCUT_NAVIGATION_DURATION_SECONDS = 0;
const WORLDMAP_CHUNK_PHASE_TIMEOUT_MS = env.VITE_PUBLIC_WORLDMAP_CHUNK_PHASE_TIMEOUT_MS;
// Give an exact preparation that is already finishing one render opportunity
// without adding visible latency before the terrain shell fallback starts.
const WORLDMAP_EXACT_TERRAIN_JOIN_BUDGET_MS = 16;
const WORLDMAP_CHUNK_RECOVERY_COOLDOWN_MS = 2_000;
// Hard timeout wrapping the entire chunk transition (phase timeouts + post-phase work).
// Catches cases where post-phase awaits (e.g. manager catch-up, finalize rollback)
// hang past all per-phase timeouts and would otherwise lock isChunkTransitioning.
// Kept tight so a wedged transition recovers inside ~20s instead of 45s+.
const WORLDMAP_CHUNK_TRANSITION_HARD_TIMEOUT_MS = Math.max(WORLDMAP_CHUNK_PHASE_TIMEOUT_MS + 8_000, 20_000);
const WORLDMAP_STREAMING_ROLLOUT = {
  stagedPathEnabled: env.VITE_PUBLIC_WORLDMAP_STREAMING_STAGED !== false,
};
function resolveStructureMarkerKind(structureType: StructureType): StrategicStructureMarkerKind {
  if (structureType === StructureType.Realm) return "realm";
  if (structureType === StructureType.Hyperstructure) return "hyperstructure";
  if (structureType === StructureType.Bank) return "bank";
  if (structureType === StructureType.FragmentMine || structureType === StructureType.BitcoinMine) return "mine";
  return isVillageLikeStructureCategory(structureType) ? "village" : "realm";
}

function isSameWorldSpatialHex(hex: WorldSpatialHex | undefined, contract: { x: number; y: number }): boolean {
  return hex !== undefined && hex.col === contract.x && hex.row === contract.y;
}

/** How many leaderboard leaders keep their name tags in the mid zoom band. */
const TOP_OWNER_LABEL_COUNT = 10;

/** One minimap zoom click moves the camera by two wheel notches. */
const MINIMAP_ZOOM_STEP_DELTA = 240;

const WORLDMAP_ZOOM_HARDENING = createWorldmapZoomHardeningConfig({
  enabled: env.VITE_PUBLIC_WORLDMAP_ZOOM_HARDENING === true,
  telemetry: env.VITE_PUBLIC_WORLDMAP_ZOOM_HARDENING_TELEMETRY === true,
});
const WORLDMAP_CHUNK_POLICY = createWorldmapChunkPolicy(WORLD_CHUNK_CONFIG);
type DirectionalPrefetchAnchor = {
  forwardChunkKey: string;
  movementAxis: "x" | "z";
  movementSign: -1 | 1;
};
type WorldmapCameraTransitionStatus = "idle" | "transitioning";
interface WorldmapUrlLocationMoveOptions {
  requestRefresh?: boolean;
}
let worldmapInteractionDebugInstanceCounter = 0;

function allocateWorldmapInteractionDebugInstanceId(): number {
  worldmapInteractionDebugInstanceCounter += 1;
  return worldmapInteractionDebugInstanceCounter;
}

function resolveTileBiomeType(biomeId: number): BiomeType {
  const biome = BiomeIdToType[biomeId];
  return biome === BiomeType.None ? BiomeType.Grassland : biome || BiomeType.Grassland;
}

function resolveExploreClientLatencyPhase(stage: string | undefined): ClientActionLatencyPhase | undefined {
  if (stage === "explore_calls_built") return "calls_built";
  if (stage === "explore_submit_guard_released") return "submit_guard_released";
  if (stage === "explore_provider_lock_acquired") return "provider_lock_acquired";
  if (stage === "explore_execution_details_ready") return "execution_details_ready";
  if (stage === "explore_sign_send_started") return "sign_send_started";
  return undefined;
}

export default class WorldmapScene extends WarpTravel {
  private readonly interactionDebugInstanceId = allocateWorldmapInteractionDebugInstanceId();
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
  private postCommitManagerCatchUpRuntimeState = createWorldmapPostCommitManagerCatchUpState<{
    chunkKey: string;
    options?: { force?: boolean; transitionToken?: number };
    estimatedUploadBytes: number;
    deferredCount?: number;
  }>();
  private readonly postCommitManagerCatchUpBudgetBytes = 256 * 1024;
  private directionalPresentationChunkKeys: Set<string> = new Set();
  private activeDirectionalPresentationPrewarms: Set<string> = new Set();
  private readonly exactTerrainPreparations =
    new WorldmapExactTerrainPreparationRuntime<PreparedWorldmapChunkRuntime>();
  private visualTerrainPresentationState: WorldmapTerrainPresentationState = createWorldmapTerrainPresentationState();
  private visualTerrainRetentionTimeout: number | null = null;
  private visualTerrainGeneration = 0;
  private visualTerrainWindow: WorldmapVisualTerrainWindow | null = null;
  private visualTerrainWindowPageKeys: Set<string> = new Set();
  private terrainPresentationPromise: Promise<void> = Promise.resolve();
  private readonly chunkWorkQueue = new FrameBudgetWorkQueue({
    isLoading: () => !this.hasInitialized,
    onLongTask: ({ durationMs }) => {
      incrementWorldmapRenderCounter("frameBudgetLongTasks");
      recordWorldmapRenderDuration("frameBudgetLongTaskMs", durationMs);
    },
  });
  private queuedVisualTerrainBuildPageKeys: Map<string, number> = new Map();
  private activeVisualTerrainBuildPageKeys: Map<string, WorldmapVisualTerrainPageBuildRequest> = new Map();
  private readonly visualTerrainPageRevisions = new Map<string, number>();
  private readonly liveTilePageRebuilds = new Map<string, Promise<void>>();
  private pendingVisualTerrainCompositeCommit: Promise<WorldmapTerrainPresentationComposite | null> | null = null;
  private prefetchQueue: PrefetchQueueItem[] = [];
  private directionalPrefetchAreaKeys: Set<string> = new Set();
  private queuedPrefetchAreaKeys: Set<string> = new Set();
  private activePrefetches = 0;
  private readonly maxConcurrentPrefetches = WORLDMAP_CHUNK_POLICY.prefetch.maxConcurrent;
  private wheelHandler: ((event: WheelEvent) => void) | null = null;
  private wheelEventTarget: HTMLElement | null = null;
  private readonly zoomCoordinator = new WorldmapZoomCoordinator({
    initialDistance: this.getCurrentCameraDistance(),
    minDistance: WORLDMAP_CAMERA_ZOOM.minDistance,
    maxDistance: WORLDMAP_CAMERA_ZOOM.maxDistance,
  });
  private zoomRefreshPlannerState = createWorldmapZoomRefreshPlannerState();
  private readonly worldmapCameraViewListeners: Set<(view: CameraView) => void> = new Set();
  private readonly worldmapCameraTransitionListeners: Set<(status: WorldmapCameraTransitionStatus) => void> = new Set();
  private lastPublishedStableCameraView = this.zoomCoordinator.getSnapshot().stableBand;
  private lastPublishedZoomStatus: WorldmapCameraTransitionStatus = "idle";
  private renderChunkSize = this.chunkGeometry.renderSize;

  private totalStructures: number = 0;

  private currentChunk: string = "null";
  private chunkTransitionRuntimeState = createWorldmapChunkTransitionRuntimeState();
  private reconnectRefreshQueueState = createReconnectRefreshQueueState();
  private chunkRefreshRuntimeState = createWorldmapChunkRefreshRuntimeState();
  private pendingChunkRefreshForce = false;
  private readonly pendingChunkRefreshReasons = new Set<WorldmapForceRefreshReason>();
  private pendingChunkRefreshUiReason: "default" | "shortcut" = "default";
  private isShortcutArmySelectionInFlight = false;
  private lastControlsCameraDistance: number | null = null;
  private readonly zoomForceRefreshDistanceThreshold = 0.75;
  private terrainVisibilityHealthMonitor!: WorldmapTerrainVisibilityHealthMonitor;
  private readonly minCachedTerrainCoverageFraction = 0.08;
  private readonly minCachedExploredRetentionFraction = 0.6;
  private readonly minExpectedExploredForCacheValidation = 48;
  private readonly chunkRowsAhead = WORLDMAP_CHUNK_POLICY.pin.rowsAhead;
  private readonly chunkRowsBehind = WORLDMAP_CHUNK_POLICY.pin.rowsBehind;
  private readonly chunkColsEachSide = WORLDMAP_CHUNK_POLICY.pin.colsEachSide;
  private hydratedRefreshQueueState = createWorldmapHydratedRefreshQueueState();
  private skipNextInitialSetupUrlRefresh = false;
  private hydratedRefreshSuppressionAreaKeys: Set<string> = new Set();
  private cameraPositionScratch: Vector3 = new Vector3();
  private cameraDirectionScratch: Vector3 = new Vector3();
  private cameraGroundIntersectionScratch: Vector3 = new Vector3();
  private interactiveHexWindowKey: string | null = null;

  private armyManager!: ArmyManager;
  private readonly terrainMovementInteractionBuffer: TerrainMovementInteraction[] = [];
  private latestRenderVisualProfile?: RenderVisualProfile;
  private pendingArmyMovementVisualLifecycleDisposers: Map<ID, () => void> = new Map();
  private pendingExploreLatencyActions: Map<ID, { actionId: string; targetKey: string }> = new Map();
  private get hydratedChunkRefreshes(): Set<string> {
    return this.hydratedRefreshQueueState.queuedChunkKeys;
  }

  private set hydratedChunkRefreshes(value: Set<string>) {
    this.hydratedRefreshQueueState.queuedChunkKeys = value;
  }

  private get hydratedRefreshScheduled(): boolean {
    return this.hydratedRefreshQueueState.isScheduled;
  }

  private set hydratedRefreshScheduled(value: boolean) {
    this.hydratedRefreshQueueState.isScheduled = value;
  }

  private get chunkRefreshTimeout(): number | null {
    return this.chunkRefreshRuntimeState.timeoutId;
  }

  private set chunkRefreshTimeout(value: number | null) {
    this.chunkRefreshRuntimeState.timeoutId = value;
  }

  private get chunkRefreshDeadlineAtMs(): number | null {
    return this.chunkRefreshRuntimeState.deadlineAtMs;
  }

  private set chunkRefreshDeadlineAtMs(value: number | null) {
    this.chunkRefreshRuntimeState.deadlineAtMs = value;
  }

  private get chunkRefreshRequestToken(): number {
    return this.chunkRefreshRuntimeState.requestToken;
  }

  private set chunkRefreshRequestToken(value: number) {
    this.chunkRefreshRuntimeState.requestToken = value;
  }

  private get chunkRefreshAppliedToken(): number {
    return this.chunkRefreshRuntimeState.appliedToken;
  }

  private set chunkRefreshAppliedToken(value: number) {
    this.chunkRefreshRuntimeState.appliedToken = value;
  }

  private get chunkRefreshRunning(): boolean {
    return this.chunkRefreshRuntimeState.running;
  }

  private set chunkRefreshRunning(value: boolean) {
    this.chunkRefreshRuntimeState.running = value;
  }

  private get chunkRefreshRerunRequested(): boolean {
    return this.chunkRefreshRuntimeState.rerunRequested;
  }

  private set chunkRefreshRerunRequested(value: boolean) {
    this.chunkRefreshRuntimeState.rerunRequested = value;
  }

  private get globalChunkSwitchPromise(): Promise<void> | null {
    return this.chunkTransitionRuntimeState.activePromise;
  }

  private set globalChunkSwitchPromise(value: Promise<void> | null) {
    this.chunkTransitionRuntimeState.activePromise = value;
  }

  private get isChunkTransitioning(): boolean {
    return this.chunkTransitionRuntimeState.isTransitioning;
  }

  private set isChunkTransitioning(value: boolean) {
    this.chunkTransitionRuntimeState.isTransitioning = value;
  }

  private get postCommitManagerCatchUpQueue() {
    return this.postCommitManagerCatchUpRuntimeState.queue;
  }

  private set postCommitManagerCatchUpQueue(
    value: Array<{
      chunkKey: string;
      options?: { force?: boolean; transitionToken?: number };
      estimatedUploadBytes: number;
      deferredCount?: number;
    }>,
  ) {
    this.postCommitManagerCatchUpRuntimeState.queue = value;
  }

  private get postCommitManagerCatchUpFrameHandle(): number | null {
    return this.postCommitManagerCatchUpRuntimeState.frameHandle;
  }

  private set postCommitManagerCatchUpFrameHandle(value: number | null) {
    this.postCommitManagerCatchUpRuntimeState.frameHandle = value;
  }
  private handleTransactionProgress?: (...args: any[]) => void;
  private readonly cameraTargetHexUpdateIntervalMs = 100;
  private readonly cameraDistanceUpdateEpsilon = 0.5;
  private armySelectionRecoveryInFlight: Set<ID> = new Set();
  private structureManager!: StructureManager;
  private memoryMonitor?: MemoryMonitor;
  private chestManager!: ChestManager;
  private worldSpatialProjection!: WorldSpatialProjection;
  private unsubscribeWorldSpatialProjection?: () => void;
  private exploredTiles: Map<number, Map<number, BiomeType>> = new Map();
  private proceduralTerrain!: WorldmapProceduralTerrain;
  private worldBiomeSurface!: WorldBiomeSurface;
  private strategicMarkers!: StrategicMarkerLayer;
  // normalized positions and if they are allied or not

  // Battle direction manager for tracking attacker/defender relationships
  private battleDirectionManager!: BattleDirectionManager;

  private selectedHexManager!: SelectedHexManager;
  private interactionAdapter!: ReturnType<typeof createWorldmapInteractionAdapter>;
  private selectionPulseManager!: SelectionPulseManager;
  private ownershipPulsePresenter!: WorldmapOwnershipPulsePresenter;
  private updateCameraTargetHexThrottled?: ReturnType<typeof throttle>;
  private refreshVisualTerrainWindowThrottled?: ReturnType<typeof throttle>;
  private updateCameraTargetHex = () => {
    const normalizedHex = this.getCameraTargetHex();
    const contractHex = new Position({ x: normalizedHex.col, y: normalizedHex.row }).getContract();
    const nextHex = { col: Number(contractHex.x), row: Number(contractHex.y) };
    const state = useUIStore.getState();
    const currentHex = state.cameraTargetHex;
    const hexChanged = !currentHex || currentHex.col !== nextHex.col || currentHex.row !== nextHex.row;
    const nextCameraDistance = Math.round(this.controls.object.position.distanceTo(this.controls.target) * 100) / 100;
    const distanceChanged =
      state.cameraDistance === null ||
      Math.abs(state.cameraDistance - nextCameraDistance) >= this.cameraDistanceUpdateEpsilon;

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
    this.applyDirectionalZoomIntent(detail.zoomOut);
  };
  private handleWorldmapControlsChange = () => {
    if (this.sceneManager.getCurrentScene() !== SceneName.WorldMap) return;
    this.updateCameraTargetHexThrottled?.();
    this.refreshVisualTerrainWindowThrottled?.();

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
  private lastHoverReconciliation: WorldmapHoverReconciliationSnapshot | null = null;

  // Performance simulation helper
  private perfSimulation: WorldmapPerfSimulation | null = null;
  // Performance simulation: Show all biomes as explored (bypasses fog of war)
  private simulateAllExplored: boolean = false;
  private exploredTilesGeneration = createTerrainCacheGeneration();
  private cachedMatrices: Map<string, Map<string, CachedTerrainEntry>> = new Map();
  private cachedMatrixOrder: string[] = [];
  private readonly maxMatrixCacheSize = WORLDMAP_CHUNK_POLICY.cache.recommendedMinSize;
  private pinnedChunkKeys: Set<string> = new Set();
  private updateHexagonGridPromise: Promise<void> | null = null;
  private currentHexGridTask: symbol | null = null;
  private readonly terrainWorkUnitBudgetMs = 5.5;
  private readonly hexGridMinBatch = 120;
  private readonly hexGridMaxBatch = 900;
  private travelEffects: Map<string, () => void> = new Map();
  private travelEffectsByEntity: Map<ID, { key: string; cleanup: () => void; effectType: TravelEffectType }> =
    new Map();
  private cancelHexGridComputation?: () => void;

  // Global chunk switching coordination
  private chunkTransitionToken = 0;
  private terrainTimeoutRecoveryAuthority: {
    timedOutTransitionToken: number;
    recoveryTransitionToken: number;
  } | null = null;
  private actionPathsTransitionToken: number | null = null;
  private isApplyingLocalActionPathUpdate = false;
  private isSceneExitInteractionResetInProgress = false;
  private chunkDiagnostics: WorldmapChunkDiagnostics = createWorldmapChunkDiagnostics();
  private chunkDiagnosticsBaselines: WorldmapChunkDiagnosticsBaselineEntry[] = [];
  private readonly chunkTraceBuffer = createWorldmapChunkTraceBuffer();
  private chunkRecoveryTimeout: number | null = null;
  private lastChunkRecoveryAtMs = 0;

  // Label groups
  private armyLabelsGroup!: Group;
  private structureLabelsGroup!: Group;
  private chestLabelsGroup!: Group;
  private reservedHyperstructureManager!: ReservedHyperstructureManager;

  private storeSubscriptions: Array<() => void> = [];

  dojo: SetupResult;

  private pinnedRenderAreas: Set<string> = new Set();

  private fxManager!: FXManager;
  private arrivalGhostManager!: ArrivalGhostManager;
  private resourceFXManager!: ResourceFXManager;
  private combatPresentation?: CombatPresentationCoordinator;
  private unsubscribeProceduralProjectileImpact?: () => void;
  private unsubscribeProceduralMeleeContact?: () => void;
  private unsubscribeProceduralRangedRelease?: () => void;
  private armyIndex: number = 0;
  private selectableArmies: SelectableArmy[] = [];
  private structureIndex: number = 0;
  private playerStructures: Structure[] = [];

  // Hover-based label expansion manager
  private hoverLabelManager!: HoverLabelManager;

  private worldUpdateUnsubscribes: Array<() => void> = [];
  private visibilityChangeHandler?: () => void;
  private cosmeticsSubscriptionCleanup?: () => void;
  private unregisterWorldmapRecoveryHandle: (() => void) | null = null;
  private readonly hoverLabelRaycaster: Raycaster;
  private currentHoverLabelHex: HexPosition | null = null;
  private hoverLabelRecovery!: WorldmapHoverLabelRecovery;

  constructor(
    dojoContext: SetupResult,
    raycaster: Raycaster,
    controls: MapControls,
    mouse: Vector2,
    sceneManager: SceneManager,
    private readonly markLabelsDirty: () => void = () => {},
  ) {
    super(SceneName.WorldMap, controls, dojoContext, mouse, raycaster, sceneManager);

    this.dojo = dojoContext;
    this.hoverLabelRaycaster = raycaster;
    this.logWorldmapSceneConstruction();
    this.registerWorldmapRecoveryHandle();
    this.initializeWorldmapSceneServices(dojoContext);
    this.bindTransactionFailureLifecycle(dojoContext);
    this.initializeWorldmapManagers();
    this.configureWorldmapRecoveryLifecycle();
    this.initializeWorldmapSupportManagers();
    this.bindWorldSpatialProjectionLifecycle();
    this.bindWorldmapCameraViewLifecycle();
    this.registerWorldUpdateSubscriptions();
    this.initializeWorldmapInteractionRuntime();
    this.bindWorldmapSceneUiLifecycle();
    this.registerWorldmapShortcuts();
  }

  public override setInputSurface(surface: HTMLElement): void {
    super.setInputSurface(surface);
    this.detachWorldmapWheelHandler();
    this.attachWorldmapWheelHandler();
  }

  public override getTerrainSurface(): TerrainSurface {
    return this.proceduralTerrain;
  }

  private registerWorldmapRecoveryHandle(): void {
    this.unregisterWorldmapRecoveryHandle = registerActiveWorldmapRecoveryHandle({
      refreshAfterReconnect: () => this.refreshAfterReconnect(),
      recoverAfterConnectionFailure: () => this.recoverAfterConnectionFailure(),
    });
  }

  private logWorldmapSceneConstruction(): void {
    this.logInteractionDebug("scene_instance_created", {
      sceneName: SceneName.WorldMap,
      existingStoreSubscriptionCount: this.storeSubscriptions.length,
    });
    this.traceChunk("scene_created", {
      sceneName: SceneName.WorldMap,
      existingStoreSubscriptionCount: this.storeSubscriptions.length,
    });
  }

  /** The whole-world biome surface is the worldmap's ground; the shared navy plane would hide it. */
  protected override shouldCreateGroundMesh(): boolean {
    return false;
  }

  private initializeWorldmapSceneServices(dojoContext: SetupResult): void {
    this.fxManager = new FXManager(this.scene, 1);
    this.proceduralTerrain = new WorldmapProceduralTerrain();
    this.scene.add(this.proceduralTerrain.object3d);
    this.worldBiomeSurface = new WorldBiomeSurface();
    this.scene.add(this.worldBiomeSurface.object3d);
    this.strategicMarkers = new StrategicMarkerLayer();
    this.scene.add(this.strategicMarkers.object3d);
    this.resourceFXManager = new ResourceFXManager(this.scene, 1.2, {
      terrainSurface: this.proceduralTerrain,
    });
    void this.proceduralTerrain.loadProps().catch((error) => {
      console.warn("[WorldMap] Optional procedural terrain props failed to load", error);
    });
    void this.proceduralTerrain.loadGroundTextures().catch((error) => {
      console.warn("[WorldMap] Procedural ground textures failed; retaining flat terrain", error);
    });

    if (MEMORY_MONITORING_ENABLED) {
      this.memoryMonitor = new MemoryMonitor({
        spikeThresholdMB: 30,
        onMemorySpike: (spike) => {
          if (VERBOSE_LOGS_ENABLED) {
            console.warn(`🗺️  WorldMap Memory Spike: +${spike.increaseMB.toFixed(1)}MB in ${spike.context}`);
          }
        },
      });
    }

    if (this.GUIFolder) {
      this.GUIFolder.add(this, "moveCameraToURLLocation");
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
    }
  }

  private bindTransactionFailureLifecycle(dojoContext: SetupResult): void {
    this.handleTransactionProgress = (payload: { stage?: string; type?: string; explorerId?: number | string }) => {
      if (payload?.type !== "explore") return;

      const explorerId = Number(payload.explorerId);
      if (!Number.isFinite(explorerId) || explorerId <= 0) return;

      const phase = resolveExploreClientLatencyPhase(payload.stage);
      const pendingAction = this.pendingExploreLatencyActions.get(explorerId);
      if (phase && pendingAction) recordClientActionPhase(pendingAction.actionId, phase);

      if (payload.stage === "explore_provider_lock_acquired") {
        recordArmyMovementLatencyPhase({
          phase: "explore_provider_lock_acquired",
          source: "worldmap",
          entityId: explorerId,
        });
      }
    };

    dojoContext.network?.provider?.on("transactionProgress", this.handleTransactionProgress);
  }

  override applyRenderVisualProfile(features: RenderVisualProfile): void {
    super.applyRenderVisualProfile(features);
    this.latestRenderVisualProfile = features;
    this.applyWorldmapVisualLimits(features);
  }

  private applyWorldmapVisualLimits(features: RenderVisualProfile): void {
    this.visibilityManager?.setAnimationMaxDistance(features.animationCullDistance);
    this.structureManager?.setAnimationCullDistance(features.animationCullDistance);
    this.armyManager?.setLabelRenderDistance(features.labelRenderDistance);
    this.structureManager?.setLabelRenderDistance(features.labelRenderDistance);
  }

  private initializeWorldmapManagers(): void {
    this.worldSpatialProjection = requireActiveGameSyncRuntime().requireWorldSpatialProjection();
    this.armyLabelsGroup = new Group();
    this.armyLabelsGroup.name = "ArmyLabelsGroup";
    this.structureLabelsGroup = new Group();
    this.structureLabelsGroup.name = "StructureLabelsGroup";
    this.chestLabelsGroup = new Group();
    this.chestLabelsGroup.name = "ChestLabelsGroup";

    this.armyManager = new ArmyManager(
      this.scene,
      this.renderChunkSize,
      this.worldSpatialProjection,
      this.armyLabelsGroup,
      this,
      this.dojo,
      this.frustumManager,
      this.visibilityManager,
      this.chunkSize,
      this.chunkWorkQueue,
    );
    this.armyManager.setProceduralCollisionMode(renderProfile.mode);
    this.combatPresentation = new CombatPresentationCoordinator(this.scene, {
      projectileHitQuery: {
        hasTarget: (entityId) => this.armyManager.hasProceduralProjectileTarget(entityId),
        sweepSphere: (request) => this.armyManager.sweepProceduralProjectile(request),
      },
    });
    this.bindProceduralCombatPresentation();
    this.arrivalGhostManager = new ArrivalGhostManager(this.scene, {
      chunkStride: this.chunkSize,
      renderChunkSize: this.renderChunkSize,
      terrainSurface: this.getTerrainSurface(),
    });

    installWorldmapDebugHooks(window, {
      getProceduralArmyProductionStats: () => this.armyManager.getProceduralArmyProductionStats(),
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
      this.worldSpatialProjection,
      this.structureLabelsGroup,
      this,
      this.fxManager,
      this.dojo,
      this.frustumManager,
      this.visibilityManager,
      this.chunkSize,
      this.chunkWorkQueue,
    );
    this.reservedHyperstructureManager = new ReservedHyperstructureManager(
      this.scene,
      this.worldSpatialProjection,
      this.getTerrainSurface(),
    );
    this.chestManager = new ChestManager(
      this.scene,
      this.renderChunkSize,
      this.worldSpatialProjection,
      this.chestLabelsGroup,
      this,
      this.chunkSize,
      this.chunkWorkQueue,
    );

    // Bootstrap applyRenderVisualProfile may have run before these managers existed; apply the
    // fixed visual limits now that the managers are available.
    if (this.latestRenderVisualProfile) {
      this.applyWorldmapVisualLimits(this.latestRenderVisualProfile);
    }

    // NOTE: Chunk integration system disabled for performance.
    // The chunk integration adds overhead via lifecycle callbacks on every entity update.
    // Uncomment if you need advanced chunk lifecycle debugging/tracking features.
    // this.initializeChunkIntegration();
  }

  private configureWorldmapRecoveryLifecycle(): void {
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
  }

  private initializeWorldmapSupportManagers(): void {
    this.battleDirectionManager = new BattleDirectionManager(
      (entityId: ID, direction: Direction | undefined, role: "attacker" | "defender") =>
        this.armyManager.updateBattleDirection(entityId, direction, role),
      (entityId: ID, direction: Direction | undefined, role: "attacker" | "defender") =>
        this.structureManager.updateBattleDirection(entityId, direction, role),
      (entityId: ID) => this.getArmyDisplayPosition(entityId) || this.getStructureHexPosition(entityId),
    );

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
      (hexCoords: HexPosition) => this.resolveHoverLabelEntities(hexCoords),
      this.getCurrentCameraView(),
      this.markLabelsDirty,
    );

    this.terrainVisibilityHealthMonitor = new WorldmapTerrainVisibilityHealthMonitor(
      { selfHealEnabled: WORLDMAP_ZOOM_HARDENING.terrainSelfHeal },
      {
        isBoxVisible: (box) => this.visibilityManager.isBoxVisible(box),
        getVisibleCellCount: () => this.proceduralTerrain.getVisibleCellCount(),
        requestChunkRefresh: (force, reason) => this.requestChunkRefresh(force, reason),
        waitForRequestedChunkRefresh: (token) => this.waitForRequestedChunkRefresh(token),
        emitTelemetry: (event, payload) => this.emitZoomHardeningTelemetry(event, payload),
        recordBoundsRecovery: () => recordChunkDiagnosticsEvent(this.chunkDiagnostics, "terrain_bounds_recovery"),
      },
    );

    this.hoverLabelRecovery = new WorldmapHoverLabelRecovery({
      getHoverHex: () => this.currentHoverLabelHex,
      isSwitchedOff: () => this.isSwitchedOff,
      reconcileHexHover: (hex) => this.hoverLabelManager.reconcileHexHover(hex),
    });
  }

  private bindWorldSpatialProjectionLifecycle(): void {
    this.seedWorldBiomeSurface();
    this.seedStrategicMarkers();
    const unsubscribeTiles = this.worldSpatialProjection.subscribeTiles((changes) => {
      this.handleProjectedTileChanges(changes);
    });
    const unsubscribeStructures = this.worldSpatialProjection.subscribeStructures((changes) => {
      this.syncProjectedStructurePathfinding(changes);
      changes.forEach(({ previous, current }) => {
        if (previous?.reserved && !current?.reserved) {
          clearPendingReservedHyperstructureCreation(previous.hexCoords);
        }
      });
      this.reconcileHoverLabelsForProjectionChanges(changes);
      this.scheduleTerrainEcologyRefresh();
      this.syncStructureMarkers(changes);
    });
    const structureEcologySubscription = this.dojo.components.Structure.update$.subscribe(({ value }) => {
      const [current, previous] = value;
      if (
        current?.owner !== previous?.owner ||
        current?.base.category !== previous?.base.category ||
        current?.base.level !== previous?.base.level
      ) {
        this.scheduleTerrainEcologyRefresh();
        if (current) this.refreshStructureMarkersForEntity(current.entity_id);
      }
    });
    const unsubscribeArmies = this.worldSpatialProjection.subscribeArmies((changes) => {
      this.syncProjectedArmyPathfinding(changes);
      this.handleProjectedArmyChanges(changes);
      this.syncArmyMarkers(changes);
    });
    this.unsubscribeWorldSpatialProjection = () => {
      unsubscribeTiles();
      unsubscribeStructures();
      structureEcologySubscription.unsubscribe();
      unsubscribeArmies();
    };
  }

  private handleProjectedTileChanges(changes: readonly TileSpatialProjectionChange[]): void {
    changes.forEach((change) => this.applyProjectedTileChange(change));
    this.commitWorldBiomeSurface();
  }

  /** The far-LOD biome surface paints every explored tile in the world, not just the render window. */
  private seedWorldBiomeSurface(): void {
    this.worldSpatialProjection.getTiles().forEach((tile) => {
      const normalized = new Position({ x: tile.hexCoords.col, y: tile.hexCoords.row }).getNormalized();
      this.worldBiomeSurface.setTile(normalized.x, normalized.y, resolveTileBiomeType(tile.biome));
    });
    this.commitWorldBiomeSurface();
  }

  private syncStructureManagerGauges(): void {
    const metrics = this.structureManager.getStructureManagerMetrics();
    setWorldmapRenderGauge("visibleStructures", this.structureManager.getVisibleCount());
    setWorldmapRenderGauge("structureInfoCacheHits", metrics.structureInfoCacheHits);
    setWorldmapRenderGauge("structureInfoCacheMisses", metrics.structureInfoCacheMisses);
    setWorldmapRenderGauge("visibleStructureBoundsQueries", metrics.visibleStructureBoundsQueries);
    setWorldmapRenderGauge("visibleStructureChangeSetUpdates", metrics.visibleStructureChangeSetUpdates);
    setWorldmapRenderGauge("structureFullRefreshSlices", metrics.fullRefreshSlices);
    setWorldmapRenderGauge("structureFullRefreshMaxSliceMs", metrics.fullRefreshMaxSliceMs);
    setWorldmapRenderGauge("structureHiddenModelGroups", metrics.hiddenModelGroups);
    setWorldmapRenderGauge("structureCompactLabelsShown", metrics.compactLabelsShown);
  }

  /** The far band's subjects: every structure and army in the world, coloured by owner, from the projection. */
  private seedStrategicMarkers(): void {
    this.worldSpatialProjection.getStructures().forEach((structure) => this.writeStructureMarker(structure));
    this.worldSpatialProjection.getArmies().forEach((army) => this.writeArmyMarker(army));
    this.commitStrategicMarkers();
  }

  private syncStructureMarkers(changes: readonly StructureSpatialProjectionChange[]): void {
    changes.forEach(({ previous, current }) => {
      if (current) this.writeStructureMarker(current);
      else if (previous?.entityId !== null && previous?.entityId !== undefined) {
        this.strategicMarkers.removeStructure(previous.entityId);
      }
    });
    this.commitStrategicMarkers();
  }

  private refreshStructureMarkersForEntity(entityId: ID): void {
    const structure = this.worldSpatialProjection.getStructure(entityId);
    if (!structure) return;
    this.writeStructureMarker(structure);
    this.worldSpatialProjection.getArmies().forEach((army) => {
      if (this.getArmyOwnerStructureId(army.entityId) === entityId) this.writeArmyMarker(army);
    });
    this.commitStrategicMarkers();
  }

  private syncArmyMarkers(changes: readonly ArmySpatialProjectionChange[]): void {
    changes.forEach(({ previous, current }) => {
      if (current) this.writeArmyMarker(current);
      else if (previous) this.strategicMarkers.removeArmy(previous.entityId);
    });
    this.commitStrategicMarkers();
  }

  private writeStructureMarker(structure: StructureSpatialRenderable): void {
    if (structure.reserved) return;
    const facts = this.structureManager.getStructureMarkerFacts(structure.entityId);
    if (!facts) return;
    const position = this.resolveMarkerWorldPosition(structure.hexCoords);
    const color = playerColorManager.getProfileForUnit(facts.isMine, facts.isAlly, false, facts.ownerAddress).primary;
    this.strategicMarkers.setStructure(
      structure.entityId,
      resolveStructureMarkerKind(facts.structureType),
      position.x,
      position.z,
      color,
    );
  }

  private writeArmyMarker(army: ArmySpatialRenderable): void {
    const ownerAddress = this.getArmyOwnerAddress(army.entityId);
    const position = this.resolveMarkerWorldPosition(army.hexCoords);
    const isMine = ownerAddress !== undefined && isAddressEqualToAccount(ownerAddress);
    const color = playerColorManager.getProfileForUnit(isMine, false, false, ownerAddress).primary;
    this.strategicMarkers.setArmy(
      army.entityId,
      army.troopTier as StrategicArmyMarkerTier,
      position.x,
      position.z,
      color,
    );
  }

  private resolveMarkerWorldPosition(hexCoords: WorldSpatialHex): Vector3 {
    const normalized = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();
    return getWorldPositionForHex({ col: normalized.x, row: normalized.y });
  }

  private commitStrategicMarkers(): void {
    this.strategicMarkers.commit();
    setWorldmapRenderGauge("strategicStructureMarkers", this.strategicMarkers.metrics.structures);
    setWorldmapRenderGauge("strategicArmyMarkers", this.strategicMarkers.metrics.armies);
  }

  private commitWorldBiomeSurface(): void {
    const uploadedBefore = this.worldBiomeSurface.metrics.uploadedInstances;
    this.worldBiomeSurface.commit();
    const uploaded = this.worldBiomeSurface.metrics.uploadedInstances - uploadedBefore;
    if (uploaded === 0) {
      return;
    }
    incrementWorldmapRenderCounter("worldBiomeSurfaceCommits");
    incrementWorldmapRenderCounter("worldBiomeSurfaceInstancesUploaded", uploaded);
    setWorldmapRenderGauge("worldBiomeSurfaceInstances", this.worldBiomeSurface.metrics.instanceCount);
  }

  private applyProjectedTileChange({ previous, current }: TileSpatialProjectionChange): void {
    const tile = current ?? previous;
    if (!tile) {
      return;
    }

    if (current) this.completePendingExploreEffects(current.hexCoords);

    const normalized = new Position({ x: tile.hexCoords.col, y: tile.hexCoords.row }).getNormalized();
    this.worldBiomeSurface.setTile(normalized.x, normalized.y, current ? resolveTileBiomeType(current.biome) : null);
    if (!this.isHexInRetainedRenderArea(normalized.x, normalized.y)) {
      return;
    }

    const terrainPageRebuild = this.applyProjectedExploredTileChange(normalized.x, normalized.y, current);
    if (current) this.recordExploreRevealAfterRender(current.hexCoords, terrainPageRebuild);
  }

  private applyProjectedExploredTileChange(
    col: number,
    row: number,
    current: TileSpatialProjectionChange["current"],
  ): Promise<void> {
    if (current) {
      return this.writeExploredTileFromProjection(col, row, resolveTileBiomeType(current.biome));
    }

    const rows = this.exploredTiles.get(col);
    rows?.delete(row);
    if (rows?.size === 0) {
      this.exploredTiles.delete(col);
    }
    this.bumpTerrainGenerationForHex(col, row);
    gameWorkerManager.updateExploredTile(col, row, null);
    this.invalidateAllChunkCachesContainingHex(col, row);
    return this.invalidateVisualTerrainPageForLiveTile(col, row);
  }

  private syncProjectedArmyPathfinding(changes: readonly ArmySpatialProjectionChange[]): void {
    changes.forEach(({ previous, current }) => {
      if (previous) {
        const previousHex = new Position({ x: previous.hexCoords.col, y: previous.hexCoords.row }).getNormalized();
        const stayedAtPreviousHex =
          current?.hexCoords.col === previous.hexCoords.col && current.hexCoords.row === previous.hexCoords.row;
        if (!stayedAtPreviousHex && this.isHexInRetainedRenderArea(previousHex.x, previousHex.y)) {
          gameWorkerManager.updateArmyHex(previousHex.x, previousHex.y, null);
        }
      }

      if (current) {
        const currentHex = new Position({ x: current.hexCoords.col, y: current.hexCoords.row }).getNormalized();
        if (this.isHexInRetainedRenderArea(currentHex.x, currentHex.y)) {
          gameWorkerManager.updateArmyHex(currentHex.x, currentHex.y, {
            id: current.entityId,
            owner: this.getArmyOwnerAddress(current.entityId) ?? 0n,
          });
        }
      }
    });
  }

  private handleProjectedArmyChanges(changes: readonly ArmySpatialProjectionChange[]): void {
    changes.forEach(({ entityId, current }) => {
      if (!current) {
        this.disposePendingMovementVisualLifecycle(entityId);
        this.arrivalGhostManager.clearArrivalGhost(entityId, "army_removed");
        this.battleDirectionManager.removeEntityFromTracking(entityId);
        return;
      }

      this.recalculateArrowsForEntity(entityId);
      this.recalculateArrowsForEntitiesRelatedTo(entityId);
    });
    this.reconcileHoverLabelsForProjectionChanges(changes);
  }

  /** Data batches only re-resolve the hover when they touch the hovered hex; pointer moves do the rest. */
  private reconcileHoverLabelsForProjectionChanges(
    changes: ReadonlyArray<{ previous?: { hexCoords: WorldSpatialHex }; current?: { hexCoords: WorldSpatialHex } }>,
  ): void {
    const hovered = this.currentHoverLabelHex;
    if (!hovered) return;
    const contract = new Position({ x: hovered.col, y: hovered.row }).getContract();
    const touchesHoveredHex = changes.some(
      ({ previous, current }) =>
        isSameWorldSpatialHex(previous?.hexCoords, contract) || isSameWorldSpatialHex(current?.hexCoords, contract),
    );
    if (touchesHoveredHex) this.reconcileHoverLabels();
  }

  private syncProjectedStructurePathfinding(changes: readonly StructureSpatialProjectionChange[]): void {
    changes.forEach(({ previous, current }) => {
      if (previous && !previous.reserved) {
        const previousHex = new Position({ x: previous.hexCoords.col, y: previous.hexCoords.row }).getNormalized();
        const currentStayedAtPreviousHex =
          current?.hexCoords.col === previous.hexCoords.col && current.hexCoords.row === previous.hexCoords.row;
        if (!currentStayedAtPreviousHex && this.isHexInRetainedRenderArea(previousHex.x, previousHex.y)) {
          gameWorkerManager.updateStructureHex(previousHex.x, previousHex.y, null);
        }
      }

      if (current && !current.reserved) {
        const currentHex = new Position({ x: current.hexCoords.col, y: current.hexCoords.row }).getNormalized();
        if (this.isHexInRetainedRenderArea(currentHex.x, currentHex.y)) {
          gameWorkerManager.updateStructureHex(currentHex.x, currentHex.y, {
            id: current.entityId,
            owner: this.getStructureOwnerAddress(current.entityId) ?? 0n,
          });
        }
      }
    });
  }

  private bindWorldmapCameraViewLifecycle(): void {
    this.addCameraViewListener((view: CameraView) => {
      runWithFrameWorkOwner("zoom:interaction-overlays", () => {
        this.hoverLabelManager.updateCameraView(view);
        this.highlightHexManager.setCameraView(view);
        this.interactiveHexManager.setCameraView(view);
      });
      runWithFrameWorkOwner("zoom:worldmap-shadows", () => {
        this.configureWorldmapShadows();
      });
      runWithFrameWorkOwner("zoom:content-ladder", () => {
        this.applyContentLadder(resolveWorldmapContentLadder(view));
      });
    });
  }

  /** The band table decides what the scene shows; managers apply their own rows from the same table. */
  private applyContentLadder(ladder: WorldmapContentLadder): void {
    setWorldmapRenderGauge("contentBand", ladder.band);
    // The whole-world biome surface underlies every band; the far band shows it alone, nearer bands composite the pages over it.
    this.worldBiomeSurface.setVisible(ladder.biomeUnderlay);
    this.proceduralTerrain.object3d.visible = ladder.band !== CameraView.Far;
    this.fxManager.setVisible(ladder.fx);
    this.resourceFXManager.setVisible(ladder.fx);
    this.combatPresentation?.setVisible(ladder.fx);
    this.arrivalGhostManager.setSuspended(!ladder.fx);
    this.reservedHyperstructureManager.setModelVisible(ladder.structureModels);
    this.strategicMarkers.setVisible(ladder.band === CameraView.Far);
    this.commitStrategicMarkers();
    this.refreshLabelPriorityContext();
    this.syncStructureManagerGauges();
  }

  private refreshLabelPriorityContext(): void {
    const context = this.buildLabelPriorityContext();
    this.armyManager.setLabelPriorityContext(context);
    this.structureManager.setLabelPriorityContext(context);
  }

  private buildLabelPriorityContext(): WorldmapLabelPriorityContext {
    const hovered = this.currentHoverLabelHex ? this.getHexagonEntity(this.currentHoverLabelHex) : undefined;
    const selectedEntityId = getLiveWorldmapEntityActions().selectedEntityId;
    return {
      isSpectator: isExplicitSpectateSession(),
      topOwnerAddresses: this.resolveTopOwnerAddresses(),
      selectedEntityId: selectedEntityId === undefined || selectedEntityId === null ? null : Number(selectedEntityId),
      hoveredEntityId: hovered?.army?.id ?? hovered?.structure?.id ?? null,
    };
  }

  /** Top-10 by the live leaderboard; recomputed only when a label-priority refresh asks for it. */
  private resolveTopOwnerAddresses(): ReadonlySet<string> {
    const leaderboard = LeaderboardManager.instance(this.dojo.components);
    leaderboard.updatePoints();
    const top = new Set<string>();
    leaderboard.playersByRank.slice(0, TOP_OWNER_LABEL_COUNT).forEach(([address]: [bigint, number]) => {
      const key = normalizeOwnerAddress(address);
      if (key) top.add(key);
    });
    return top;
  }

  private registerWorldUpdateSubscriptions(): void {
    // Idempotence guard: a non-empty unsubscribe list means the listeners are live
    // (dispose empties it), so a redundant call must not double-subscribe.
    if (this.worldUpdateUnsubscribes.length > 0) {
      return;
    }
    this.registerBattleWorldUpdateSubscriptions();
    this.registerExplorerRewardWorldUpdateSubscriptions();
  }

  private registerBattleWorldUpdateSubscriptions(): void {
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.BattleEvent.onBattleUpdate((update: BattleEventSystemUpdate) => {
        this.replayIndexedCombat(update);
        const { attackerId, defenderId } = update.battleData;
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
              ? (this.getArmyDisplayPosition(attackerId) ?? this.getStructureHexPosition(attackerId))
              : undefined;
          const defenderPosition =
            defenderId !== undefined
              ? (this.getArmyDisplayPosition(defenderId) ?? this.getStructureHexPosition(defenderId))
              : undefined;
          const targetPosition = defenderPosition ?? attackerPosition;

          if (targetPosition) {
            this.focusCameraOnEvent(targetPosition.col, targetPosition.row, "Following Army Combat");
          }
        }

        this.notifyArmyUnderAttack(update);
      }),
    );
  }

  private registerExplorerRewardWorldUpdateSubscriptions(): void {
    this.addWorldUpdateSubscription(
      this.worldUpdateListener.ExplorerReward.onExplorerRewardEventUpdate((update: ExplorerRewardSystemUpdate) => {
        this.handleExplorerRewardEvent(update);
      }),
    );
  }

  private initializeWorldmapInteractionRuntime(): void {
    this.selectedHexManager = new SelectedHexManager(this.scene, this.getTerrainSurface());
    this.interactionAdapter = createWorldmapInteractionAdapter({
      state: this.state,
      selectedHexManager: this.selectedHexManager,
      dojoComponents: this.dojo.components,
    });
    this.selectionPulseManager = new SelectionPulseManager(this.scene, this.getTerrainSurface());
    this.ownershipPulsePresenter = new WorldmapOwnershipPulsePresenter({
      clearOwnershipPulses: () => this.selectionPulseManager.clearOwnershipPulses(),
      showOwnershipPulses: (positions, baseColor, pulseColor) =>
        this.selectionPulseManager.showOwnershipPulses(positions, baseColor, pulseColor),
      getStructureHex: (structureId) => this.getStructureHexPosition(structureId),
      getOwnedArmyHexes: (structureId) =>
        this.worldSpatialProjection
          .getArmies()
          .filter(({ entityId }) => this.getArmyOwnerStructureId(entityId) === structureId)
          .map(({ entityId }) => this.getArmyDisplayPosition(entityId)),
    });
    this.interactiveHexManager.applyHoverPalette(resolveHoverVisualPalette({ hasSelection: false }));
    this.interactiveHexManager.setSurfaceVisibility(false);
    this.interactiveHexManager.setHoverVisualMode("outline");
  }

  private bindWorldmapSceneUiLifecycle(): void {
    // Legacy canvas minimap has been replaced by the React minimap (BottomRightPanel/HexMinimap).
    // We keep only the "minimapCameraMove" event bridge + cameraTargetHex updates for the UI.
    this.updateCameraTargetHexThrottled = throttle(this.updateCameraTargetHex, this.cameraTargetHexUpdateIntervalMs);
    this.refreshVisualTerrainWindowThrottled = throttle(() => {
      void this.refreshVisualTerrainWindowFromCamera();
    }, WORLDMAP_CHUNK_POLICY.visualPresentation.cameraSampleThrottleMs);
    this.minimapCameraMoveThrottled = throttle(() => {
      const target = this.minimapCameraMoveTarget;
      if (!target) {
        return;
      }
      this.moveCameraToColRow(target.col, target.row, 0.25);
    }, 16);

    window.addEventListener("minimapCameraMove", this.minimapCameraMoveHandler as EventListener);
    window.addEventListener("minimapZoom", this.minimapZoomHandler as EventListener);
    this.controls.addEventListener("change", this.handleWorldmapControlsChange);
    this.updateCameraTargetHexThrottled();
    this.refreshVisualTerrainWindowThrottled();
  }

  private registerWorldmapShortcuts(): void {
    this.shortcutManager = new SceneShortcutManager("worldmap", this.sceneManager);
    if (this.shortcutManager.hasShortcuts()) {
      return;
    }

    const shouldCycleStructuresForTab = () => useUIStore.getState().leftNavigationView === LeftView.MilitaryView;
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
        return this.hasEligibleArmyForTabCycle();
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

  private setupCameraZoomHandler() {
    this.detachWorldmapWheelHandler();
    this.wheelHandler = (event: WheelEvent) => {
      const normalizedWheelDelta = normalizeWorldmapWheelDelta({
        delta: event.deltaY,
        deltaMode: event.deltaMode,
        viewportHeight: window.innerHeight,
      });
      const normalizedHorizontalDelta = Math.abs(
        resolveWorldmapWheelPixelDelta({
          delta: event.deltaX,
          deltaMode: event.deltaMode,
          viewportHeight: window.innerHeight,
        }),
      );
      const mostlyVertical = Math.abs(normalizedWheelDelta.normalizedDelta) >= normalizedHorizontalDelta;

      if (!normalizedWheelDelta.direction || !mostlyVertical) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.applyWorldmapZoomIntent({ type: "continuous_delta", delta: normalizedWheelDelta.normalizedDelta });
    };

    this.attachWorldmapWheelHandler();
  }

  private attachWorldmapWheelHandler(): void {
    if (!this.wheelHandler) {
      return;
    }

    const canvas = this.controls.domElement;
    if (!(canvas instanceof HTMLElement)) {
      return;
    }

    canvas.addEventListener("wheel", this.wheelHandler, { passive: false });
    this.wheelEventTarget = canvas;
  }

  private detachWorldmapWheelHandler(): void {
    if (this.wheelEventTarget && this.wheelHandler) {
      this.wheelEventTarget.removeEventListener("wheel", this.wheelHandler);
    }

    this.wheelEventTarget = null;
  }

  private applyDirectionalZoomIntent(zoomOut: boolean) {
    const delta = zoomOut ? MINIMAP_ZOOM_STEP_DELTA : -MINIMAP_ZOOM_STEP_DELTA;
    this.applyWorldmapZoomIntent({ type: "continuous_delta", delta });
  }

  private applyWorldmapZoomIntent(intent: ZoomIntent): void {
    this.publishWorldmapZoomSnapshot(this.zoomCoordinator.applyIntent(intent));
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
    // castShadow must not flip with the camera view: toggling the light's
    // topology rebuilds every material's shader graph (the multi-second zoom
    // freeze). The visual profile pins topology; the per-view part is the intensity
    // uniform. Per-mesh castShadow flags already empty the Far shadow pass.
    this.mainDirectionalLight.castShadow = this.getShadowsEnabled();
    this.setMainDirectionalShadowActive(
      shouldCastWorldmapDirectionalShadow(this.getShadowsEnabled(), this.getCurrentCameraView() === CameraView.Far),
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
      this.recordZoomTransition(nextTransitionStatus, snapshot.actualDistance);
      this.worldmapCameraTransitionListeners.forEach((listener) => listener(nextTransitionStatus));
    }
  }

  private recordZoomTransition(status: WorldmapCameraTransitionStatus, settledDistance: number): void {
    if (status === "transitioning") {
      incrementWorldmapRenderCounter("zoomTransitionsStarted");
      return;
    }
    incrementWorldmapRenderCounter("zoomTransitionsCompleted");
    this.persistSettledWorldmapZoom(settledDistance);
  }

  private persistSettledWorldmapZoom(distance: number): void {
    const settled = Math.round(distance * 100) / 100;
    const stored = useCameraZoomStore.getState().worldmapDistance;
    if (stored !== null && Math.abs(stored - settled) < 0.05) {
      return;
    }
    useCameraZoomStore.getState().setWorldmapDistance(settled);
  }

  public moveCameraToURLLocation(options: WorldmapUrlLocationMoveOptions = {}): void {
    const shouldRequestRefresh = this.resolveURLLocationRefreshRequest(options);
    const routeWorldPosition = resolvePlayRouteWorldPosition(window.location);
    if (routeWorldPosition) {
      this.moveCameraToRouteWorldPosition(routeWorldPosition);
      this.requestURLLocationRefreshIfNeeded(shouldRequestRefresh);
    }
    if (!this.hasInitialized) {
      this.alignInitialWorldmapCameraView();
    }
  }

  private moveCameraToRouteWorldPosition(routeWorldPosition: HexPosition): void {
    const { col, row } = routeWorldPosition;
    this.moveCameraToColRow(col, row, 0);
  }

  private requestURLLocationRefreshIfNeeded(shouldRequestRefresh: boolean): void {
    if (!shouldRequestRefresh) {
      return;
    }

    this.requestChunkRefresh(true, "default");
  }

  private resolveURLLocationRefreshRequest(options: WorldmapUrlLocationMoveOptions): boolean {
    if (options.requestRefresh === false) {
      return false;
    }

    return !this.consumeInitialSetupUrlRefreshSkip();
  }

  private consumeInitialSetupUrlRefreshSkip(): boolean {
    const shouldSkipRefresh = this.skipNextInitialSetupUrlRefresh;
    this.skipNextInitialSetupUrlRefresh = false;
    return shouldSkipRefresh;
  }

  private alignInitialWorldmapCameraView(): void {
    this.alignWorldmapCameraToDistance(this.resolvePreferredWorldmapCameraDistance());
  }

  /** Player-persisted zoom distance, falling back to the scene's default. */
  private resolvePreferredWorldmapCameraDistance(): number {
    const range = { min: WORLDMAP_CAMERA_ZOOM.minDistance, max: WORLDMAP_CAMERA_ZOOM.maxDistance };
    return resolveStoredWorldmapCameraDistance(range) ?? WORLDMAP_CAMERA_ZOOM.defaultDistance;
  }

  private alignWorldmapCameraToDistance(distance: number): void {
    this.placeWorldmapCameraAtDistance(distance);
    this.zoomCoordinator.syncToDistance(distance, performance.now());
    this.lastControlsCameraDistance = this.getCurrentCameraDistance();
    this.publishWorldmapZoomSnapshot(this.zoomCoordinator.getSnapshot());
    // Camera state is state, not an event: entry and resume publish it now, not on the next throttled change.
    this.updateCameraTargetHex();
  }

  /** Places the camera on the worldmap's fixed azimuth at `distance`, pitched per the zoom profile. */
  private placeWorldmapCameraAtDistance(distance: number): void {
    const pitch = resolveWorldmapCameraPitchRadians(distance);
    this.cameraAngle = pitch;
    this.strategicMarkers.setViewPitch(pitch);
    this.controls.object.position.set(
      this.controls.target.x,
      this.controls.target.y + Math.sin(pitch) * distance,
      this.controls.target.z + Math.cos(pitch) * distance,
    );
    this.notifyControlsChanged();
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
    if (this.worldSpatialProjection.getArmy(entityId)) return this.getArmyOwnerAddress(entityId);

    return this.getStructureOwnerAddress(entityId);
  }

  private getArmyOwnerAddress(entityId: ID): ContractAddress | undefined {
    const explorer = getComponentValue(this.dojo.components.ExplorerTroops, gameEntityKey([BigInt(entityId)]));
    if (!explorer || explorer.owner === 0) return undefined;
    return this.getStructureOwnerAddress(explorer.owner);
  }

  private getArmyOwnerStructureId(entityId: ID): ID | null {
    const explorer = getComponentValue(this.dojo.components.ExplorerTroops, gameEntityKey([BigInt(entityId)]));
    return explorer?.owner && explorer.owner !== 0 ? explorer.owner : null;
  }

  private getArmyDisplayPosition(entityId: ID): HexPosition | undefined {
    const army = this.worldSpatialProjection.getArmy(entityId);
    if (!army) return undefined;
    const normalized = new Position({ x: army.hexCoords.col, y: army.hexCoords.row }).getNormalized();
    return { col: normalized.x, row: normalized.y };
  }

  private getArmyAtHex(hexCoords: HexPosition): HexEntityInfo | undefined {
    const contract = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
    const renderable = this.worldSpatialProjection
      .getArmiesAtHex({ col: contract.x, row: contract.y })
      .find(({ entityId }) => {
        const pendingPosition = this.getArmyDisplayPosition(entityId);
        return pendingPosition?.col === hexCoords.col && pendingPosition.row === hexCoords.row;
      });
    return renderable
      ? { id: renderable.entityId, owner: this.getArmyOwnerAddress(renderable.entityId) ?? 0n }
      : undefined;
  }

  private resolveContractHexKey(hexCoords: HexPosition): string {
    const contract = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
    return `${contract.x},${contract.y}`;
  }

  private getStructureOwnerAddress(entityId: ID): ContractAddress | undefined {
    const structure = getComponentValue(this.dojo.components.Structure, gameEntityKey([BigInt(entityId)]));
    return structure ? ContractAddress(structure.owner) : undefined;
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
      const armyPosition = this.getArmyDisplayPosition(explorerId);
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
    if (this.worldSpatialProjection.getArmy(entityId)) {
      return `Army #${entityId}`;
    }
    if (this.worldSpatialProjection.getStructure(entityId)) {
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

    const focusPosition = this.getArmyDisplayPosition(defenderId) ?? this.getStructureHexPosition(defenderId);

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
    const nextHexCoords = hex?.hexCoords ?? null;
    const hoverPalette = this.resolveContextualHoverPalette(nextHexCoords);
    const nextHoverReconciliation: WorldmapHoverReconciliationSnapshot = {
      hex: nextHexCoords ? { col: nextHexCoords.col, row: nextHexCoords.row } : null,
      palette: hoverPalette,
    };
    if (!shouldReconcileWorldmapHover(this.lastHoverReconciliation, nextHoverReconciliation)) {
      return;
    }
    this.lastHoverReconciliation = nextHoverReconciliation;

    if (hex === null) {
      if (this.previouslyHoveredHex) {
        this.traceChunk("mouse_chunk_leave", {
          previousHoveredHex: this.previouslyHoveredHex,
          previousHoveredChunkKey: this.resolveChunkKeyForHexPosition(this.previouslyHoveredHex),
        });
      }
      this.previouslyHoveredHex = null;
      this.state.updateEntityActionHoveredHex(null);
      this.state.setHoveredHex(null);
      this.interactiveHexManager.applyHoverPalette(hoverPalette);

      // Reset cursor when leaving hex
      document.body.style.cursor = "default";

      // Handle label collapse on hex leave
      this.currentHoverLabelHex = null;
      this.clearPendingHoverLabelRecovery("hex_leave");
      this.hoverLabelManager.onHexLeave();
      this.refreshLabelPriorityContext();
      return;
    }
    const { hexCoords } = hex;
    const hoveredChunkKey = this.resolveChunkKeyForHexPosition(hexCoords);
    if (this.previouslyHoveredHex?.col !== hexCoords.col || this.previouslyHoveredHex?.row !== hexCoords.row) {
      this.traceChunk("mouse_chunk_enter", {
        hoveredHex: hexCoords,
        hoveredChunkKey,
      });
    }
    this.previouslyHoveredHex = hexCoords;

    // Handle label expansion on hover
    this.currentHoverLabelHex = hexCoords;
    this.reconcileHoverLabels("hover");
    this.refreshLabelPriorityContext();

    const { selectedEntityId, actionPaths } = getLiveWorldmapEntityActions();
    // Entity IDs can be valid falsy values (for example 0), so nullish checks
    // are required to distinguish "no selection" from a real selected entity.
    if (selectedEntityId !== null && selectedEntityId !== undefined && actionPaths.size > 0) {
      this.state.updateEntityActionHoveredHex(hexCoords);
    }

    this.interactiveHexManager.applyHoverPalette(hoverPalette);
  }

  // double-click reserved hyperstructure tiles to materialize them; otherwise enter the real structure
  protected onHexagonDoubleClick(hexCoords: HexPosition) {
    if (this.isReservedHyperstructureHex(hexCoords)) {
      void this.createReservedHyperstructureFromWorldmap(hexCoords);
      return;
    }

    this.enterStructureFromSelectedHex(hexCoords);
  }

  private enterStructureFromSelectedHex(hexCoords: HexPosition) {
    const { structure } = this.getHexagonEntity(hexCoords);
    if (!structure) {
      return;
    }

    void this.enterStructureFromWorldmap(structure, hexCoords);
  }

  private async createReservedHyperstructureFromWorldmap(hexCoords: HexPosition): Promise<void> {
    if (isPendingReservedHyperstructureCreation(hexCoords)) {
      return;
    }

    const account = useAccountStore.getState().account;
    if (!account) {
      toast.error("Wait for your gameplay account before creating a Hyperstructure.");
      return;
    }

    try {
      const didSubmit = await submitActiveWorldBlitzHyperstructureCreation({
        account,
        hexCoords,
      });

      if (!didSubmit) {
        return;
      }

      toast.success("Creating Hyperstructure...");
    } catch (error) {
      console.error("[Worldmap] Failed to create reserved hyperstructure", error);
      toast.error("Unable to create this Hyperstructure right now.");
    }
  }

  private isReservedHyperstructureHex(hexCoords: HexPosition): boolean {
    const contractPosition = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
    return this.worldSpatialProjection
      .getStructuresAtHex({ col: contractPosition.x, row: contractPosition.y })
      .some((structure) => structure.reserved);
  }

  private async enterStructureFromWorldmap(structure: HexEntityInfo, hexCoords: HexPosition) {
    const accountAddress = ContractAddress(useAccountStore.getState().account?.address || "");
    const isMine = structure.owner === accountAddress;

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
    const position = new Position({ x: hexCoords.col, y: hexCoords.row });
    const hex = position.getNormalized();
    const contractHex = position.getContract();
    const army = this.getArmyAtHex({ col: hex.x, row: hex.y });
    const projectedStructure = this.worldSpatialProjection
      .getStructuresAtHex({ col: contractHex.x, row: contractHex.y })
      .find((candidate) => !candidate.reserved);
    const structure = projectedStructure
      ? { id: projectedStructure.entityId, owner: this.getStructureOwnerAddress(projectedStructure.entityId) ?? 0n }
      : undefined;
    const projectedChest = this.worldSpatialProjection.getChestsAtHex({
      col: contractHex.x,
      row: contractHex.y,
    })[0];
    const chest = projectedChest ? { id: projectedChest.entityId, owner: 0n } : undefined;

    return { army, structure, chest };
  }

  private resolveHoverLabelEntities(hexCoords: HexPosition) {
    const cachedEntities = this.getHexagonEntity(hexCoords);
    const managerEntities = this.resolveManagerHoverLabelEntities(hexCoords, cachedEntities);
    const targets = resolveWorldmapHoverLabelTargets({
      cachedEntities,
      hoveredHex: hexCoords,
      managerEntities,
      raycastArmy: cachedEntities.army ? undefined : this.resolveRaycastArmyHoverTarget(),
    });

    return {
      army: resolveWorldmapHoverLabelEntity(targets.armyId, cachedEntities.army),
      structure: resolveWorldmapHoverLabelEntity(targets.structureId, cachedEntities.structure),
      chest: resolveWorldmapHoverLabelEntity(targets.chestId, cachedEntities.chest),
    };
  }

  private resolveManagerHoverLabelEntities(
    hexCoords: HexPosition,
    cachedEntities: { army?: HexEntityInfo; structure?: HexEntityInfo; chest?: HexEntityInfo },
  ) {
    return {
      army: cachedEntities.army ? undefined : this.resolveArmyHoverLabelEntityFromManager(hexCoords),
      structure: cachedEntities.structure ? undefined : this.resolveStructureHoverLabelEntityFromManager(hexCoords),
    };
  }

  private resolveArmyHoverLabelEntityFromManager(hexCoords: HexPosition): HexEntityInfo | undefined {
    const army = this.armyManager.getArmies().find((candidate) => {
      const normalized = candidate.hexCoords.getNormalized();
      return normalized.x === hexCoords.col && normalized.y === hexCoords.row;
    });

    return army ? { id: army.entityId, owner: army.owner.address ?? 0n } : undefined;
  }

  private resolveStructureHoverLabelEntityFromManager(hexCoords: HexPosition): HexEntityInfo | undefined {
    const structure = this.structureManager.getStructureByHexCoords(hexCoords);
    return structure ? { id: structure.entityId, owner: structure.owner.address } : undefined;
  }

  private resolveRaycastArmyHoverTarget() {
    const entityId = this.armyManager.onMouseMove(this.hoverLabelRaycaster);
    if (entityId === undefined) {
      return undefined;
    }

    return {
      entityId,
      position: this.getArmyDisplayPosition(entityId),
    };
  }

  private reconcileHoverLabels(reason: HoverLabelRecoveryReason = "hover"): HoverLabelReconcileResult | null {
    return this.hoverLabelRecovery.reconcile(reason);
  }

  private retryPendingHoverLabelRecovery(reason: HoverLabelRecoveryReason): void {
    this.hoverLabelRecovery.retry(reason);
  }

  private runPendingHoverLabelRecoveryFrame(): void {
    this.hoverLabelRecovery.runFrame();
  }

  private clearPendingHoverLabelRecovery(reason: string): void {
    this.hoverLabelRecovery.clear(reason);
  }

  protected tryArmyRaycastFallback(raycaster: Raycaster): HexPosition | null {
    if (!this.armyManager) return null;
    const entityId = this.armyManager.onMouseMove(raycaster);
    if (entityId === undefined) return null;
    const position = this.getArmyDisplayPosition(entityId);
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
    const accountAddress = ContractAddress(useAccountStore.getState().account?.address || "");
    const { army, structure, chest } = hexCoords
      ? this.getHexagonEntity(hexCoords)
      : { army: undefined, structure: undefined, chest: undefined };
    const clickPlan = resolveWorldmapHexClickPlan({
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
      verboseLog("[Worldmap] Structure entity id clicked:", structure.id);
    }

    this.handleHexSelection(hexCoords, clickPlan.isMine);

    if (clickPlan.selection.type === "army") {
      this.onArmySelection(clickPlan.selection.entityId, accountAddress);
      this.logInteractionDebug("army_selected_via_left_click", {
        entityId: clickPlan.selection.entityId,
        hexCoords,
        ...this.getInteractionDebugSnapshot(),
      });
      return;
    }

    if (clickPlan.selection.type === "structure") {
      this.onStructureSelection(clickPlan.selection.entityId, hexCoords);
      this.logInteractionDebug("structure_selected_via_left_click", {
        entityId: clickPlan.selection.entityId,
        hexCoords,
        ...this.getInteractionDebugSnapshot(),
      });
      return;
    }

    this.logInteractionDebug("non_action_selection_cleared_via_left_click", {
      hexCoords,
      selectionType: clickPlan.selection.type,
      ...this.getInteractionDebugSnapshot(),
    });
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
    // Check if account exists before allowing actions
    const account = useAccountStore.getState().account;

    if (!hexCoords) {
      return;
    }

    const { structure } = this.getHexagonEntity(hexCoords);
    const { selectedEntityId, actionPaths } = getLiveWorldmapEntityActions();
    const hasActiveEntityAction = selectedEntityId !== null && selectedEntityId !== undefined && actionPaths.size > 0;
    const clickedHexKey = ActionPaths.posKey(hexCoords, true);

    this.logInteractionDebug("right_click_received", {
      hexCoords,
      clickedHexKey,
      hasAccount: Boolean(account),
      isMineStructure: structure?.owner !== undefined ? isAddressEqualToAccount(structure.owner) : false,
      ...this.getInteractionDebugSnapshot(),
    });

    const isMineStructure = structure?.owner !== undefined ? isAddressEqualToAccount(structure.owner) : false;

    if (structure && isMineStructure && !hasActiveEntityAction) {
      this.logInteractionDebug("opening_owned_structure_context_menu", {
        structureId: structure.id,
        hexCoords,
        ...this.getInteractionDebugSnapshot(),
      });
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
        clickedHexKey,
        actionPaths,
        actionPathsTransitionToken: this.actionPathsTransitionToken,
        latestTransitionToken: this.chunkTransitionToken,
      });

      if (actionPathLookup.shouldClearStaleSelection) {
        this.logInteractionDebug("clearing_stale_selection_after_right_click", {
          hexCoords,
          clickedHexKey,
          ...this.getInteractionDebugSnapshot(),
        });
        this.clearEntitySelection();
        return;
      }

      if (actionPathLookup.actionPath && account) {
        const actionPath = actionPathLookup.actionPath;
        const actionType = ActionPaths.getActionType(actionPath);

        // Only validate army availability for army-specific actions
        const armyActions = [ActionType.Explore, ActionType.Move, ActionType.Attack, ActionType.SpireTravel];
        const isArmySelection = this.worldSpatialProjection.getArmy(selectedEntityId) !== undefined;
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
        } else if (actionType === ActionType.SpireTravel) {
          this.onArmySpireTravel(actionPath, selectedEntityId);
        } else if (actionType === ActionType.Help) {
          this.onArmyHelp(actionPath, selectedEntityId);
        } else if (actionType === ActionType.Chest) {
          this.onChestSelection(actionPath, selectedEntityId);
        } else if (actionType === ActionType.CreateArmy) {
          this.onArmyCreate(actionPath, selectedEntityId);
        }
        this.logInteractionDebug("action_executed_from_right_click", {
          ...this.getInteractionDebugSnapshot(),
          actionType,
          selectedEntityId,
          clickedHexKey,
          actionPathLength: actionPath.length,
        });
        return;
      }

      this.logInteractionDebug("no_action_path_resolved_for_right_click", {
        hexCoords,
        clickedHexKey,
        hasAccount: Boolean(account),
        actionPathFound: Boolean(actionPathLookup.actionPath),
        ...this.getInteractionDebugSnapshot(),
      });
    }
  }

  private onArmyMovement(account: Account | AccountInterface, actionPath: ActionPath[], selectedEntityId: ID) {
    if (actionPath.length > 0 && this.isArmyMovementInputLocked(selectedEntityId)) {
      toast.info("Army movement is still resolving");
      this.state.updateEntityActionHoveredHex(null);
      this.clearMovementActionOptionsForSelectedArmy(selectedEntityId);
      return;
    }

    const actionType = ActionPaths.getActionType(actionPath);
    const currentArmiesTick = getBlockTimestamp().currentArmiesTick;
    const movementStamina = this.resolveMovementStaminaForAction({
      entityId: selectedEntityId,
      actionPath,
      currentArmiesTick,
    });

    if (actionPath.length > 0 && !movementStamina.canAfford) {
      this.logBlockedMovementStamina({
        entityId: selectedEntityId,
        actionType,
        actionPath,
        movementStamina,
      });
      toast.error("Not enough stamina for this move");
      this.state.updateEntityActionHoveredHex(null);
      this.clearSelection();
      return;
    }

    const isTravelAction = actionType === ActionType.Move || actionType === ActionType.SpireTravel;
    if (actionPath.length > 0) {
      const armyActionManager = new ArmyActionManager(this.dojo.components, this.dojo.systemCalls, selectedEntityId);
      const selectedArmy = this.armyManager.getArmy(selectedEntityId);
      playUnitCommandSoundForWorldmapAction(actionType);

      // Get the target position for the effect
      const targetHex = actionPath[actionPath.length - 1].hex;
      const exploreLatencyActionId =
        actionType === ActionType.Explore
          ? beginClientActionLatency({
              operation: "explore_reveal",
              surface: "worldmap",
              entityId: selectedEntityId,
              targetHex: { col: targetHex.col, row: targetHex.row },
            })
          : null;
      const position = getWorldPositionForHex({
        col: targetHex.col - FELT_CENTER(),
        row: targetHex.row - FELT_CENTER(),
      });

      // Play effect based on action type: compass for exploring, travel for moving
      const key = this.resolveContractHexKey(targetHex);
      if (exploreLatencyActionId) {
        this.pendingExploreLatencyActions.set(selectedEntityId, { actionId: exploreLatencyActionId, targetKey: key });
      }
      const effectType = isTravelAction ? "travel" : "compass";
      const effectLabel = isTravelAction ? "Traveling" : "Exploring";
      let cleanup = () => {};
      const shouldPlayMovementFx = shouldPlayArmyMovementFx({
        capabilities: snapshotRendererFxCapabilities(),
        movementType: isTravelAction ? "travel" : "explore",
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
        let unsubscribeFromMovementComplete: (() => void) | undefined;
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
          unsubscribeFromMovementComplete?.();
          unsubscribeFromMovementComplete = undefined;

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
        if (effectType === "travel") {
          unsubscribeFromMovementComplete = this.armyManager.onMovementComplete(selectedEntityId, cleanup);
        }

        this.travelEffectsByEntity.set(selectedEntityId, { key, cleanup, effectType });
        maxLifetimeTimeout = setTimeout(cleanup, MAX_TRAVEL_EFFECT_LIFETIME_MS);
      }

      const shouldTrackArrivalGhost = shouldCreatePredictiveArrivalGhost({
        hasTargetHex: true,
        isLocalArmy: selectedArmy?.isMine ?? false,
        movementType: actionType === ActionType.Explore ? "explore" : "travel",
      });

      if (shouldTrackArrivalGhost) {
        const ghostSource = this.armyManager.getArrivalGhostSourceSnapshot(selectedEntityId);
        if (ghostSource) {
          this.arrivalGhostManager.upsertLocalArrivalGhost({
            entityId: selectedEntityId,
            hexCoords: {
              col: targetHex.col - FELT_CENTER(),
              row: targetHex.row - FELT_CENTER(),
            },
            sourceScene: ghostSource.sourceScene,
            visualStyle: resolveArrivalGhostVisualStyle({
              armyColor: ghostSource.armyColor,
            }),
          });
        }
      }

      this.clearMovementActionOptionsForSelectedArmy(selectedEntityId);
      this.installPendingMovementVisualLifecycle({ entityId: selectedEntityId });
      recordArmyMovementLatencyPhase({
        phase: "move_requested",
        source: "worldmap",
        entityId: selectedEntityId,
        details: {
          actionType,
          targetCol: targetHex.col,
          targetRow: targetHex.row,
        },
      });
      if (actionType === ActionType.Explore) {
        recordArmyMovementLatencyPhase({
          phase: "explore_intent_queued",
          source: "worldmap",
          entityId: selectedEntityId,
          details: {
            targetCol: targetHex.col,
            targetRow: targetHex.row,
          },
        });
        recordArmyMovementLatencyPhase({
          phase: "explore_submit_started",
          source: "worldmap",
          entityId: selectedEntityId,
        });
      }

      armyActionManager
        .moveArmy(account!, actionPath, isTravelAction, currentArmiesTick)
        .then((result: any) => {
          const txHash = result?.transaction_hash;
          recordArmyMovementLatencyPhase({
            phase: "tx_response_received",
            source: "worldmap",
            entityId: selectedEntityId,
            txHash,
          });
          if (txHash && actionType === ActionType.Explore) {
            if (exploreLatencyActionId) recordClientActionSubmitted(exploreLatencyActionId, txHash);
            recordArmyMovementLatencyPhase({
              phase: "explore_tx_hash_received",
              source: "worldmap",
              entityId: selectedEntityId,
              txHash,
            });
          }
          recordArmyMovementLatencyPhase({
            phase: "tx_submitted",
            source: "worldmap",
            entityId: selectedEntityId,
            txHash,
          });
          if (txHash) {
            void requireActiveGameSyncRuntime()
              .waitForTransaction(txHash)
              .then((transaction) => {
                if (transaction.status === "PRE_CONFIRMED") recordClientActionPreConfirmed(txHash);
                recordArmyMovementLatencyPhase({
                  phase: "tx_confirmed",
                  source: "worldmap",
                  entityId: selectedEntityId,
                  txHash,
                });
                if (actionType === ActionType.Explore) {
                  recordArmyMovementLatencyPhase({
                    phase: "explore_next_safe_unblocked",
                    source: "worldmap",
                    entityId: selectedEntityId,
                  });
                }
              })
              .catch((error) => {
                if (exploreLatencyActionId) recordClientActionFailed(exploreLatencyActionId, error);
                this.pendingExploreLatencyActions.delete(selectedEntityId);
                this.handlePendingArmyMovementFailure(selectedEntityId, cleanup);
              });
          }
        })
        .catch((e) => {
          if (exploreLatencyActionId) recordClientActionFailed(exploreLatencyActionId, e);
          this.pendingExploreLatencyActions.delete(selectedEntityId);
          this.handlePendingArmyMovementFailure(selectedEntityId, cleanup);
          console.error("Army movement failed:", e);
        });

      this.state.updateEntityActionHoveredHex(null);
      this.keepMovementDestinationSelected(targetHex);
      return;
    }

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
    // The preview popup is now the confirm step. Clear only the hovered hex so
    // the "right-click to confirm" action panel (gated on hoveredHex) hides —
    // this is the same minimal call onArmyMovement makes, so the army stays
    // selected and the action-path state machine is left intact (unlike
    // clearEntitySelection, which reset it and broke movement/exploration).
    this.state.updateEntityActionHoveredHex(null);
  }

  private onArmySpireTravel(actionPath: ActionPath[], selectedEntityId: ID) {
    const selectedPath = actionPath.map((path) => path.hex);
    const selectedHex = selectedPath[0];
    const targetHex = selectedPath[selectedPath.length - 1];
    if (!selectedHex || !targetHex) {
      return;
    }

    const selected = this.getHexagonEntity(selectedHex);
    const etherealTile = getTileAt(this.dojo.components, true, targetHex.col, targetHex.row);
    const traversalAction = resolveSpireTraversalAction({
      targetHex,
      etherealTile,
    });

    if (traversalAction.kind === "attack") {
      const attackerSummary = {
        type: selected.army ? ActorType.Explorer : ActorType.Structure,
        id: selectedEntityId,
        hex: new Position({ x: selectedHex.col, y: selectedHex.row }).getContract(),
      };
      const targetSummary = {
        type: ActorType.Explorer,
        id: traversalAction.targetArmyId,
        hex: new Position({ x: traversalAction.targetHex.col, y: traversalAction.targetHex.row }).getContract(),
        alt: true,
      };

      this.state.toggleModal(<QuickAttackPreview attacker={attackerSummary} target={targetSummary} />);
      this.state.updateEntityActionHoveredHex(null);
      return;
    }

    const account = useAccountStore.getState().account;
    if (!account) {
      return;
    }

    this.state.toggleModal(
      <SpireTravelModal onTravelThroughSpire={() => this.onArmyMovement(account, actionPath, selectedEntityId)} />,
    );
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
    const structureData = getComponentValue(this.dojo.components.Structure, gameEntityKey([BigInt(selectedEntityId)]));
    const attackRange = structureData
      ? Math.max(
          0,
          ...getGuardsByStructure(structureData)
            .filter((guard) => Number(guard.troops.count) > 0)
            .map((guard) => getTroopAttackRange(guard.troops.category)),
        )
      : 0;

    const playerAddress = useAccountStore.getState().account?.address;

    if (!playerAddress) return;

    const actionPaths = structure.findActionPaths(
      hexCoords,
      this.buildProjectedArmyActionIndex(),
      this.buildProjectedExploredTileIndex(),
      ContractAddress(playerAddress),
      attackRange,
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
    this.ownershipPulsePresenter.update(selectedEntityId, extraHexes);
  }

  private clearEvictedArmyMovementVisuals(entityId: ID): void {
    const trackedEffect = this.travelEffectsByEntity.get(entityId);
    if (trackedEffect) {
      trackedEffect.cleanup();
    }
  }

  private handoffPendingArmyMovementToVisualLifecycle(entityId: ID): void {
    const trackedEffect = this.travelEffectsByEntity.get(entityId);
    if (!trackedEffect) {
      return;
    }

    if (shouldCleanupTrackedTravelEffect({ trackedEffect, reason: "movement_started" })) {
      trackedEffect.cleanup();
    }
  }

  private clearPendingArmyMovementVisuals(entityId: ID, reason: MovementEffectClearReason = "cleanup_requested"): void {
    const trackedEffect = this.travelEffectsByEntity.get(entityId);
    if (trackedEffect && shouldCleanupTrackedTravelEffect({ trackedEffect, reason })) {
      trackedEffect.cleanup();
    }
  }

  private completePendingArmyMovementVisuals(entityId: ID): void {
    this.clearPendingArmyMovementVisuals(entityId);
  }

  private installPendingMovementVisualLifecycle(input: { entityId: ID }): void {
    const { entityId } = input;

    this.disposePendingMovementVisualLifecycle(entityId);

    const disposeMovementStart = this.armyManager.onMovementStart(entityId, () => {
      recordArmyMovementLatencyPhase({
        phase: "movement_started",
        source: "worldmap",
        entityId,
      });
      this.arrivalGhostManager.resolveArrivalGhost(entityId, "settled");
      this.handoffPendingArmyMovementToVisualLifecycle(entityId);
    });
    const disposeMovementComplete = this.armyManager.onMovementComplete(entityId, () => {
      recordArmyMovementLatencyPhase({
        phase: "movement_completed",
        source: "worldmap",
        entityId,
      });
      this.completePendingArmyMovementVisuals(entityId);
      this.disposePendingMovementVisualLifecycle(entityId);
    });
    const disposeMovementVisualCancel = this.armyManager.onMovementVisualCancel(entityId, () => {
      this.completePendingArmyMovementVisuals(entityId);
      this.clearEvictedArmyMovementVisuals(entityId);
      this.disposePendingMovementVisualLifecycle(entityId);
    });

    this.pendingArmyMovementVisualLifecycleDisposers.set(entityId, () => {
      disposeMovementStart();
      disposeMovementComplete();
      disposeMovementVisualCancel();
      this.pendingArmyMovementVisualLifecycleDisposers.delete(entityId);
    });
  }

  private disposePendingMovementVisualLifecycle(entityId: ID): void {
    const dispose = this.pendingArmyMovementVisualLifecycleDisposers.get(entityId);
    if (!dispose) {
      return;
    }

    dispose();
  }

  private handlePendingArmyMovementFailure(entityId: ID, cleanup: () => void): void {
    this.clearPendingArmyMovementVisuals(entityId);
    this.disposePendingMovementVisualLifecycle(entityId);
    this.arrivalGhostManager.clearArrivalGhost(entityId, "failed");
    cleanup();
  }

  private hasPendingTravelEffectForHex(key: string): boolean {
    for (const [entityId, trackedEffect] of this.travelEffectsByEntity.entries()) {
      if (trackedEffect.key === key && this.pendingArmyMovementVisualLifecycleDisposers.has(entityId)) {
        return true;
      }
    }

    return false;
  }

  private replayIndexedCombat(update: BattleEventSystemUpdate): void {
    const { attackerId, defenderId } = update.battleData;
    const attacker = this.armyManager.getArmy(attackerId);
    if (!attacker) return;
    const attackerHex = this.getArmyDisplayPosition(attackerId);
    const defenderHex = this.getArmyDisplayPosition(defenderId) ?? this.getStructureHexPosition(defenderId);
    if (!attackerHex || !defenderHex) return;
    const origin = getWorldPositionForHex(attackerHex);
    const target = getWorldPositionForHex(defenderHex);
    const presentation = {
      attackerId,
      defenderId,
      origin,
      target,
      tier: attacker.tier,
      troopType: attacker.category,
    };
    const replayed = this.combatPresentation?.replayIndexed(presentation, { deferEffects: true });
    if (!replayed) return;
    if (!this.armyManager.playProceduralAttack(attackerId, target, defenderId, "indexed-replay")) {
      this.combatPresentation?.presentImmediate(presentation);
    }
  }

  private bindProceduralCombatPresentation(): void {
    this.unsubscribeProceduralRangedRelease = this.armyManager.onProceduralRangedRelease(
      (entityId, event, targetEntityId, authority) => {
        this.presentProceduralRangedRelease(entityId, event, targetEntityId, authority);
      },
    );
    this.unsubscribeProceduralMeleeContact = this.armyManager.onProceduralMeleeContact(
      (entityId, event, targetEntityId) => {
        this.presentProceduralMeleeContact(entityId, event, targetEntityId);
      },
    );
    this.unsubscribeProceduralProjectileImpact = this.combatPresentation?.onProjectileImpact((event) => {
      this.armyManager.presentProceduralProjectileImpact(event);
    });
  }

  private presentProceduralRangedRelease(
    entityId: number,
    event: ProceduralRangedReleaseEvent,
    targetEntityId?: number,
    authority: ProceduralImpactAuthority = "provisional",
  ): void {
    const army = this.armyManager.getArmy(entityId);
    if (!army || targetEntityId === undefined) return;
    this.combatPresentation?.presentRangedRelease({
      authority,
      ownerEntityId: entityId,
      origin: event.origin,
      origins: event.origins,
      presentationId: `procedural:${entityId}:${event.shotGeneration}`,
      projectile: event.projectile,
      seed: event.seed,
      target: event.target,
      targetEntityId,
      tier: army.tier,
    });
  }

  private presentProceduralMeleeContact(
    entityId: number,
    event: ProceduralMeleeContactEvent,
    _targetEntityId?: number,
  ): void {
    const army = this.armyManager.getArmy(entityId);
    if (!army) return;
    this.combatPresentation?.presentMeleeContact({
      direction: event.direction,
      target: event.target,
      tier: army.tier,
    });
  }

  private resolveMovementStaminaForAction(input: {
    entityId: ID;
    actionPath: ActionPath[];
    currentArmiesTick: number;
  }): MovementStaminaResolution {
    return resolveMovementStamina({
      entityId: input.entityId,
      actionPath: input.actionPath,
      currentArmiesTick: input.currentArmiesTick,
      liveTroops: this.resolveLiveExplorerTroopsForMovementStamina(input.entityId),
    });
  }

  private resolveLiveExplorerTroopsForMovementStamina(entityId: ID) {
    return getComponentValue(this.dojo.components.ExplorerTroops, gameEntityKey([BigInt(entityId)]))?.troops ?? null;
  }

  private logBlockedMovementStamina(input: {
    entityId: ID;
    actionType: ActionType | undefined;
    actionPath: ActionPath[];
    movementStamina: MovementStaminaResolution;
  }): void {
    if (!import.meta.env.DEV) {
      return;
    }

    const targetHex = input.actionPath[input.actionPath.length - 1]?.hex;
    console.warn("[worldmap] Blocked army movement for stamina", {
      entityId: input.entityId,
      actionType: input.actionType,
      targetCol: targetHex?.col,
      targetRow: targetHex?.row,
      isExploredMove: input.actionType === ActionType.Move,
      staminaCost: input.movementStamina.staminaCost,
      currentStamina: input.movementStamina.currentStamina,
      source: input.movementStamina.source,
      currentArmiesTick: input.movementStamina.currentArmiesTick,
      ...input.movementStamina.diagnostics,
    });
  }

  /**
   * Minimum eligibility for an army to act on the worldmap. Used by Tab-cycle
   * and anywhere else we want to pre-filter armies before handing selection to
   * the user — mirrors the gates the right-click action path enforces so the
   * user never lands on a unit that would immediately fail its first submit.
   *
   * An army is "able to act" when:
   *   - The scene knows about it (armyManager.getArmy returns non-nullish).
   *   - It has at least the minimum travel stamina cost — i.e. there's SOME
   *     one-hex action it could perform. Finer-grained stamina is still
   *     enforced at submit by the movement stamina resolver.
   *   - It is not sitting in a battle cooldown (battleTimerLeft > 0).
   */
  private canArmyAct(entityId: ID): boolean {
    const army = this.armyManager.getArmy(entityId);
    if (!army) return false;
    const minStaminaCost = configManager.getMinTravelStaminaCost();
    if (Math.floor(army.currentStamina ?? 0) < Math.floor(minStaminaCost)) return false;
    if ((army.battleTimerLeft ?? 0) > 0) return false;
    return true;
  }

  private isArmyMovementInputLocked(entityId: ID): boolean {
    return this.pendingArmyMovementVisualLifecycleDisposers.has(entityId);
  }

  private isArmyMovementActionUnavailable(entityId: ID): boolean {
    return this.isArmyMovementInputLocked(entityId);
  }

  private hasEligibleArmyForTabCycle(): boolean {
    return this.selectableArmies.some(
      (army) => !this.isArmyMovementInputLocked(army.entityId) && this.canArmyAct(army.entityId),
    );
  }

  private onArmySelection(
    selectedEntityId: ID,
    playerAddress: ContractAddress,
    options?: { deferDuringChunkTransition?: boolean },
  ): boolean {
    const deferDuringChunkTransition = options?.deferDuringChunkTransition ?? true;

    // Check if army is currently being rendered or is in chunk transition
    if (this.isChunkTransitioning) {
      if (deferDuringChunkTransition) {
        const retrySelection = () => {
          if (this.armyManager.hasArmy(selectedEntityId)) {
            this.onArmySelection(selectedEntityId, playerAddress);
          } else {
            const shouldQueueRecovery = shouldQueueArmySelectionRecovery({
              deferDuringChunkTransition,
              hasPendingMovement: this.isArmyMovementInputLocked(selectedEntityId),
              isChunkTransitioning: this.isChunkTransitioning,
              armyPresentInManager: false,
              recoveryInFlight: this.armySelectionRecoveryInFlight.has(selectedEntityId),
            });

            if (import.meta.env.DEV) {
              console.warn(`[Worldmap] Army ${selectedEntityId} not available after chunk switch`);
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
          hasPendingMovement: this.isArmyMovementInputLocked(selectedEntityId),
          isChunkTransitioning: this.isChunkTransitioning,
          armyPresentInManager: false,
          recoveryInFlight: this.armySelectionRecoveryInFlight.has(selectedEntityId),
        })
      ) {
        this.queueArmySelectionRecovery(selectedEntityId, playerAddress);
      }

      if (import.meta.env.DEV) {
        console.warn(`[Worldmap] Army ${selectedEntityId} not available in current chunk for selection`);
      }

      return false;
    }

    this.state.updateEntityActionSelectedEntityId(selectedEntityId);
    playUnitCommandSound("select");

    if (this.isArmyMovementActionUnavailable(selectedEntityId)) {
      this.clearMovementActionOptionsForSelectedArmy(selectedEntityId);
      this.showSelectedArmyPulse(selectedEntityId);
      return true;
    }

    const armyActionManager = new ArmyActionManager(this.dojo.components, this.dojo.systemCalls, selectedEntityId);

    const { currentDefaultTick, currentArmiesTick } = getBlockTimestamp();
    const armyPosition = this.getArmyDisplayPosition(selectedEntityId);
    // Action paths plan from RECS ExplorerTroops — the same coord the submit
    // freshness guard checks. The visual display position may lag it mid-tween
    // and is presentation only, never planning input.
    const explorerTroopsCoord = getComponentValue(
      this.dojo.components.ExplorerTroops,
      gameEntityKey([BigInt(selectedEntityId)]),
    )?.coord;
    if (!explorerTroopsCoord) {
      if (import.meta.env.DEV) {
        console.error(`[Worldmap] Army ${selectedEntityId} has no ExplorerTroops coord; suppressing action paths`);
      }
      this.clearMovementActionOptionsForSelectedArmy(selectedEntityId);
      this.showSelectedArmyPulse(selectedEntityId);
      return true;
    }

    const actionPaths = armyActionManager.findActionPaths(
      this.buildProjectedStructureActionIndex(),
      this.buildProjectedArmyActionIndex(),
      this.buildProjectedExploredTileIndex(),
      this.buildProjectedChestActionIndex(),
      currentDefaultTick,
      currentArmiesTick,
      playerAddress,
    );

    const paths = actionPaths.getPaths();
    const highlightedHexes = actionPaths.getHighlightDescriptors();

    this.updateEntityActionPaths(paths);
    this.highlightHexManager.highlightHexes(highlightedHexes);

    this.showSelectedArmyPulse(selectedEntityId);

    const extraHexes: HexPosition[] = [];
    if (armyPosition) {
      extraHexes.push(armyPosition);
    }

    const owningStructureId = this.getArmyOwnerStructureId(selectedEntityId);

    this.ownershipPulsePresenter.update(owningStructureId ?? undefined, extraHexes, extraHexes);
    this.applyContextualHoverPalette(this.previouslyHoveredHex ?? null);
    return true;
  }

  private buildProjectedChestActionIndex(): Map<number, Map<number, HexEntityInfo>> {
    const index = new Map<number, Map<number, HexEntityInfo>>();
    this.worldSpatialProjection.getChests().forEach((chest) => {
      const normalized = new Position({ x: chest.hexCoords.col, y: chest.hexCoords.row }).getNormalized();
      const row = index.get(normalized.x) ?? new Map<number, HexEntityInfo>();
      row.set(normalized.y, { id: chest.entityId, owner: 0n });
      index.set(normalized.x, row);
    });
    return index;
  }

  private buildProjectedExploredTileIndex(): Map<number, Map<number, BiomeType>> {
    const index = new Map<number, Map<number, BiomeType>>();
    this.worldSpatialProjection.getTiles().forEach((tile) => {
      const normalized = new Position({ x: tile.hexCoords.col, y: tile.hexCoords.row }).getNormalized();
      const row = index.get(normalized.x) ?? new Map<number, BiomeType>();
      row.set(normalized.y, resolveTileBiomeType(tile.biome));
      index.set(normalized.x, row);
    });
    return index;
  }

  private buildProjectedArmyActionIndex(): Map<number, Map<number, HexEntityInfo>> {
    const index = new Map<number, Map<number, HexEntityInfo>>();
    this.worldSpatialProjection.getArmies().forEach(({ entityId }) => {
      const position = this.getArmyDisplayPosition(entityId);
      if (!position) return;
      const row = index.get(position.col) ?? new Map<number, HexEntityInfo>();
      row.set(position.row, { id: entityId, owner: this.getArmyOwnerAddress(entityId) ?? 0n });
      index.set(position.col, row);
    });
    return index;
  }

  private buildProjectedStructureActionIndex(): Map<number, Map<number, HexEntityInfo>> {
    const index = new Map<number, Map<number, HexEntityInfo>>();
    this.worldSpatialProjection.getStructures().forEach((structure) => {
      if (structure.reserved) return;

      const normalized = new Position({ x: structure.hexCoords.col, y: structure.hexCoords.row }).getNormalized();
      const row = index.get(normalized.x) ?? new Map<number, HexEntityInfo>();
      row.set(normalized.y, {
        id: structure.entityId,
        owner: this.getStructureOwnerAddress(structure.entityId) ?? 0n,
      });
      index.set(normalized.x, row);
    });
    return index;
  }

  private clearMovementActionOptionsForSelectedArmy(entityId: ID): void {
    const { selectedEntityId } = getLiveWorldmapEntityActions();
    if (selectedEntityId !== entityId) {
      return;
    }

    this.updateEntityActionPaths(new Map());
    this.highlightHexManager.highlightHexes([]);
    this.state.updateEntityActionHoveredHex(null);
    this.applyContextualHoverPalette(this.previouslyHoveredHex ?? null);
  }

  private showSelectedArmyPulse(selectedEntityId: ID): void {
    const armyPosition = this.getArmyDisplayPosition(selectedEntityId);
    if (armyPosition) {
      const worldPos = getWorldPositionForHex(armyPosition);
      this.selectionPulseManager.showSelection(worldPos.x, worldPos.z, selectedEntityId);
      this.selectionPulseManager.applyPulsePalette(resolveSelectionPulsePalette("army"));
    } else {
      if (import.meta.env.DEV) {
        console.warn(`[Worldmap] No projected army position found for ${selectedEntityId}`);
      }
    }
  }

  private queueArmySelectionRecovery(selectedEntityId: ID, playerAddress: ContractAddress): void {
    if (this.armySelectionRecoveryInFlight.has(selectedEntityId)) {
      return;
    }

    this.armySelectionRecoveryInFlight.add(selectedEntityId);

    void (async () => {
      try {
        await runWorldmapArmySelectionRecovery({
          awaitActiveChunkSwitch: this.globalChunkSwitchPromise
            ? async () => {
                await this.globalChunkSwitchPromise;
              }
            : undefined,
          forceChunkRefresh: async () => {
            await this.updateVisibleChunks(true, {
              reason: "default",
              triggerReason: "army_selection_recovery",
            });
          },
          isArmyAvailable: () => this.armyManager.hasArmy(selectedEntityId),
          isArmyPendingMovement: () => this.isArmyMovementInputLocked(selectedEntityId),
          onRecovered: () => {
            this.onArmySelection(selectedEntityId, playerAddress, { deferDuringChunkTransition: false });
          },
          onUnavailable: () => {
            if (import.meta.env.DEV) {
              console.warn(
                `[Worldmap] Army ${selectedEntityId} still unavailable after forced chunk refresh during selection recovery`,
              );
            }
          },
          onError: (error) => {
            if (import.meta.env.DEV) {
              console.warn(`[Worldmap] Army selection recovery failed for ${selectedEntityId}`, error);
            }
          },
          wait: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
        });
      } catch (error) {
        console.error("[WorldMap] Unexpected army selection recovery wrapper failure", error);
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

  private keepMovementDestinationSelected(targetHex: HexPosition): void {
    this.clearEntitySelection();
    this.selectContractHexWithoutFeedback(targetHex);
  }

  private selectContractHexWithoutFeedback(hexCoords: HexPosition): void {
    const position = getWorldPositionForHex({
      col: hexCoords.col - FELT_CENTER(),
      row: hexCoords.row - FELT_CENTER(),
    });

    this.selectedHexManager.setPosition(position.x, position.z);
    this.state.setSelectedHex({
      col: hexCoords.col,
      row: hexCoords.row,
    });
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
    const { selectedEntityId, actionPaths } = getLiveWorldmapEntityActions();
    this.actionPathsTransitionToken = resolveEntityActionPathsTransitionTokenSync({
      selectedEntityId,
      actionPathCount: actionPaths.size,
      previousTransitionToken: this.actionPathsTransitionToken,
    });
  }

  private isMissingActionPathOwnershipState(): boolean {
    const { selectedEntityId, actionPaths } = getLiveWorldmapEntityActions();
    return shouldClearEntitySelectionForMissingActionPathOwnership({
      selectedEntityId,
      actionPathCount: actionPaths.size,
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
    this.attachWorldmapManagerLabels();
  }

  private applyContextualHoverPalette(hexCoords: HexPosition | null): void {
    this.interactiveHexManager.applyHoverPalette(this.resolveContextualHoverPalette(hexCoords));
  }

  private resolveContextualHoverPalette(hexCoords: HexPosition | null) {
    const { selectedEntityId } = getLiveWorldmapEntityActions();
    const hasSelection = selectedEntityId !== null && selectedEntityId !== undefined;
    const actionType = this.getHoveredActionType(hexCoords);

    return resolveHoverVisualPalette({
      hasSelection,
      actionType,
    });
  }

  private getHoveredActionType(hexCoords: HexPosition | null): ActionType | undefined {
    if (!hexCoords) {
      return undefined;
    }

    const hoveredHexKey = `${hexCoords.col + FELT_CENTER()},${hexCoords.row + FELT_CENTER()}`;
    const actionPath = getLiveWorldmapEntityActions().actionPaths.get(hoveredHexKey);
    return actionPath ? ActionPaths.getActionType(actionPath) : undefined;
  }

  private getStructureHexPosition(structureId: ID): HexPosition | undefined {
    const structure = this.worldSpatialProjection.getStructure(structureId);
    if (!structure) return undefined;
    const normalized = new Position({ x: structure.hexCoords.col, y: structure.hexCoords.row }).getNormalized();
    return { col: normalized.x, row: normalized.y };
  }

  private isProjectedStructureHex(col: number, row: number): boolean {
    const contract = new Position({ x: col, y: row }).getContract();
    return this.worldSpatialProjection.getStructuresAtHex({ col: contract.x, row: contract.y }).length > 0;
  }

  protected getWarpTravelLifecycleAdapter(): WarpTravelLifecycleAdapter {
    return {
      onSetupStart: () => this.configureWarpTravelSetupStart(),
      onInitialSetupStart: () => this.prepareWarpTravelInitialSetup(),
      // The camera is shared across scenes, so re-entry inherits the previous
      // scene's zoom; realign to the player's persisted worldmap band.
      onResumeStart: () => this.alignWorldmapCameraToDistance(this.resolvePreferredWorldmapCameraDistance()),
      moveCameraToSceneLocation: () => this.moveCameraToURLLocation({ requestRefresh: false }),
      attachLabelGroupsToScene: () => this.attachWorldmapLabelGroupsToScene(),
      attachManagerLabels: () => this.attachWorldmapManagerLabels(),
      registerStoreSubscriptions: () => {
        this.registerStoreSubscriptions();
        // World-update (RECS→scene) listeners are disposed on every switch-off but were
        // only registered in the constructor, leaving the map permanently deaf after any
        // scene switch (armies never re-appear: unlike tiles/structures they have no
        // scene-local repair path). Re-arming here also replays existing RECS entities
        // (runOnInit), so re-entry re-adds anything missed while the listeners were dead.
        this.registerWorldUpdateSubscriptions();
      },
      setupCameraZoomHandler: () => this.setupCameraZoomHandler(),
      refreshScene: (setupContext) => this.refreshWarpTravelScene(setupContext),
      reportSetupError: (error, phase) => this.reportWarpTravelRefreshError(error, phase),
      disposeStoreSubscriptions: () => this.disposeStoreSubscriptions(),
      onAfterDisposeSubscriptions: () => this.disposeWorldUpdateSubscriptions(),
      detachLabelGroupsFromScene: () => this.detachWorldmapLabelGroupsFromScene(),
      detachManagerLabels: () => this.detachWorldmapManagerLabels(),
    };
  }

  private announceWorldmapSceneReady(bootToken: number, phase: WorldmapWarpTravelPhase): void {
    usePlayRouteReadinessStore.getState().markWorldmapReady(bootToken);
    if (phase === "initial") {
      this.skipNextInitialSetupUrlRefresh = true;
    }
    this.retryPendingHoverLabelRecovery("scene_ready");
  }

  private announceWorldmapConverged(bootToken: number): void {
    usePlayRouteReadinessStore.getState().markWorldmapConverged(bootToken);
    markGameEntryMilestone("worldmap-fetch-completed");
    this.reconcileHoverLabels("initial_refresh");
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
    this.reconcileHoverLabels();
  }

  private detachWorldmapManagerLabels(): void {
    this.clearPendingHoverLabelRecovery("detach");
    this.hoverLabelManager.onHexLeave();
    this.armyManager.removeLabelsFromScene();
    this.structureManager.removeLabelsFromScene();
    this.chestManager.removeLabelsFromScene();
  }

  private async refreshWarpTravelScene(setupContext: SceneSetupContext): Promise<void> {
    const phase: WorldmapWarpTravelPhase = this.hasInitialized ? "resume" : "initial";
    const readiness = usePlayRouteReadinessStore.getState();
    const bootToken = readiness.bootToken;
    const requiresAmbientConvergence = !readiness.worldmapConverged;

    await startWorldmapEntryReadiness({
      bootToken,
      commitCriticalPass: () => this.commitCriticalWorldmapPass(phase),
      isCurrent: () => setupContext.isCurrent() && bootToken === getCurrentPlayRouteBootToken(),
      markCriticalPassReady: (currentBootToken) => this.announceWorldmapSceneReady(currentBootToken, phase),
      markWorldmapConverged: (currentBootToken) => this.announceWorldmapConverged(currentBootToken),
      requiresAmbientConvergence,
      reportAmbientConvergenceError: (error) => this.reportAmbientConvergenceError(error),
      waitForAmbientConvergence: () => this.awaitInitialTerrainConvergence(),
    });
  }

  private reportAmbientConvergenceError(error: unknown): void {
    console.error(`[WorldMap] Ambient convergence failed: ${formatReadableErrorForConsole(error)}`);
  }

  private async commitCriticalWorldmapPass(phase: WorldmapWarpTravelPhase): Promise<void> {
    const startedAt = performance.now();
    await completeWorldmapInteractiveRefresh({
      phase,
      refresh: () => this.refreshVisibleChunksForWarpTravel(phase),
    });
    await this.waitForLatestTerrainPresentation();
    if (phase === "initial") {
      recordGameEntryDuration("worldmap-first-terrain", performance.now() - startedAt);
      markGameEntryMilestone("worldmap-terrain-visible");
    }
  }

  private async waitForLatestTerrainPresentation(): Promise<void> {
    for (;;) {
      const pending = this.terrainPresentationPromise;
      await pending;
      if (pending === this.terrainPresentationPromise) return;
    }
  }

  private async refreshVisibleChunksForWarpTravel(phase: WorldmapWarpTravelPhase): Promise<boolean> {
    if (!this.globalChunkSwitchPromise) {
      return this.updateVisibleChunks(true, { reason: "default", triggerReason: `${phase}_setup` });
    }

    await waitForChunkTransitionToSettle(
      () => this.globalChunkSwitchPromise,
      (error) => console.warn("Active world map refresh failed while resuming:", error),
      { isSwitchedOff: () => this.isSwitchedOff },
    );
    return !this.isSwitchedOff && this.currentChunk !== "null";
  }

  private async awaitInitialTerrainConvergence(): Promise<void> {
    await waitForWorldmapHydratedRefreshQueueIdle({
      isSwitchedOff: () => this.isSwitchedOff,
      setTimeoutFn: (callback, delayMs) => window.setTimeout(callback, delayMs),
      state: this.hydratedRefreshQueueState,
    });

    await this.waitForPendingChunkRefreshConvergence();
  }

  private async waitForPendingChunkRefreshConvergence(): Promise<void> {
    const requestToken = this.chunkRefreshRequestToken;
    if (!this.hasPendingChunkRefresh(requestToken)) {
      return;
    }

    await this.waitForRequestedChunkRefresh(requestToken);
  }

  private hasPendingChunkRefresh(requestToken: number): boolean {
    return (
      this.chunkRefreshAppliedToken < requestToken || this.chunkRefreshRunning || this.chunkRefreshTimeout !== null
    );
  }

  private commitCurrentChunkAuthority(chunkKey: string): void {
    const previousChunk = this.currentChunk;
    this.currentChunk = chunkKey;
    this.traceChunk("chunk_activated", {
      previousChunk,
      nextChunk: chunkKey,
    });
  }

  private unregisterVisibilityChunk(chunkKey: string): void {
    this.traceChunk("chunk_deactivated", {
      chunkKey,
    });
    this.visibilityManager?.unregisterChunk(chunkKey);
  }

  private async restorePreviousChunkVisualsAfterRollback(oldStartRow: number, oldStartCol: number): Promise<void> {
    this.updateCurrentChunkBounds(oldStartRow, oldStartCol);
    await this.updateHexagonGrid(oldStartRow, oldStartCol, this.renderChunkSize.height, this.renderChunkSize.width);
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
    this.claimInteractionOwnership();
    this.logInteractionDebug("setup_start", {
      hasInitialized: this.hasInitialized,
      hasInitialSetupPromise: this.isInitialWarpTravelSetupInFlight(),
      existingStoreSubscriptionCount: this.storeSubscriptions.length,
    });
    this.syncUrlChangedListenerLifecycle("setup");
    this.controls.maxDistance = WORLDMAP_CAMERA_ZOOM.maxDistance;
    this.lockMapControlsZoom();
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

  private reportWarpTravelRefreshError(error: unknown, phase: "initial" | "resume"): void {
    const message =
      phase === "initial"
        ? "Failed to update visible chunks during initial setup:"
        : "Failed to update visible chunks while resuming worldmap scene:";
    console.error(message, error);
  }

  private resetZoomHardeningRuntimeState(): void {
    cancelWorldmapChunkRefreshWaiters(this.chunkRefreshRuntimeState);
    const resetState = resetWorldmapZoomHardeningRuntimeState(
      {
        chunkRefreshTimeout: this.chunkRefreshTimeout,
        chunkRefreshRequestToken: this.chunkRefreshRequestToken,
        chunkRefreshAppliedToken: this.chunkRefreshAppliedToken,
        chunkRefreshRunning: this.chunkRefreshRunning,
        chunkRefreshRerunRequested: this.chunkRefreshRerunRequested,
        pendingChunkRefreshForce: this.pendingChunkRefreshForce,
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
    this.pendingChunkRefreshReasons.clear();
    this.pendingChunkRefreshUiReason = "default";
    this.terrainVisibilityHealthMonitor.reset();
    this.zoomRefreshPlannerState = createWorldmapZoomRefreshPlannerState();
    this.lastPublishedStableCameraView = this.zoomCoordinator.getSnapshot().stableBand;
    this.lastPublishedZoomStatus = "idle";
    this.lastChunkSwitchMovement = null;
    this.isShortcutArmySelectionInFlight = false;
  }

  private applyWorldmapSceneExitProjection(nextSceneName?: SceneName): void {
    if (nextSceneName !== SceneName.WorldMap) {
      this.camera.fov = CAMERA_CONFIG.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  private invalidateWorldmapSwitchOffTransitions(): void {
    this.isSwitchedOff = true;
    this.skipNextInitialSetupUrlRefresh = false;
    const switchOffTransitionState = invalidateWorldmapSwitchOffTransitionState({
      chunkTransitionToken: this.chunkTransitionToken,
      isChunkTransitioning: this.isChunkTransitioning,
      globalChunkSwitchPromise: this.globalChunkSwitchPromise,
    });
    this.chunkTransitionToken = switchOffTransitionState.chunkTransitionToken;
    this.terrainTimeoutRecoveryAuthority = null;
    this.exactTerrainPreparations.clear();
    this.isChunkTransitioning = switchOffTransitionState.isChunkTransitioning;
    this.globalChunkSwitchPromise = switchOffTransitionState.globalChunkSwitchPromise;
  }

  private clearWorldmapLoadingStateForSwitchOff(): void {
    this.syncUrlChangedListenerLifecycle("switchOff");
    this.cancelHexGridComputation?.();
    this.cancelHexGridComputation = undefined;
    if (this.chunkRecoveryTimeout !== null) {
      clearTimeout(this.chunkRecoveryTimeout);
      this.chunkRecoveryTimeout = null;
    }
    // Clear transition state so the chunk overlay doesn't persist when
    // switching away mid-transition.
    this.state.setLoading(LoadingStateKey.ChunkTransition, false);
  }

  private resetWorldmapInteractionForSwitchOff(nextSceneName?: SceneName): void {
    this.currentHoverLabelHex = null;
    this.clearPendingHoverLabelRecovery("switch_off");
    this.resetInteractionSelectionForSwitchOff(nextSceneName);
    this.releaseInteractionOwnership("switch_off");
    this.runWarpTravelSwitchOffLifecycle();
  }

  private clearWorldmapVisibilityRuntimeForSwitchOff(): void {
    this.detachWorldmapWheelHandler();
    this.wheelHandler = null;
    this.unregisterTrackedVisibilityChunks();
    this.resetZoomHardeningRuntimeState();
  }

  onSwitchOff(nextSceneName?: SceneName) {
    this.logInteractionDebug("switch_off_invoked", {
      nextSceneName,
      existingStoreSubscriptionCount: this.storeSubscriptions.length,
      ...this.getInteractionDebugSnapshot(),
    });
    this.applyWorldmapSceneExitProjection(nextSceneName);
    this.invalidateWorldmapSwitchOffTransitions();
    this.clearWorldmapLoadingStateForSwitchOff();
    this.resetWorldmapInteractionForSwitchOff(nextSceneName);
    this.clearWorldmapVisibilityRuntimeForSwitchOff();

    const runtimeState = applyWorldmapSwitchOffRuntimeState({
      pinnedChunkKeys: this.pinnedChunkKeys,
      pinnedRenderAreas: this.pinnedRenderAreas,
      hydratedChunkRefreshes: this.hydratedChunkRefreshes,
      hydratedRefreshSuppressionAreaKeys: this.hydratedRefreshSuppressionAreaKeys,
      nextSceneName: nextSceneName,
      clearStreamingWork: () => this.clearStreamingWorkState(),
      clearQueuedPrefetchState: () => this.clearQueuedPrefetchState(),
      releaseInactiveResources: () => this.clearCache(),
    });
    this.pendingArmyMovementVisualLifecycleDisposers.forEach((dispose) => dispose());
    this.pendingArmyMovementVisualLifecycleDisposers.clear();
    this.pendingExploreLatencyActions.clear();
    this.arrivalGhostManager
      .getTrackedEntityIds()
      .forEach((entityId) => this.arrivalGhostManager.clearArrivalGhost(entityId, "scene_destroyed"));

    this.isSwitchedOff = runtimeState.isSwitchedOff;
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

  private completePendingExploreEffects(hexCoords: HexPosition): void {
    const key = `${hexCoords.col},${hexCoords.row}`;
    const pendingExploreEntities = resolveExploreCompletionVisualCleanup({
      activeMovementVisuals: new Set(this.pendingArmyMovementVisualLifecycleDisposers.keys()),
      exploredHexKey: key,
      trackedEffectsByEntity: this.travelEffectsByEntity,
    });
    for (const entityId of pendingExploreEntities) {
      this.clearPendingArmyMovementVisuals(entityId);
      this.disposePendingMovementVisualLifecycle(entityId);
    }

    const endCompass = this.travelEffects.get(key);
    if (endCompass && !this.hasPendingTravelEffectForHex(key)) {
      endCompass();
    }
  }

  private recordExploreRevealAfterRender(hexCoords: HexPosition, terrainPageRebuild: Promise<void>): void {
    const targetKey = `${hexCoords.col},${hexCoords.row}`;
    const completedActions = Array.from(this.pendingExploreLatencyActions.entries()).flatMap(([entityId, action]) => {
      if (action.targetKey !== targetKey) return [];
      this.pendingExploreLatencyActions.delete(entityId);
      return [action.actionId];
    });
    if (completedActions.length === 0) return;

    void terrainPageRebuild.then(() => {
      const recordRendered = () => completedActions.forEach((actionId) => recordClientActionRendered(actionId));
      if (typeof window.requestAnimationFrame !== "function") {
        recordRendered();
        return;
      }
      window.requestAnimationFrame(recordRendered);
    });
  }

  isColRowInCurrentRenderBounds(col: number, row: number) {
    const startRow = parseInt(this.currentChunk.split(",")[0]);
    const startCol = parseInt(this.currentChunk.split(",")[1]);
    const bounds = getRenderBounds(startRow, startCol, this.renderChunkSize, this.chunkSize);
    return col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow;
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
    options?: { includeSurroundingChunks?: string[] },
  ): void {
    const targetChunkKeys = new Set<string>([centerChunkKey, ...this.getChunksAround(centerChunkKey)]);
    options?.includeSurroundingChunks?.forEach((chunkKey) => targetChunkKeys.add(chunkKey));

    targetChunkKeys.forEach((chunkKey) => {
      const [chunkRow, chunkCol] = chunkKey.split(",").map(Number);
      if (!Number.isFinite(chunkRow) || !Number.isFinite(chunkCol)) {
        return;
      }
      this.removeCachedMatricesForChunk(chunkRow, chunkCol);
    });
  }

  /**
   * Derive a stable projection-sync area key for a chunk key.
   * Overlapping render windows share one area so local presentation work coalesces.
   */
  private getRenderAreaKeyForChunk(chunkKey: string): string {
    return getCanonicalRenderAreaKeyForChunk(
      chunkKey,
      this.chunkSize,
      WORLDMAP_CHUNK_POLICY.projectionSync.superAreaStrides,
    );
  }

  /**
   * Compute integer bounds that fully cover all render windows inside a projection-sync area.
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
      WORLDMAP_CHUNK_POLICY.projectionSync.superAreaStrides,
    );
  }

  /**
   * Phase 1.3: bump the per-chunk terrain generation for every chunk whose render
   * window contains the mutated hex. Cached chunks store the generation they were
   * built at; on read, a chunk is rejected only when ITS generation advanced — a
   * tile change in one chunk no longer invalidates unrelated cached chunks. Uses
   * the same analytical resolution as invalidateAllChunkCachesContainingHex (here
   * unfiltered by cache state, so a chunk cached later still observes the bump).
   */
  private bumpTerrainGenerationForHex(col: number, row: number) {
    const containingChunkKeys = getChunkKeysContainingHexInRenderBoundsAnalytically({
      col,
      row,
      renderSize: this.renderChunkSize,
      chunkSize: this.chunkSize,
      hasChunkKey: () => true,
    });
    this.exploredTilesGeneration.bump(containingChunkKeys);
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

    const { startCol: chunkCol, startRow: chunkRow } = resolveWorldmapChunkFromHexPosition({
      col,
      row,
      chunkSize: this.chunkSize,
    });

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

    const forwardChunk = resolveWorldmapChunkFromWorldPosition({
      worldX: aheadX,
      worldZ: aheadZ,
      chunkSize: this.chunkSize,
    });
    return {
      forwardChunkKey: forwardChunk.chunkKey,
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
      areaBoundaryLookaheadStrides: WORLDMAP_CHUNK_POLICY.prefetch.areaBoundaryLookaheadStrides,
      projectionSuperAreaStrides: WORLDMAP_CHUNK_POLICY.projectionSync.superAreaStrides,
      pinnedChunkKeys: this.pinnedChunkKeys,
      currentChunk: this.currentChunk,
      prefetchedAhead: this.prefetchedAhead,
      maxPrefetchedAhead: this.maxPrefetchedAhead,
      getRenderAreaKeyForChunk: (chunkKey) => this.getRenderAreaKeyForChunk(chunkKey),
    });

    const nextDirectionalPrefetchAreaKeys = new Set(prefetchPlan.desiredAreaKeys);
    const retainedAreasChanged =
      nextDirectionalPrefetchAreaKeys.size !== this.directionalPrefetchAreaKeys.size ||
      [...nextDirectionalPrefetchAreaKeys].some((areaKey) => !this.directionalPrefetchAreaKeys.has(areaKey));
    this.directionalPrefetchAreaKeys = nextDirectionalPrefetchAreaKeys;
    this.directionalPresentationChunkKeys = WORLDMAP_STREAMING_ROLLOUT.stagedPathEnabled
      ? new Set(prefetchPlan.presentationChunkKeysToPrewarm)
      : new Set();
    this.pruneQueuedDirectionalPrefetches();
    if (retainedAreasChanged) {
      this.pruneWorldmapSpatialCaches();
      this.rebuildPathfindingWorkerState();
    }
    this.prefetchedAhead.splice(0, this.prefetchedAhead.length, ...prefetchPlan.nextPrefetchedAhead);

    prefetchPlan.chunkKeysToEnqueue.forEach((chunkKey) => {
      // Directional prefetch is lowest priority compared to pinned neighborhood.
      this.enqueueChunkPrefetch(chunkKey, 2);
    });

    if (WORLDMAP_STREAMING_ROLLOUT.stagedPathEnabled) {
      this.directionalPresentationChunkKeys.forEach((chunkKey) => {
        void this.prewarmDirectionalPresentationChunk(chunkKey);
      });
    }
  }

  private pruneQueuedDirectionalPrefetches(): void {
    prunePrefetchQueueByAreaKey(this.prefetchQueue, this.directionalPrefetchAreaKeys);
    this.queuedPrefetchAreaKeys = new Set(this.prefetchQueue.map((item) => item.areaKey));
  }

  private clearQueuedPrefetchState(): void {
    this.prefetchQueue = [];
    this.queuedPrefetchAreaKeys.clear();
    this.directionalPrefetchAreaKeys.clear();
    this.directionalPresentationChunkKeys.clear();
    this.prefetchedAhead.length = 0;
  }

  private enqueueChunkPrefetch(chunkKey: string, priority: number): void {
    const areaKey = this.getRenderAreaKeyForChunk(chunkKey);
    const enqueueResult = enqueueWarpTravelPrefetch({
      chunkKey,
      areaKey,
      priority,
      queue: this.prefetchQueue,
      queuedAreaKeys: this.queuedPrefetchAreaKeys,
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
      queuedAreaKeys: this.queuedPrefetchAreaKeys,
      activePrefetches: this.activePrefetches,
      maxConcurrentPrefetches: this.maxConcurrentPrefetches,
      desiredAreaKeys: this.directionalPrefetchAreaKeys,
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
          if (item.syncTiles) {
            recordChunkDiagnosticsEvent(this.chunkDiagnostics, "prefetch_executed");
            const projectionSyncSucceeded = await this.syncProjectionTilesForChunk(item.chunkKey);
            if (projectionSyncSucceeded && this.directionalPresentationChunkKeys.has(item.chunkKey)) {
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
            projectionSyncPromise: this.syncProjectionTilesForChunk(chunkKey),
            assetPrewarmPromise: this.structureManager.prewarmChunkAssets(chunkKey),
            prepareTerrainChunk: (targetStartRow, targetStartCol, height, width) =>
              this.prepareTerrainChunk(targetStartRow, targetStartCol, height, width, "prefetch"),
            phaseTimeoutMs: WORLDMAP_CHUNK_PHASE_TIMEOUT_MS,
            onPhaseTimeout: (info) => this.handleChunkPresentationTimeout(info),
          }),
        cachePreparedTerrain: (preparedTerrain) =>
          this.cachePreparedTerrainChunk(preparedTerrain as PreparedTerrainChunk),
        disposePreparedTerrain: (preparedTerrain) =>
          this.disposePreparedTerrainChunk(preparedTerrain as PreparedTerrainChunk),
      });
    } finally {
      this.activeDirectionalPresentationPrewarms.delete(chunkKey);
    }
  }

  private async refreshVisualTerrainWindowFromCamera(): Promise<void> {
    if (!WORLDMAP_CHUNK_POLICY.visualPresentation.rollingWindowEnabled || this.isSwitchedOff) {
      return;
    }

    const focusPoint = this.getCameraGroundIntersection().clone();
    await this.refreshVisualTerrainWindowForFocus(focusPoint);
  }

  private invalidateVisualTerrainPageForLiveTile(col: number, row: number): Promise<void> {
    const pageKey = resolveWorldmapVisualTerrainPageKeyForHex(
      { col, row },
      WORLDMAP_CHUNK_POLICY.visualPresentation.visualPageSize,
      this.getVisualTerrainPageOrigin(),
    ).pageKey;
    if (!this.visualTerrainWindowPageKeys.has(pageKey)) {
      return Promise.resolve();
    }

    const nextRevision = this.getVisualTerrainPageRevision(pageKey) + 1;
    this.visualTerrainPageRevisions.set(pageKey, nextRevision);
    incrementWorldmapRenderCounter("liveTilePageInvalidated");
    this.traceChunk("visual_page_live_tile_invalidated", { col, pageKey, revision: nextRevision, row });

    if (this.liveTilePageRebuilds.has(pageKey)) {
      return this.liveTilePageRebuilds.get(pageKey)!;
    }

    let rebuild: Promise<void>;
    rebuild = this.rebuildInvalidatedVisualTerrainPage(pageKey)
      .catch((error) => {
        if (!isFrameBudgetWorkQueueDisposedError(error)) {
          console.error(`[WorldMap] Live tile page ${pageKey} failed`, error);
        }
      })
      .finally(() => {
        if (this.liveTilePageRebuilds.get(pageKey) === rebuild) {
          this.liveTilePageRebuilds.delete(pageKey);
        }
      });
    this.liveTilePageRebuilds.set(pageKey, rebuild);
    return rebuild;
  }

  private async rebuildInvalidatedVisualTerrainPage(pageKey: string): Promise<void> {
    while (!this.isSwitchedOff && this.visualTerrainWindowPageKeys.has(pageKey)) {
      const revision = this.getVisualTerrainPageRevision(pageKey);
      const generation = this.visualTerrainGeneration;
      await waitForChunkTransitionToSettle(
        () => this.globalChunkSwitchPromise,
        (error) =>
          console.warn(`[WorldMap] Chunk transition failed before rebuilding live tile page ${pageKey}`, error),
        { isSwitchedOff: () => this.isSwitchedOff },
      );
      if (revision !== this.getVisualTerrainPageRevision(pageKey)) {
        continue;
      }
      if (!this.hasVisualTerrainCoverage(pageKey)) {
        return;
      }

      await this.buildAndApplyVisualTerrainPage({
        generation,
        pageKey,
        preserveCoverageAuthority: true,
        priority: "visible",
        revision,
      });
      if (generation !== this.visualTerrainGeneration) {
        continue;
      }
      if (revision === this.getVisualTerrainPageRevision(pageKey)) {
        incrementWorldmapRenderCounter("liveTilePageRebuilt");
        return;
      }
    }
  }

  private getVisualTerrainPageRevision(pageKey: string): number {
    return this.visualTerrainPageRevisions.get(pageKey) ?? 0;
  }

  private async refreshVisualTerrainWindowForFocus(focusPoint: Vector3): Promise<void> {
    const nextGeneration = this.visualTerrainGeneration + 1;
    const nextWindow = resolveWorldmapVisualTerrainWindow({
      focusPoint: {
        x: focusPoint.x,
        z: focusPoint.z,
      },
      generation: nextGeneration,
      hexSize: HEX_SIZE,
      marginPages: WORLDMAP_CHUNK_POLICY.visualPresentation.viewportMarginPages,
      pageOrigin: this.getVisualTerrainPageOrigin(),
      pageSize: WORLDMAP_CHUNK_POLICY.visualPresentation.visualPageSize,
      renderSize: this.renderChunkSize,
    });

    if (this.visualTerrainWindow && this.visualTerrainWindowsMatch(this.visualTerrainWindow, nextWindow)) {
      return;
    }

    const windowRebuildStartedAt = performance.now();
    this.visualTerrainGeneration = nextGeneration;
    this.visualTerrainWindow = nextWindow;
    this.visualTerrainWindowPageKeys = new Set(nextWindow.pageKeys);
    this.pruneVisualTerrainPageRevisions();
    this.retainVisualTerrainPagesOutsideWindow(performance.now());
    this.scheduleTerrainPresentationRetentionCleanup(WORLDMAP_CHUNK_POLICY.visualPresentation.retainedPageMs);
    this.traceChunk("visual_window_resolved", {
      activePageKeys: nextWindow.pageKeys,
      centerPageKey: nextWindow.centerPageKey,
      criticalPageKeys: nextWindow.criticalPageKeys,
      generation: nextWindow.generation,
      pageCount: nextWindow.pageKeys.length,
    });
    incrementWorldmapRenderCounter("visualWindowResolved");

    await this.buildCriticalVisualTerrainPages(nextWindow);
    this.enqueueMissingVisualTerrainPages(nextWindow);
    this.rebuildTerrainPresentationComposite(nextWindow.centerPageKey);
    const totalMs = performance.now() - windowRebuildStartedAt;
    recordWorldmapRenderDuration("visualTerrainWindowMs", totalMs);
  }

  private visualTerrainWindowsMatch(
    currentWindow: WorldmapVisualTerrainWindow,
    nextWindow: WorldmapVisualTerrainWindow,
  ): boolean {
    return (
      currentWindow.centerPageKey === nextWindow.centerPageKey &&
      currentWindow.pageKeys.length === nextWindow.pageKeys.length &&
      currentWindow.pageKeys.every((pageKey, index) => pageKey === nextWindow.pageKeys[index])
    );
  }

  private pruneVisualTerrainPageRevisions(): void {
    for (const pageKey of this.visualTerrainPageRevisions.keys()) {
      if (!this.visualTerrainWindowPageKeys.has(pageKey)) {
        this.visualTerrainPageRevisions.delete(pageKey);
      }
    }
  }

  private getVisualTerrainPageOrigin(): { row: number; col: number } {
    const referenceBounds = getRenderBounds(0, 0, this.renderChunkSize, this.chunkSize);
    return {
      row: referenceBounds.minRow,
      col: referenceBounds.minCol,
    };
  }

  private retainVisualTerrainPagesOutsideWindow(nowMs: number): void {
    const retainedUntilMs = nowMs + WORLDMAP_CHUNK_POLICY.visualPresentation.retainedPageMs;
    this.visualTerrainPresentationState.presentations = this.visualTerrainPresentationState.presentations.map(
      (presentation) => {
        if (presentation.coverageKind !== "visual_page") {
          return presentation;
        }

        const coverageKey = presentation.coverageKey ?? presentation.chunkKey;
        if (this.visualTerrainWindowPageKeys.has(coverageKey)) {
          return {
            ...presentation,
            retainedUntilMs: undefined,
          };
        }

        return {
          ...presentation,
          retainedUntilMs: presentation.retainedUntilMs ?? retainedUntilMs,
        };
      },
    );
  }

  private async buildCriticalVisualTerrainPages(window: WorldmapVisualTerrainWindow): Promise<void> {
    const criticalBudget = WORLDMAP_CHUNK_POLICY.visualPresentation.criticalPageImmediateBudget;
    const criticalPageKeys = window.criticalPageKeys.slice(0, criticalBudget);
    const startedAt = performance.now();
    for (const pageKey of criticalPageKeys) {
      if (this.hasVisualTerrainCoverage(pageKey)) {
        continue;
      }
      await this.buildAndApplyVisualTerrainPage({
        generation: window.generation,
        pageKey,
        priority: "critical",
        revision: this.getVisualTerrainPageRevision(pageKey),
      });
    }

    recordWorldmapRenderDuration("criticalTerrainPagesMs", performance.now() - startedAt);
  }

  private enqueueMissingVisualTerrainPages(window: WorldmapVisualTerrainWindow): void {
    window.pageKeys.forEach((pageKey) => {
      if (
        this.hasVisualTerrainCoverage(pageKey) ||
        this.activeVisualTerrainBuildPageKeys.get(pageKey)?.generation === window.generation ||
        this.queuedVisualTerrainBuildPageKeys.get(pageKey) === window.generation
      ) {
        return;
      }

      const request: WorldmapVisualTerrainPageBuildRequest = {
        generation: window.generation,
        pageKey,
        priority: "visible",
        revision: this.getVisualTerrainPageRevision(pageKey),
      };
      this.queuedVisualTerrainBuildPageKeys.set(pageKey, window.generation);
      this.traceChunk("visual_page_queued", {
        generation: window.generation,
        pageKey,
      });
      incrementWorldmapRenderCounter("visualPageQueued");
      void this.buildAndApplyVisualTerrainPage(request)
        .catch((error) => {
          if (isFrameBudgetWorkQueueDisposedError(error)) {
            return;
          }
          console.error(`[WorldMap] Visual terrain page ${pageKey} failed`, error);
        })
        .finally(() => {
          if (this.queuedVisualTerrainBuildPageKeys.get(pageKey) === window.generation) {
            this.queuedVisualTerrainBuildPageKeys.delete(pageKey);
          }
        });
    });
  }

  private async buildAndApplyVisualTerrainPage(request: WorldmapVisualTerrainPageBuildRequest): Promise<void> {
    if (!this.shouldApplyVisualTerrainPageBuild(request)) {
      this.traceVisualTerrainPageStaleDrop(request, "stale_generation_or_window");
      return;
    }

    this.activeVisualTerrainBuildPageKeys.set(request.pageKey, request);
    const pageStartedAt = performance.now();
    let phaseTimings: VisualTerrainPagePhaseTimings | null = null;
    try {
      const preparation = await this.prepareVisualTerrainPage(request.pageKey, request.priority);
      const preparedTerrain = preparation.preparedTerrain;
      phaseTimings = {
        ...preparation.phaseTimings,
        commitMs: 0,
        totalMs: 0,
      };
      if (!this.shouldApplyVisualTerrainPageBuild(request)) {
        this.disposePreparedTerrainChunk(preparedTerrain);
        this.traceVisualTerrainPageStaleDrop(request, "stale_after_prepare");
        return;
      }

      const commitTimings = phaseTimings;
      await this.schedulePreparedTerrainCommit(request.priority, preparedTerrain, () => {
        if (!this.shouldApplyVisualTerrainPageBuild(request)) {
          this.disposePreparedTerrainChunk(preparedTerrain);
          this.traceVisualTerrainPageStaleDrop(request, "stale_before_commit");
          return;
        }
        const commitStartedAt = performance.now();
        try {
          this.commitVisualTerrainPageBuild(request, preparedTerrain);
        } finally {
          commitTimings.commitMs = performance.now() - commitStartedAt;
        }
      });
    } finally {
      if (phaseTimings && request.priority === "critical") {
        phaseTimings.totalMs = performance.now() - pageStartedAt;
        recordWorldmapRenderDuration("criticalTerrainPageMs", phaseTimings.totalMs);
      }
      if (this.activeVisualTerrainBuildPageKeys.get(request.pageKey) === request) {
        this.activeVisualTerrainBuildPageKeys.delete(request.pageKey);
      }
    }
  }

  private shouldApplyVisualTerrainPageBuild(request: WorldmapVisualTerrainPageBuildRequest): boolean {
    return (
      !this.isSwitchedOff &&
      request.generation === this.visualTerrainGeneration &&
      request.revision === this.getVisualTerrainPageRevision(request.pageKey) &&
      this.visualTerrainWindowPageKeys.has(request.pageKey) &&
      (request.transitionToken === undefined || request.transitionToken === this.chunkTransitionToken)
    );
  }

  private commitVisualTerrainPageBuild(
    request: WorldmapVisualTerrainPageBuildRequest,
    preparedTerrain: PreparedTerrainChunk,
  ): void {
    const existingPresentation = request.preserveCoverageAuthority
      ? this.getCurrentVisualTerrainPresentation(request.pageKey)
      : undefined;
    const presentation = this.createTerrainPresentationFromPreparedTerrain(preparedTerrain, {
      authoritative: existingPresentation?.cells.some((cell) => cell.authoritative) ?? false,
      authorityChunkKey: existingPresentation?.authorityChunkKey ?? null,
      claimBiomeEntries: true,
      coverageKey: request.pageKey,
      coverageKind: "visual_page",
      generation: request.generation,
      kind: existingPresentation?.kind ?? "provisional",
      transitionToken: request.transitionToken ?? this.chunkTransitionToken,
    });
    this.traceChunk("visual_page_built", {
      cellCount: presentation.cells.length,
      generation: request.generation,
      pageKey: request.pageKey,
      priority: request.priority,
    });
    incrementWorldmapRenderCounter("visualPageBuilt");
    if (this.applyVisualTerrainPagePresentation(presentation)) {
      void this.requestVisualTerrainCompositeCommit();
    }
  }

  private traceVisualTerrainPageStaleDrop(request: WorldmapVisualTerrainPageBuildRequest, reason: string): void {
    this.traceChunk("visual_page_stale_dropped", {
      currentGeneration: this.visualTerrainGeneration,
      currentRevision: this.getVisualTerrainPageRevision(request.pageKey),
      generation: request.generation,
      pageKey: request.pageKey,
      reason,
      revision: request.revision,
    });
    incrementWorldmapRenderCounter("visualPageStaleDropped");
  }

  private hasVisualTerrainCoverage(pageKey: string): boolean {
    return this.getCurrentVisualTerrainPresentation(pageKey) !== undefined;
  }

  private getCurrentVisualTerrainPresentation(pageKey: string): WorldmapTerrainPresentationEntry | undefined {
    const nowMs = performance.now();
    return this.visualTerrainPresentationState.presentations.find((presentation) => {
      if (presentation.coverageKind !== "visual_page") {
        return false;
      }
      const coverageKey = presentation.coverageKey ?? presentation.chunkKey;
      return (
        coverageKey === pageKey && (presentation.retainedUntilMs === undefined || presentation.retainedUntilMs > nowMs)
      );
    });
  }

  private getVisualTerrainTargetCoverageKeys(): Set<string> {
    return new Set(this.visualTerrainWindowPageKeys);
  }

  private async prepareVisualTerrainPage(
    pageKey: string,
    workLane: FrameBudgetWorkLane,
  ): Promise<{
    phaseTimings: Pick<VisualTerrainPagePhaseTimings, "cpuBuildMs" | "modelWaitMs">;
    preparedTerrain: PreparedTerrainChunk;
  }> {
    const [startRow, startCol] = pageKey.split(",").map(Number);
    if (!Number.isFinite(startRow) || !Number.isFinite(startCol)) {
      throw new Error(`Invalid visual terrain page key: ${pageKey}`);
    }

    let cpuBuildMs = 0;
    const preparedTerrain = await this.chunkWorkQueue.schedule(
      workLane,
      () => {
        const buildStartedAt = performance.now();
        const result = this.buildPreparedTerrainArea(
          startRow,
          startCol,
          WORLDMAP_CHUNK_POLICY.visualPresentation.visualPageSize.height,
          WORLDMAP_CHUNK_POLICY.visualPresentation.visualPageSize.width,
        );
        cpuBuildMs = performance.now() - buildStartedAt;
        return result;
      },
      `terrain:${workLane}-page-build`,
    );
    return {
      preparedTerrain,
      phaseTimings: {
        cpuBuildMs,
        modelWaitMs: 0,
      },
    };
  }

  private buildPreparedTerrainArea(
    startRow: number,
    startCol: number,
    rows: number,
    cols: number,
  ): PreparedTerrainChunk {
    const totalHexes = rows * cols;
    const { row: centerRow, col: centerCol } = this.getChunkCenter(startRow, startCol);
    const snapshot = snapshotExploredTilesRegion(this.exploredTiles, {
      centerCol,
      centerRow,
      halfCols: cols / 2,
      halfRows: rows / 2,
    });
    const terrainCells: WorldmapTerrainSourceCellRef[] = [];
    const fingerprintEntries: WorldmapTerrainSourceCellRef[] = [];
    const instanceCounts = new Map<string, number>();
    let expectedExploredTerrainInstances = 0;

    for (let index = 0; index < totalHexes; index += 1) {
      const rowOffset = Math.floor(index / cols) - rows / 2;
      const colOffset = (index % cols) - cols / 2;
      const row = centerRow + rowOffset;
      const col = centerCol + colOffset;
      const projectedBiome = lookupSnapshotBiome(snapshot, col, row) || false;
      const effectivelyExplored = projectedBiome || this.simulateAllExplored;
      const biome = effectivelyExplored
        ? projectedBiome
          ? (projectedBiome as BiomeType)
          : this.perfSimulation!.getSimulatedBiome(col, row)
        : null;
      const biomeKey = biome ?? "Outline";
      const instanceIndex = instanceCounts.get(biomeKey) ?? 0;
      const occupied = this.isProjectedStructureHex(col, row);
      instanceCounts.set(biomeKey, instanceIndex + 1);
      const cell = { biomeKey, col, instanceIndex, occupied, row };
      terrainCells.push(cell);

      if (biome) {
        expectedExploredTerrainInstances += 1;
        fingerprintEntries.push(cell);
      }
    }

    return {
      biomeEntries: new Map(),
      bounds: this.computeChunkBounds(startRow, startCol),
      chunkKey: String(startRow) + "," + String(startCol),
      expectedExploredTerrainInstances,
      startCol,
      startRow,
      terrainCells,
      terrainFingerprint: createWorldmapTerrainFingerprint(fingerprintEntries),
    };
  }

  private disposePreparedTerrainChunk(preparedTerrain: PreparedTerrainChunk): void {
    void preparedTerrain;
  }

  private async schedulePreparedTerrainCommit<TResult>(
    workLane: FrameBudgetWorkLane,
    preparedTerrain: PreparedTerrainChunk,
    commit: () => TResult,
  ): Promise<TResult> {
    let commitStarted = false;
    try {
      return await this.chunkWorkQueue.schedule(
        workLane,
        () => {
          commitStarted = true;
          return commit();
        },
        `terrain:${workLane}-commit`,
      );
    } catch (error) {
      if (!commitStarted) {
        this.disposePreparedTerrainChunk(preparedTerrain);
      }
      throw error;
    }
  }

  private ensureCurrentExactTerrainPresentation(transitionToken: number): void {
    if (
      this.currentChunk === "null" ||
      this.visualTerrainPresentationState.presentations.some((presentation) =>
        presentation.cells.some((cell) => cell.authoritative),
      )
    ) {
      return;
    }

    const [currentStartRow, currentStartCol] = this.currentChunk.split(",").map(Number);
    if (!Number.isFinite(currentStartRow) || !Number.isFinite(currentStartCol)) {
      return;
    }

    const preparedTerrain = this.createPreparedTerrainChunkFromCache(currentStartRow, currentStartCol);
    if (!preparedTerrain) {
      return;
    }

    this.applyTerrainPresentation(
      this.createTerrainPresentationFromPreparedTerrain(preparedTerrain, {
        authoritative: true,
        claimBiomeEntries: true,
        kind: "exact",
        transitionToken,
      }),
      {
        targetChunkKey: this.currentChunk,
      },
    );
  }

  private startChunkSwitchTerrainShell(input: WorldmapChunkSwitchTerrainShellInput): void {
    if (!WORLDMAP_CHUNK_POLICY.visualPresentation.provisionalShellEnabled) {
      return;
    }

    this.ensureCurrentExactTerrainPresentation(input.transitionToken);
    this.traceChunk("terrain_shell_started", {
      chunkKey: input.chunkKey,
      transitionToken: input.transitionToken,
    });
    incrementWorldmapRenderCounter("terrainShellStarted");

    void this.commitChunkSwitchTerrainShell(input);
  }

  private async commitChunkSwitchTerrainShell(input: WorldmapChunkSwitchTerrainShellInput): Promise<void> {
    try {
      await this.prepareAndApplyChunkSwitchTerrainShell(input);
    } catch (error) {
      if (isFrameBudgetWorkQueueDisposedError(error)) {
        return;
      }
      console.warn("[WorldMap] Failed to build chunk switch terrain shell:", error);
    }
  }

  private async prepareAndApplyChunkSwitchTerrainShell(input: WorldmapChunkSwitchTerrainShellInput): Promise<void> {
    const exactJoin = await this.exactTerrainPreparations.waitForExact({
      chunkKey: input.chunkKey,
      transitionToken: input.transitionToken,
      timeoutMs: WORLDMAP_EXACT_TERRAIN_JOIN_BUDGET_MS,
      isExactReady: (result) => result.projectionSyncSucceeded && result.preparedTerrain !== null,
    });
    if (exactJoin.status === "exact_ready" || !this.isCurrentChunkSwitchTerrainShell(input)) {
      return;
    }

    const cachedTerrain = this.createPreparedTerrainChunkFromCache(input.startRow, input.startCol);
    const preparedTerrain =
      cachedTerrain ??
      (await this.prepareTerrainChunk(
        input.startRow,
        input.startCol,
        this.renderChunkSize.height,
        this.renderChunkSize.width,
      ));
    const kind: WorldmapTerrainPresentationKind = cachedTerrain ? "exact" : "provisional";
    await this.schedulePreparedTerrainCommit("critical", preparedTerrain, () =>
      this.applyChunkSwitchTerrainShell(input, preparedTerrain, kind),
    );
  }

  private isCurrentChunkSwitchTerrainShell(input: WorldmapChunkSwitchTerrainShellInput): boolean {
    return !this.isSwitchedOff && input.transitionToken === this.chunkTransitionToken;
  }

  private applyChunkSwitchTerrainShell(
    input: WorldmapChunkSwitchTerrainShellInput,
    preparedTerrain: PreparedTerrainChunk,
    kind: WorldmapTerrainPresentationKind,
  ): void {
    const presentations = this.partitionPreparedTerrainIntoVisualPagesForPresentation(preparedTerrain, {
      authoritative: false,
      authorityChunkKey: kind === "exact" ? input.chunkKey : null,
      claimBiomeEntries: true,
      generation: this.visualTerrainGeneration,
      kind,
      transitionToken: input.transitionToken,
    });

    if (
      this.visualTerrainPresentationState.presentations.some(
        (existingPresentation) =>
          existingPresentation.authorityChunkKey === input.chunkKey &&
          existingPresentation.cells.some((cell) => cell.authoritative),
      )
    ) {
      presentations.forEach((presentation) => this.disposeTerrainPresentation(presentation));
      this.traceChunk("terrain_shell_stale_dropped", {
        chunkKey: input.chunkKey,
        reason: "authoritative_exact_already_committed",
        transitionToken: input.transitionToken,
      });
      incrementWorldmapRenderCounter("terrainShellStaleDropped");
      return;
    }

    const appliedPresentations = presentations.filter((presentation) =>
      this.applyVisualTerrainPagePresentation(presentation, {
        allowOutsideWindow: true,
        latestTransitionToken: this.chunkTransitionToken,
      }),
    );
    const committedCellCount = appliedPresentations.reduce(
      (count, presentation) => count + presentation.cells.length,
      0,
    );
    if (committedCellCount === 0) {
      return;
    }
    void this.requestVisualTerrainCompositeCommit();

    this.traceChunk("terrain_shell_committed", {
      cellCount: committedCellCount,
      chunkKey: input.chunkKey,
      kind,
      transitionToken: input.transitionToken,
    });
    incrementWorldmapRenderCounter("terrainShellCommitted");
  }

  /** Mutates the presentation state only; the composite is committed once per batch via requestVisualTerrainCompositeCommit. */
  private applyVisualTerrainPagePresentation(
    presentation: WorldmapTerrainPresentationEntry,
    options: { allowOutsideWindow?: boolean; latestTransitionToken?: number } = {},
  ): boolean {
    const previousPresentations = [...this.visualTerrainPresentationState.presentations];
    const coverageKey = presentation.coverageKey ?? presentation.chunkKey;
    const targetCoverageKeys = this.getVisualTerrainTargetCoverageKeys();
    if (options.allowOutsideWindow || targetCoverageKeys.size === 0) {
      targetCoverageKeys.add(coverageKey);
    }
    const replacedProvisional = previousPresentations.some(
      (existingPresentation) =>
        existingPresentation.coverageKind === "visual_page" &&
        (existingPresentation.coverageKey ?? existingPresentation.chunkKey) === coverageKey &&
        existingPresentation.kind === "provisional" &&
        presentation.kind === "exact",
    );
    const status = applyWorldmapVisualTerrainPage(this.visualTerrainPresentationState, {
      authoritativeChunkKey: this.currentChunk === "null" ? null : this.currentChunk,
      latestGeneration: presentation.generation ?? this.visualTerrainGeneration,
      latestTransitionToken: options.latestTransitionToken,
      maxCompositePages: WORLDMAP_CHUNK_POLICY.visualPresentation.maxCompositePages,
      nowMs: performance.now(),
      presentation,
      targetCoverageKeys,
    });

    if (status === "stale_dropped") {
      this.disposeTerrainPresentation(presentation);
      this.traceChunk("visual_page_stale_dropped", {
        coverageKey,
        currentGeneration: this.visualTerrainGeneration,
        generation: presentation.generation,
        kind: presentation.kind,
      });
      incrementWorldmapRenderCounter("visualPageStaleDropped");
      return false;
    }

    this.disposeDroppedTerrainPresentations(previousPresentations, this.visualTerrainPresentationState.presentations);
    this.traceChunk("visual_page_committed", {
      cellCount: presentation.cells.length,
      coverageKey,
      generation: presentation.generation,
      kind: presentation.kind,
    });
    incrementWorldmapRenderCounter("visualPageCommitted");

    if (replacedProvisional) {
      this.traceChunk("visual_page_replaced", {
        coverageKey,
        generation: presentation.generation,
      });
      incrementWorldmapRenderCounter("visualPageReplaced");
    }

    return true;
  }

  private deferNonCriticalManagerCatchUpForChunk(
    chunkKey: string,
    options?: {
      force?: boolean;
      transitionToken?: number;
    },
  ): void {
    if (!WORLDMAP_STREAMING_ROLLOUT.stagedPathEnabled) {
      void this.updateNonCriticalManagersForChunk(chunkKey, options).catch((error) => {
        console.error("[WorldMap] Legacy non-critical manager catch-up failed:", error);
      });
      return;
    }

    const uploadWork = classifyWorldmapUploadWork({
      matrixInstanceCount: this.chestManager.getVisibleCount(),
      colorInstanceCount: 0,
      isCachedReplay: false,
      stage: "visible_commit",
    });
    const postCommitWorkAction = resolveWorldmapPostCommitWorkAction({
      estimatedUploadBytes: uploadWork.estimatedUploadBytes,
      budgetBytes: this.postCommitManagerCatchUpBudgetBytes,
    });

    enqueueWorldmapPostCommitManagerCatchUpTask({
      state: this.postCommitManagerCatchUpRuntimeState,
      task: {
        chunkKey,
        options,
        estimatedUploadBytes: uploadWork.estimatedUploadBytes,
        deferredCount: postCommitWorkAction === "deferred" ? 0 : undefined,
      },
    });
    this.schedulePostCommitManagerCatchUpDrain();
  }

  private schedulePostCommitManagerCatchUpDrain(): void {
    scheduleWorldmapPostCommitManagerCatchUpDrain({
      onDrain: () => {
        this.drainPostCommitManagerCatchUpQueue();
      },
      requestAnimationFrameFn:
        typeof window.requestAnimationFrame === "function"
          ? (callback) => window.requestAnimationFrame(() => callback())
          : undefined,
      setTimeoutFn: (callback, delayMs) => window.setTimeout(callback, delayMs) as unknown as number,
      state: this.postCommitManagerCatchUpRuntimeState,
    });
  }

  private deferNonCriticalManagerCatchUpForCommittedChunk(
    chunkKey: string,
    options?: {
      force?: boolean;
      transitionToken?: number;
    },
  ): void {
    this.deferNonCriticalManagerCatchUpForChunk(chunkKey, {
      ...options,
      // Critical visible managers already caught up to the committed chunk.
      // Let the deferred fanout refresh only the remaining non-critical work.
      force: false,
    });
  }

  private drainPostCommitManagerCatchUpQueue(): void {
    void drainWorldmapPostCommitManagerCatchUpQueue({
      budgetBytes: this.postCommitManagerCatchUpBudgetBytes,
      onHeadDeferred: () => {
        incrementWorldmapRenderCounter("postCommitManagerCatchUpDeferred");
      },
      onImmediateTask: () => {
        incrementWorldmapRenderCounter("postCommitManagerCatchUpImmediate");
      },
      onTaskError: (_task, error) => {
        console.error("[WorldMap] Deferred manager catch-up failed:", error);
      },
      onTaskSkipped: (task) => {
        // The task was dropped because its chunk/token went stale (e.g. a fast
        // pan or a stall that bumped the transition token). Re-enqueue a fresh
        // non-critical catch-up for the current committed chunk so the chest
        // render is never silently lost. Loop-safe: only when the current chunk
        // actually differs from the skipped one and isn't already queued (a
        // matching chunk+token would not have been skipped in the first place).
        const currentChunk = this.currentChunk;
        if (
          currentChunk &&
          currentChunk !== task.chunkKey &&
          isCommittedManagerChunk(currentChunk) &&
          !this.postCommitManagerCatchUpRuntimeState.queue.some((queued) => queued.chunkKey === currentChunk)
        ) {
          this.deferNonCriticalManagerCatchUpForCommittedChunk(currentChunk, {
            transitionToken: this.chunkTransitionToken,
          });
        }
      },
      runTask: (task) => this.updateNonCriticalManagersForChunk(task.chunkKey, task.options),
      scheduleDrain: () => {
        this.schedulePostCommitManagerCatchUpDrain();
      },
      shouldRunTask: (task) =>
        shouldRunManagerUpdate({
          transitionToken: task.options?.transitionToken,
          expectedTransitionToken: this.chunkTransitionToken,
          currentChunk: this.currentChunk,
          targetChunk: task.chunkKey,
        }),
      state: this.postCommitManagerCatchUpRuntimeState,
    });
  }

  private clearStreamingWorkState(): void {
    clearWorldmapPostCommitManagerCatchUpState({
      cancelAnimationFrameFn:
        typeof window.cancelAnimationFrame === "function" ? (handle) => window.cancelAnimationFrame(handle) : undefined,
      clearTimeoutFn: (handle) => window.clearTimeout(handle),
      state: this.postCommitManagerCatchUpRuntimeState,
      usesAnimationFrame: typeof window.cancelAnimationFrame === "function",
    });
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
    this.clearVisualTerrainPresentations();
    for (const chunkKey of this.cachedMatrices.keys()) {
      this.disposeCachedMatrices(chunkKey);
    }
    this.cachedMatrices.clear();
    this.cachedMatrixOrder = [];
    this.exploredTiles.clear();
    this.exploredTilesGeneration.clear();
    gameWorkerManager.resetWorldState();
    this.pinnedChunkKeys.clear();
  }

  private scheduleHydratedChunkRefresh(chunkKey: string) {
    queueWorldmapHydratedChunkRefresh({
      chunkKey,
      scheduleFlush: () => this.scheduleHydratedRefreshFlush(),
      state: this.hydratedRefreshQueueState,
    });
  }

  private scheduleHydratedRefreshFlush(): void {
    Promise.resolve().then(() => {
      const activeFlush = this.hydratedRefreshQueueState.activeFlushPromise;
      if (activeFlush) {
        void activeFlush
          .catch(() => undefined)
          .finally(() => {
            void this.flushHydratedChunkRefreshes();
          });
        return;
      }

      void this.flushHydratedChunkRefreshes();
    });
  }

  private flushHydratedChunkRefreshes(): Promise<void> {
    return trackWorldmapHydratedRefreshQueueFlush(this.hydratedRefreshQueueState, async () => {
      await flushWorldmapHydratedChunkRefreshQueue({
        awaitActiveChunkSwitch: this.globalChunkSwitchPromise
          ? async () => {
              await this.globalChunkSwitchPromise;
            }
          : undefined,
        currentChunk: this.currentChunk,
        isChunkTransitioning: this.isChunkTransitioning,
        onAfterRefresh: () => undefined,
        queueFlush: () => this.scheduleHydratedRefreshFlush(),
        refreshCurrentChunk: async () => {
          const refreshToken = this.requestChunkRefresh(true, "hydrated_chunk");
          await this.waitForRequestedChunkRefresh(refreshToken);
        },
        reportRefreshError: (currentChunk, error) => {
          console.error(`[CHUNK SYNC] Hydrated chunk refresh failed for ${currentChunk}`, error);
        },
        state: this.hydratedRefreshQueueState,
        warn: (message, error) => {
          console.warn(message, error);
        },
      });
    });
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
    const preparedTerrain = this.buildPreparedTerrainArea(startRow, startCol, rows, cols);
    this.applyPreparedTerrainChunk(preparedTerrain);
    this.computeInteractiveHexes(startRow, startCol, cols, rows);
  }

  private createPreparedTerrainChunkFromCache(startRow: number, startCol: number): PreparedTerrainChunk | null {
    const chunkKey = `${startRow},${startCol}`;
    const cachedMatrices = this.cachedMatrices.get(chunkKey);
    if (!cachedMatrices) {
      return null;
    }

    const cachedMetadata = cachedMatrices.get("__meta__");
    const cachedTerrainCells = cachedMetadata?.terrainCells ?? [];
    const totalCachedTerrainInstances = cachedTerrainCells.length;
    const cachedExploredTerrainInstances = cachedTerrainCells.filter((cell) => cell.biomeKey !== "Outline").length;
    if (isTerrainCacheStale(cachedMetadata?.generation, this.exploredTilesGeneration.current(chunkKey))) {
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
      terrainCells: cachedMetadata?.terrainCells ?? [],
      biomeEntries: new Map(),
    };
  }

  private async prepareTerrainChunk(
    startRow: number,
    startCol: number,
    rows: number,
    cols: number,
    workLane: FrameBudgetWorkLane = "critical",
  ): Promise<PreparedTerrainChunk> {
    const cachedChunk = this.createPreparedTerrainChunkFromCache(startRow, startCol);
    if (cachedChunk) {
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "prepared_chunk_prewarm_hit");
      incrementWorldmapRenderCounter("preparedChunkPrewarmHits");
      return cachedChunk;
    }

    recordChunkDiagnosticsEvent(this.chunkDiagnostics, "prepared_chunk_prewarm_miss");
    incrementWorldmapRenderCounter("preparedChunkPrewarmMisses");
    return this.chunkWorkQueue.schedule(
      workLane,
      () => this.buildPreparedTerrainArea(startRow, startCol, rows, cols),
      `terrain:${workLane}-prepare`,
    );
  }

  private createTerrainPresentationFromPreparedTerrain(
    preparedTerrain: PreparedTerrainChunk,
    input: {
      authoritative: boolean;
      authorityChunkKey?: string | null;
      claimBiomeEntries: boolean;
      coverageKey?: string;
      coverageKind?: "chunk" | "visual_page";
      generation?: number;
      kind: WorldmapTerrainPresentationKind;
      transitionToken: number;
    },
  ): WorldmapTerrainPresentationEntry {
    return {
      chunkKey: preparedTerrain.chunkKey,
      coverageKey: input.coverageKey ?? preparedTerrain.chunkKey,
      coverageKind: input.coverageKind ?? "chunk",
      authorityChunkKey: input.authorityChunkKey ?? preparedTerrain.chunkKey,
      kind: input.kind,
      generation: input.generation,
      transitionToken: input.transitionToken,
      bounds: {
        box: preparedTerrain.bounds.box.clone(),
        sphere: preparedTerrain.bounds.sphere.clone(),
      },
      biomeEntries: new Map(),
      cells: preparedTerrain.terrainCells.map((cell): WorldmapTerrainCellRef => {
        return {
          ...cell,
          authoritative: input.authoritative,
        };
      }),
    };
  }

  private partitionPreparedTerrainIntoVisualPagesForPresentation(
    preparedTerrain: PreparedTerrainChunk,
    input: {
      authoritative: boolean;
      authorityChunkKey: string | null;
      claimBiomeEntries: boolean;
      generation: number;
      kind: WorldmapTerrainPresentationKind;
      transitionToken: number;
    },
  ): WorldmapTerrainPresentationEntry[] {
    const pagePresentations = partitionPreparedTerrainIntoVisualPages({
      authorityChunkKey: input.authorityChunkKey,
      biomeEntries: new Map<string, CachedTerrainEntry>(),
      bounds: {
        box: preparedTerrain.bounds.box.clone(),
        sphere: preparedTerrain.bounds.sphere.clone(),
      },
      cells: preparedTerrain.terrainCells.map((cell): WorldmapTerrainCellRef => {
        return {
          ...cell,
          authoritative: input.authoritative,
        };
      }),
      generation: input.generation,
      kind: input.kind,
      pageOrigin: this.getVisualTerrainPageOrigin(),
      pageSize: WORLDMAP_CHUNK_POLICY.visualPresentation.visualPageSize,
      transitionToken: input.transitionToken,
    });

    return pagePresentations;
  }

  private getTerrainCompositeCellCapacity(): number {
    return (
      this.renderChunkSize.width * this.renderChunkSize.height +
      WORLDMAP_CHUNK_POLICY.visualPresentation.visualPageSize.width *
        WORLDMAP_CHUNK_POLICY.visualPresentation.visualPageSize.height *
        WORLDMAP_CHUNK_POLICY.visualPresentation.maxCompositePages
    );
  }

  private disposeTerrainPresentation(presentation: WorldmapTerrainPresentationEntry): void {
    void presentation;
  }

  private disposeDroppedTerrainPresentations(
    previousPresentations: readonly WorldmapTerrainPresentationEntry[],
    nextPresentations: readonly WorldmapTerrainPresentationEntry[],
  ): void {
    const nextBiomeEntries = new Set(nextPresentations.map((presentation) => presentation.biomeEntries));
    previousPresentations.forEach((presentation) => {
      if (!nextBiomeEntries.has(presentation.biomeEntries)) {
        if (presentation.coverageKind === "visual_page") {
          this.traceChunk("visual_page_evicted", {
            coverageKey: presentation.coverageKey ?? presentation.chunkKey,
            generation: presentation.generation,
            kind: presentation.kind,
          });
          incrementWorldmapRenderCounter("visualPageEvicted");
        }
        this.disposeTerrainPresentation(presentation);
      }
    });
  }

  private applyTerrainPresentation(
    presentation: WorldmapTerrainPresentationEntry,
    input: {
      retainPreviousExactUntilMs?: number;
      targetChunkKey: string;
    },
  ): void {
    const previousPresentations = [...this.visualTerrainPresentationState.presentations];
    const status = applyWorldmapTerrainPresentation(this.visualTerrainPresentationState, {
      authoritativeChunkKey: this.currentChunk === "null" ? null : this.currentChunk,
      latestTransitionToken: this.chunkTransitionToken,
      maxCompositeChunks: WORLDMAP_CHUNK_POLICY.visualPresentation.maxCompositeChunks,
      nowMs: performance.now(),
      presentation,
      presentations: this.visualTerrainPresentationState.presentations,
      retainPreviousExactUntilMs: input.retainPreviousExactUntilMs,
      targetChunkKey: input.targetChunkKey,
    });

    if (status === "stale_dropped") {
      this.disposeTerrainPresentation(presentation);
      this.traceChunk("terrain_shell_stale_dropped", {
        chunkKey: presentation.chunkKey,
        kind: presentation.kind,
        transitionToken: presentation.transitionToken,
        currentTransitionToken: this.chunkTransitionToken,
      });
      incrementWorldmapRenderCounter("terrainShellStaleDropped");
      return;
    }

    this.disposeDroppedTerrainPresentations(previousPresentations, this.visualTerrainPresentationState.presentations);
    void this.requestVisualTerrainCompositeCommit();
  }

  private rebuildTerrainPresentationComposite(targetChunkKey: string | null = this.currentChunk): void {
    const previousPresentations = [...this.visualTerrainPresentationState.presentations];
    const targetCoverageKeys = this.getVisualTerrainTargetCoverageKeys();
    const maxPresentations = WORLDMAP_CHUNK_POLICY.visualPresentation.rollingWindowEnabled
      ? WORLDMAP_CHUNK_POLICY.visualPresentation.maxCompositePages
      : WORLDMAP_CHUNK_POLICY.visualPresentation.maxCompositeChunks;
    this.visualTerrainPresentationState.presentations = getPrioritizedWorldmapTerrainPresentations({
      authoritativeChunkKey: this.currentChunk === "null" ? null : this.currentChunk,
      nowMs: performance.now(),
      presentations: this.visualTerrainPresentationState.presentations,
      targetCoverageKeys,
      targetChunkKey,
    }).slice(0, maxPresentations);

    this.disposeDroppedTerrainPresentations(previousPresentations, this.visualTerrainPresentationState.presentations);
    void this.requestVisualTerrainCompositeCommit();
  }

  /** One composite per batch of page applies, committed in the frame-budget critical lane. */
  private requestVisualTerrainCompositeCommit(): Promise<WorldmapTerrainPresentationComposite | null> {
    if (this.pendingVisualTerrainCompositeCommit) {
      return this.pendingVisualTerrainCompositeCommit;
    }
    const commit = this.chunkWorkQueue
      .schedule("critical", () => this.commitVisualTerrainComposite(), "terrain:composite")
      .catch((error: unknown) => {
        if (isFrameBudgetWorkQueueDisposedError(error)) return null;
        throw error;
      })
      .finally(() => {
        if (this.pendingVisualTerrainCompositeCommit === commit) this.pendingVisualTerrainCompositeCommit = null;
      });
    this.pendingVisualTerrainCompositeCommit = commit;
    return commit;
  }

  private commitVisualTerrainComposite(): WorldmapTerrainPresentationComposite {
    const composite = composeWorldmapTerrainPresentations({
      authoritativeChunkKey: this.currentChunk === "null" ? null : this.currentChunk,
      maxCells: this.getTerrainCompositeCellCapacity(),
      nowMs: performance.now(),
      presentations: this.visualTerrainPresentationState.presentations,
      targetCoverageKeys: this.getVisualTerrainTargetCoverageKeys(),
      targetChunkKey: this.currentChunk,
    });
    // Composing and presenting are separate budgeted tasks so neither alone exceeds the frame budget.
    void this.chunkWorkQueue
      .schedule("critical", () => this.applyTerrainPresentationComposite(composite), "terrain:composite:present")
      .catch((error: unknown) => {
        if (!isFrameBudgetWorkQueueDisposedError(error)) throw error;
      });
    return composite;
  }

  private applyTerrainPresentationComposite(composite: WorldmapTerrainPresentationComposite): void {
    const { roadAnchors, settlementAnchors } = this.collectVisibleTerrainEcologyAnchors(composite.cells);
    const presentation = this.proceduralTerrain
      .presentAsync(
        {
          cells: composite.cells.map((cell) => ({
            biomeKey: cell.biomeKey,
            col: cell.col,
            occupied: this.isProjectedStructureHex(cell.col, cell.row),
            row: cell.row,
          })),
          climate: configManager.getBiomeClimateConfig() ?? NEUTRAL_BIOME_CLIMATE,
          mapCenter: configManager.getMapCenter(),
          pageHeight: WORLDMAP_CHUNK_POLICY.visualPresentation.visualPageSize.height,
          pageOrigin: this.getVisualTerrainPageOrigin(),
          pageWidth: WORLDMAP_CHUNK_POLICY.visualPresentation.visualPageSize.width,
          roadAnchors,
          settlementAnchors,
          subdivisions: 2,
        },
        this.chunkWorkQueue,
      )
      .then((terrainDiagnostics) => {
        if (!terrainDiagnostics) return;
        recordWorldmapRenderDuration("terrainPreparedMs", terrainDiagnostics.prepareMs);
        incrementWorldmapRenderCounter("biomeMismatchCount", terrainDiagnostics.biomeMismatchCount);
        this.traceChunk("terrain_composite_rebuilt", {
          capped: composite.capped,
          cellCount: composite.cells.length,
          droppedCellCount: composite.droppedCellCount,
          proceduralBuiltPages: terrainDiagnostics.builtPages,
          proceduralPreparedCachePages: terrainDiagnostics.preparedCachePages,
          proceduralPrepareMs: terrainDiagnostics.prepareMs,
          proceduralReusedPages: terrainDiagnostics.reusedPages,
          proceduralRoadSegments: terrainDiagnostics.roadSegments,
          proceduralTriangles: terrainDiagnostics.triangles + terrainDiagnostics.propTriangles,
          proceduralVertices: terrainDiagnostics.vertices,
          presentationChunkKeys: composite.presentationChunkKeys,
        });
        incrementWorldmapRenderCounter("terrainCompositeRebuilt");
        this.requestShadowContentRefresh();
      })
      .catch((error) => {
        if (!this.isSwitchedOff) console.error("[WorldMap] Procedural terrain presentation failed", error);
        throw error;
      });
    this.terrainPresentationPromise = presentation;
    void presentation.catch(() => undefined);
  }

  private collectVisibleTerrainEcologyAnchors(cells: readonly { biomeKey: string; col: number; row: number }[]): {
    roadAnchors: TerrainRoadAnchor[];
    settlementAnchors: TerrainSettlementAnchor[];
  } {
    const visibleCells = new Set<number>();
    const localBounds = {
      maxCol: Number.NEGATIVE_INFINITY,
      maxRow: Number.NEGATIVE_INFINITY,
      minCol: Number.POSITIVE_INFINITY,
      minRow: Number.POSITIVE_INFINITY,
    };
    for (const { biomeKey, col, row } of cells) {
      if (biomeKey === "Outline" || biomeKey === "Empty") continue;
      visibleCells.add(hexCellKey(col, row));
      localBounds.maxCol = Math.max(localBounds.maxCol, col);
      localBounds.maxRow = Math.max(localBounds.maxRow, row);
      localBounds.minCol = Math.min(localBounds.minCol, col);
      localBounds.minRow = Math.min(localBounds.minRow, row);
    }
    if (visibleCells.size === 0) return { roadAnchors: [], settlementAnchors: [] };

    const roadAnchors: TerrainRoadAnchor[] = [];
    const settlementAnchors: TerrainSettlementAnchor[] = [];
    for (const structure of this.worldSpatialProjection.getStructuresInBounds(this.toContractBounds(localBounds))) {
      if (structure.reserved || structure.entityId === null) continue;
      const normalized = new Position({ x: structure.hexCoords.col, y: structure.hexCoords.row }).getNormalized();
      if (!visibleCells.has(hexCellKey(normalized.x, normalized.y))) continue;
      const component = getComponentValue(this.dojo.components.Structure, gameEntityKey([BigInt(structure.entityId)]));
      if (!component) continue;
      const structureId = structure.entityId.toString();
      settlementAnchors.push({
        col: normalized.x,
        level: component.base.level,
        row: normalized.y,
        structureId,
        structureType: component.base.category as StructureType,
      });
      const owner = ContractAddress(component.owner);
      if (owner === 0n) continue;
      roadAnchors.push({
        col: normalized.x,
        owner: owner.toString(),
        row: normalized.y,
        structureId,
      });
    }
    return { roadAnchors, settlementAnchors };
  }

  private scheduleTerrainEcologyRefresh(): void {
    if (this.visualTerrainPresentationState.presentations.length === 0) return;
    if (this.refreshVisualTerrainWindowThrottled) this.refreshVisualTerrainWindowThrottled();
    else this.rebuildTerrainPresentationComposite();
  }

  private scheduleTerrainPresentationRetentionCleanup(
    delayMs = WORLDMAP_CHUNK_POLICY.visualPresentation.previousExactRetainMs,
  ): void {
    if (this.visualTerrainRetentionTimeout !== null) {
      window.clearTimeout(this.visualTerrainRetentionTimeout);
    }

    this.visualTerrainRetentionTimeout = window.setTimeout(() => {
      this.visualTerrainRetentionTimeout = null;
      this.rebuildTerrainPresentationComposite(this.currentChunk);
    }, delayMs);
  }

  private clearVisualTerrainPresentations(): void {
    if (this.visualTerrainRetentionTimeout !== null) {
      window.clearTimeout(this.visualTerrainRetentionTimeout);
      this.visualTerrainRetentionTimeout = null;
    }
    this.queuedVisualTerrainBuildPageKeys.clear();
    this.activeVisualTerrainBuildPageKeys.clear();
    this.visualTerrainPageRevisions.clear();
    this.liveTilePageRebuilds.clear();
    this.visualTerrainWindow = null;
    this.visualTerrainWindowPageKeys.clear();
    this.visualTerrainPresentationState.presentations.forEach((presentation) =>
      this.disposeTerrainPresentation(presentation),
    );
    this.visualTerrainPresentationState.presentations = [];
    this.proceduralTerrain.clear();
  }

  private cachePreparedTerrainChunk(preparedTerrain: PreparedTerrainChunk): void {
    const chunkKey = preparedTerrain.chunkKey;
    this.disposeCachedMatrices(chunkKey);

    const cachedChunk = new Map<string, CachedTerrainEntry>();
    cachedChunk.set("__bounds__", {
      box: preparedTerrain.bounds.box.clone(),
      sphere: preparedTerrain.bounds.sphere.clone(),
    });
    cachedChunk.set("__meta__", {
      expectedExploredTerrainInstances: preparedTerrain.expectedExploredTerrainInstances,
      terrainFingerprint: preparedTerrain.terrainFingerprint,
      terrainCells: preparedTerrain.terrainCells,
      generation: this.exploredTilesGeneration.current(chunkKey),
    });

    this.cachedMatrices.set(chunkKey, cachedChunk);
    this.touchMatrixCache(chunkKey);
    this.ensureMatrixCacheLimit();
  }

  private applyPreparedTerrainChunk(preparedTerrain: PreparedTerrainChunk): void {
    const replacedShell = this.visualTerrainPresentationState.presentations.some(
      (presentation) =>
        presentation.authorityChunkKey === preparedTerrain.chunkKey && presentation.kind === "provisional",
    );
    const exactPresentations = this.partitionPreparedTerrainIntoVisualPagesForPresentation(preparedTerrain, {
      authoritative: true,
      authorityChunkKey: preparedTerrain.chunkKey,
      claimBiomeEntries: false,
      generation: this.visualTerrainGeneration,
      kind: "exact",
      transitionToken: this.chunkTransitionToken,
    });
    this.cachePreparedTerrainChunk(preparedTerrain);
    exactPresentations.forEach((exactPresentation) => {
      this.applyVisualTerrainPagePresentation(exactPresentation, {
        allowOutsideWindow: true,
        latestTransitionToken: this.chunkTransitionToken,
      });
    });
    void this.requestVisualTerrainCompositeCommit();
    if (replacedShell) {
      this.traceChunk("terrain_shell_replaced", {
        chunkKey: preparedTerrain.chunkKey,
        transitionToken: this.chunkTransitionToken,
      });
      this.traceChunk("visual_page_replaced", {
        chunkKey: preparedTerrain.chunkKey,
        generation: this.visualTerrainGeneration,
        kind: "exact",
      });
      incrementWorldmapRenderCounter("terrainShellReplaced");
      incrementWorldmapRenderCounter("visualPageReplaced");
    }
    this.scheduleTerrainPresentationRetentionCleanup();
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
    const pinnedAreasChanged =
      nextPinnedAreas.size !== this.pinnedRenderAreas.size ||
      [...nextPinnedAreas].some((areaKey) => !this.pinnedRenderAreas.has(areaKey));
    prevPinned.forEach((chunkKey) => {
      if (!nextPinned.has(chunkKey)) {
        removedPinnedChunks.push(chunkKey);
      }
    });

    this.pinnedChunkKeys = nextPinned;
    this.pinnedRenderAreas = nextPinnedAreas;
    this.pruneQueuedDirectionalPrefetches();
    if (pinnedAreasChanged) {
      this.pruneWorldmapSpatialCaches();
      this.rebuildPathfindingWorkerState();
    }

    removedPinnedChunks.forEach((chunkKey) => {
      if (chunkKey !== this.currentChunk) {
        this.visibilityManager?.unregisterChunk(chunkKey);
      }
    });
  }

  private getRetainedRenderAreaBounds(): WorldmapLocalBounds[] {
    const retainedAreaKeys = new Set([...this.pinnedRenderAreas, ...this.directionalPrefetchAreaKeys]);
    if (this.currentChunk !== "null") {
      retainedAreaKeys.add(this.getRenderAreaKeyForChunk(this.currentChunk));
    }
    return [...retainedAreaKeys].map((areaKey) => this.getRenderFetchBoundsForArea(areaKey));
  }

  private isHexInRetainedRenderArea(
    col: number,
    row: number,
    retainedBounds: readonly WorldmapLocalBounds[] = this.getRetainedRenderAreaBounds(),
  ): boolean {
    return isHexInsideAnyBounds(col, row, retainedBounds);
  }

  private pruneWorldmapSpatialCaches(): void {
    const retainedBounds = this.getRetainedRenderAreaBounds();
    this.pruneExploredTilesOutsideBounds(retainedBounds);
    this.retainActiveTerrainGenerations();
  }

  private pruneExploredTilesOutsideBounds(retainedBounds: readonly WorldmapLocalBounds[]): void {
    for (const [col, rows] of this.exploredTiles) {
      for (const row of rows.keys()) {
        if (!this.isHexInRetainedRenderArea(col, row, retainedBounds)) {
          rows.delete(row);
        }
      }
      if (rows.size === 0) {
        this.exploredTiles.delete(col);
      }
    }
  }

  private retainActiveTerrainGenerations(): void {
    const retainedGenerationKeys = new Set([
      ...this.cachedMatrices.keys(),
      ...this.pinnedChunkKeys,
      ...this.directionalPresentationChunkKeys,
    ]);
    if (this.currentChunk !== "null") {
      retainedGenerationKeys.add(this.currentChunk);
    }
    this.exploredTilesGeneration.retain(retainedGenerationKeys);
  }

  private rebuildPathfindingWorkerState(): void {
    const retainedBounds = this.getRetainedRenderAreaBounds();
    gameWorkerManager.hydrateWorldState(this.buildRetainedPathfindingWorldState(retainedBounds));
  }

  private buildRetainedPathfindingWorldState(retainedBounds: readonly WorldmapLocalBounds[]): GameWorkerWorldState {
    return {
      armies: this.collectRetainedArmyPathfinding(retainedBounds),
      exploredTiles: this.collectRetainedTilePathfinding(retainedBounds),
      structures: this.collectRetainedStructurePathfinding(retainedBounds),
    };
  }

  private collectRetainedTilePathfinding(retainedBounds: readonly WorldmapLocalBounds[]): GameWorkerExploredTile[] {
    const exploredTiles: GameWorkerExploredTile[] = [];
    const retainedTileIds = new Set<string>();
    retainedBounds.forEach((bounds) => {
      this.worldSpatialProjection.getTilesInBounds(this.toContractBounds(bounds)).forEach((tile) => {
        if (retainedTileIds.has(tile.spatialId)) return;
        retainedTileIds.add(tile.spatialId);
        const normalized = new Position({ x: tile.hexCoords.col, y: tile.hexCoords.row }).getNormalized();
        exploredTiles.push({
          biome: resolveTileBiomeType(tile.biome),
          col: normalized.x,
          row: normalized.y,
        });
      });
    });
    return exploredTiles;
  }

  private collectRetainedStructurePathfinding(retainedBounds: readonly WorldmapLocalBounds[]): GameWorkerEntityHex[] {
    const structures: GameWorkerEntityHex[] = [];
    const retainedStructureIds = new Set<ID>();
    retainedBounds.forEach((bounds) => {
      const contractBounds = this.toContractBounds(bounds);
      this.worldSpatialProjection.getStructuresInBounds(contractBounds).forEach((structure) => {
        if (structure.reserved || retainedStructureIds.has(structure.entityId)) {
          return;
        }
        retainedStructureIds.add(structure.entityId);
        const normalized = new Position({ x: structure.hexCoords.col, y: structure.hexCoords.row }).getNormalized();
        structures.push({
          col: normalized.x,
          info: {
            id: structure.entityId,
            owner: this.getStructureOwnerAddress(structure.entityId) ?? 0n,
          },
          row: normalized.y,
        });
      });
    });
    return structures;
  }

  private collectRetainedArmyPathfinding(retainedBounds: readonly WorldmapLocalBounds[]): GameWorkerEntityHex[] {
    const armies: GameWorkerEntityHex[] = [];
    const retainedArmyIds = new Set<ID>();
    retainedBounds.forEach((bounds) => {
      const contractBounds = this.toContractBounds(bounds);
      this.worldSpatialProjection.getArmiesInBounds(contractBounds).forEach((army) => {
        if (retainedArmyIds.has(army.entityId)) {
          return;
        }
        retainedArmyIds.add(army.entityId);
        const normalized = new Position({ x: army.hexCoords.col, y: army.hexCoords.row }).getNormalized();
        armies.push({
          col: normalized.x,
          info: {
            id: army.entityId,
            owner: this.getArmyOwnerAddress(army.entityId) ?? 0n,
          },
          row: normalized.y,
        });
      });
    });
    return armies;
  }

  private clearStalledChunkAreaState(chunkKey: string): string | null {
    if (!chunkKey || chunkKey === "null") {
      return null;
    }

    const areaKey = this.getRenderAreaKeyForChunk(chunkKey);
    this.hydratedRefreshSuppressionAreaKeys.delete(areaKey);
    this.hydratedChunkRefreshes.delete(chunkKey);
    return areaKey;
  }

  private recoverChunkStreamingAfterStall(input: {
    reason: string;
    chunkKey: string;
    details?: Record<string, unknown>;
    refreshReason?: WorldmapForceRefreshReason;
  }): string | null {
    const areaKey = this.clearStalledChunkAreaState(input.chunkKey);
    this.scheduleChunkRecoveryWithReason(
      input.reason,
      input.chunkKey,
      {
        areaKey,
        ...input.details,
      },
      input.refreshReason ?? "default",
    );

    return areaKey;
  }

  private recoverAfterConnectionFailure(): void {
    if (this.isSwitchedOff) {
      return;
    }

    const areaKey = this.clearStalledChunkAreaState(this.currentChunk);
    this.state.setLoading(LoadingStateKey.ChunkTransition, false);
    this.traceChunk("connection_failure_recovery", {
      areaKey,
      chunkKey: this.currentChunk,
    });
  }

  private refreshAfterReconnect(): void {
    if (this.isSwitchedOff) {
      this.traceChunk("reconnect_refresh_skipped", {
        currentChunk: this.currentChunk,
        isSwitchedOff: this.isSwitchedOff,
      });
      return;
    }

    queueOrRunReconnectRefresh({
      state: this.reconnectRefreshQueueState,
      currentChunk: this.currentChunk,
      runRefresh: () => {
        const areaKey = this.clearStalledChunkAreaState(this.currentChunk);
        this.traceChunk("reconnect_refresh_requested", {
          areaKey,
          chunkKey: this.currentChunk,
        });
        this.requestChunkRefresh(true, "reconnect");
      },
    });

    if (this.reconnectRefreshQueueState.hasPendingRefresh) {
      this.traceChunk("reconnect_refresh_queued", {
        currentChunk: this.currentChunk,
      });
    }
  }

  private drainQueuedReconnectRefresh(): void {
    if (this.isSwitchedOff) {
      return;
    }
    drainReconnectRefreshQueue({
      state: this.reconnectRefreshQueueState,
      runRefresh: () => {
        const areaKey = this.clearStalledChunkAreaState(this.currentChunk);
        this.traceChunk("reconnect_refresh_drained", {
          areaKey,
          chunkKey: this.currentChunk,
        });
        this.requestChunkRefresh(true, "reconnect");
      },
    });
  }

  private scheduleChunkRecovery(reason: string, chunkKey: string, details: Record<string, unknown> = {}): void {
    this.scheduleChunkRecoveryWithReason(reason, chunkKey, details, "default");
  }

  private scheduleChunkRecoveryWithReason(
    reason: string,
    chunkKey: string,
    details: Record<string, unknown> = {},
    refreshReason: WorldmapForceRefreshReason,
  ): void {
    if (this.isSwitchedOff || !chunkKey || chunkKey === "null") {
      return;
    }

    const now = Date.now();
    if (this.chunkRecoveryTimeout !== null || now - this.lastChunkRecoveryAtMs < WORLDMAP_CHUNK_RECOVERY_COOLDOWN_MS) {
      return;
    }

    this.lastChunkRecoveryAtMs = now;
    this.traceChunk("chunk_recovery_scheduled", {
      reason,
      chunkKey,
      cooldownMs: WORLDMAP_CHUNK_RECOVERY_COOLDOWN_MS,
      ...details,
    });
    this.chunkRecoveryTimeout = window.setTimeout(() => {
      this.chunkRecoveryTimeout = null;
      this.traceChunk("chunk_recovery_executed", {
        reason,
        chunkKey,
        ...details,
      });
      this.requestChunkRefresh(true, refreshReason);
    }, 0);
  }

  private handleChunkTransitionHardTimeout(
    reason: "switch_chunk" | "refresh_current_chunk",
    chunkKey: string,
    info: WorldmapChunkTransitionHardTimeoutInfo,
    transitionToken: number,
  ): void {
    const recoveryDecision = this.invalidateChunkTransitionAuthorityAfterStall(transitionToken);
    const recoveryDetails = {
      timedOutTransitionToken: transitionToken,
      recoveryTransitionToken: recoveryDecision.recoveryTransitionToken,
      invalidatedTimedOutTransition: recoveryDecision.shouldInvalidateTimedOutTransition,
    };

    console.warn("[WorldmapScene] Chunk transition hard timeout — forcing recovery", {
      reason,
      chunkKey,
      timeoutMs: info.timeoutMs,
      ...recoveryDetails,
    });
    this.traceChunk("chunk_transition_hard_timeout", {
      reason,
      chunkKey,
      timeoutMs: info.timeoutMs,
      ...recoveryDetails,
    });
    if (!recoveryDecision.shouldInvalidateTimedOutTransition) {
      return;
    }

    this.recoverChunkManagersAfterStall(chunkKey, recoveryDecision.recoveryTransitionToken);
    this.recoverChunkStreamingAfterStall({
      reason: "chunk_transition_hard_timeout",
      chunkKey,
      details: {
        reason,
        timeoutMs: info.timeoutMs,
        ...recoveryDetails,
      },
    });
  }

  private invalidateChunkTransitionAuthorityAfterStall(staleTransitionToken: number): {
    recoveryTransitionToken: number;
    shouldInvalidateTimedOutTransition: boolean;
  } {
    const decision = resolveWorldmapChunkTransitionTimeoutRecovery({
      currentTransitionToken: this.chunkTransitionToken,
      timedOutTransitionToken: staleTransitionToken,
    });

    if (decision.shouldInvalidateTimedOutTransition) {
      this.chunkTransitionToken = decision.recoveryTransitionToken;
      this.terrainTimeoutRecoveryAuthority = {
        timedOutTransitionToken: staleTransitionToken,
        recoveryTransitionToken: decision.recoveryTransitionToken,
      };
      this.exactTerrainPreparations.releaseSuperseded(decision.recoveryTransitionToken);
    }

    return decision;
  }

  private recoverChunkManagersAfterStall(chunkKey: string, transitionToken: number): void {
    const recoveryInput = { chunkKey, transitionToken };
    this.armyManager.recoverChunkUpdateAfterStall(recoveryInput);
    this.structureManager.recoverChunkUpdateAfterStall(recoveryInput);
    this.chestManager.recoverChunkUpdateAfterStall(recoveryInput);

    // Stall recovery commits the chest manager's currentChunk without rendering,
    // so the next *unforced* same-chunk update would be skipped
    // (shouldSkipUnforcedChunkRefresh) and the chest models would never appear.
    // Chest is the only manager on the deferred path, so force a chest catch-up
    // for the recovered chunk here to break that latch.
    this.deferNonCriticalManagerCatchUpForChunk(chunkKey, {
      force: true,
      transitionToken: this.chunkTransitionToken,
    });
  }

  private handleChunkPresentationTimeout(info: WorldmapChunkPresentationTimeoutInfo): void {
    const areaKey = this.recoverChunkStreamingAfterStall({
      reason: "chunk_presentation_timeout",
      chunkKey: info.chunkKey,
      details: {
        phase: info.phase,
        timeoutMs: info.timeoutMs,
      },
    });
    this.traceChunk("chunk_presentation_timeout", {
      chunkKey: info.chunkKey,
      areaKey,
      phase: info.phase,
      timeoutMs: info.timeoutMs,
    });
  }

  private claimNextChunkTransitionToken(): number {
    const transitionToken = ++this.chunkTransitionToken;
    this.terrainTimeoutRecoveryAuthority = null;
    this.exactTerrainPreparations.releaseSuperseded(transitionToken);
    return transitionToken;
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

  private async syncProjectionTilesForChunk(chunkKey: string): Promise<boolean> {
    if (this.isSwitchedOff) {
      return false;
    }

    recordChunkDiagnosticsEvent(this.chunkDiagnostics, "projection_sync_started");
    try {
      const areaKey = this.getRenderAreaKeyForChunk(chunkKey);
      const localBounds = this.getRenderFetchBoundsForArea(areaKey);
      const tiles = this.worldSpatialProjection.getTilesInBounds(this.toContractBounds(localBounds));
      const syncedTileCount = this.syncExploredTilesFromProjection(tiles);

      this.traceChunk("projection_tiles_synced", {
        areaKey,
        localBounds,
        projectedTileCount: tiles.length,
        syncedTileCount,
      });
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "projection_sync_succeeded");
      return true;
    } catch (error) {
      console.error("Error syncing projected tiles:", error);
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "projection_sync_failed");
      return false;
    }
  }

  private toContractBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }) {
    const feltCenter = FELT_CENTER();
    return {
      minCol: bounds.minCol + feltCenter,
      maxCol: bounds.maxCol + feltCenter,
      minRow: bounds.minRow + feltCenter,
      maxRow: bounds.maxRow + feltCenter,
    };
  }

  private syncExploredTilesFromProjection(tiles: readonly TileSpatialRenderable[]): number {
    let syncedTileCount = 0;
    for (const tile of tiles) {
      const normalized = new Position({ x: tile.hexCoords.col, y: tile.hexCoords.row }).getNormalized();
      const biome = resolveTileBiomeType(tile.biome);
      const existingBiome = this.exploredTiles.get(normalized.x)?.get(normalized.y);
      if (existingBiome === biome) {
        continue;
      }

      this.writeExploredTileFromProjection(normalized.x, normalized.y, biome);
      syncedTileCount += 1;
    }

    if (syncedTileCount > 0) {
      incrementWorldmapRenderCounter("projectionTilesSynced", syncedTileCount);
    }

    return syncedTileCount;
  }

  private writeExploredTileFromProjection(col: number, row: number, biome: BiomeType): Promise<void> {
    const wasExplored = this.exploredTiles.get(col)?.has(row) ?? false;
    if (!wasExplored) this.proceduralTerrain.queueShroudReveal(col, row);
    if (!this.exploredTiles.has(col)) {
      this.exploredTiles.set(col, new Map());
    }

    this.exploredTiles.get(col)!.set(row, biome);
    this.bumpTerrainGenerationForHex(col, row);
    gameWorkerManager.updateExploredTile(col, row, biome);
    this.invalidateAllChunkCachesContainingHex(col, row);
    return this.invalidateVisualTerrainPageForLiveTile(col, row);
  }

  private touchMatrixCache(chunkKey: string) {
    const existingIndex = this.cachedMatrixOrder.indexOf(chunkKey);
    if (existingIndex !== -1) {
      this.cachedMatrixOrder.splice(existingIndex, 1);
    }
    this.cachedMatrixOrder.push(chunkKey);
  }

  private disposeCachedMatrices(chunkKey: string): void {
    void chunkKey;
  }

  private removeCachedMatricesForChunk(startRow: number, startCol: number): void {
    const chunkKey = `${startRow},${startCol}`;
    this.disposeCachedMatrices(chunkKey);
    this.cachedMatrices.delete(chunkKey);
    this.cachedMatrixOrder = this.cachedMatrixOrder.filter((key) => key !== chunkKey);
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

  private getTerrainFingerprintForChunk(startRow: number, startCol: number): string {
    const bounds = getRenderBounds(startRow, startCol, this.renderChunkSize, this.chunkSize);
    const fingerprintEntries: Array<{ biomeKey: string; col: number; row: number }> = [];

    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
      for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
        const isStructure = this.isProjectedStructureHex(col, row);
        if (isStructure) {
          continue;
        }

        const exploredBiome = this.exploredTiles.get(col)?.get(row);
        if (!exploredBiome && !this.simulateAllExplored) {
          continue;
        }

        const biome = exploredBiome ?? this.perfSimulation!.getSimulatedBiome(col, row);
        fingerprintEntries.push({ biomeKey: biome, col, row });
      }
    }

    return createWorldmapTerrainFingerprint(fingerprintEntries);
  }

  private getExpectedExploredTerrainInstances(startRow: number, startCol: number): number {
    const bounds = getRenderBounds(startRow, startCol, this.renderChunkSize, this.chunkSize);
    let expectedExploredTerrainInstances = 0;

    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
      for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
        const isStructure = this.isProjectedStructureHex(col, row);
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
    this.structureManager.setChunkBounds(bounds);
  }

  private updateCurrentChunkBounds(startRow: number, startCol: number) {
    const bounds = this.computeChunkBounds(startRow, startCol);
    this.applySceneChunkBounds(bounds);

    // Register chunk bounds with centralized visibility manager
    const chunkKey = `${startRow},${startCol}`;
    this.visibilityManager?.registerChunk(chunkKey, bounds);
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
    return resolveWorldmapChunkFromHexPosition({
      col: position.col,
      row: position.row,
      chunkSize: this.chunkSize,
    }).chunkKey;
  }

  private async prewarmShortcutChunk(targetChunkKey: string): Promise<void> {
    if (!targetChunkKey || targetChunkKey === "null") {
      return;
    }

    try {
      await this.syncProjectionTilesForChunk(targetChunkKey);
      const [targetStartRow, targetStartCol] = targetChunkKey.split(",").map(Number);
      if (!Number.isFinite(targetStartRow) || !Number.isFinite(targetStartCol)) {
        return;
      }

      // Fire-and-forget surrounding prewarm to reduce edge pop-in on cross-chunk tabbing.
      this.getSurroundingChunkKeys(targetStartRow, targetStartCol).forEach((chunkKey) => {
        void this.syncProjectionTilesForChunk(chunkKey);
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
    requestWorldmapChunkRefreshToken(this.chunkRefreshRuntimeState);
    this.pendingChunkRefreshReasons.add(reason);
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

  private consumePendingChunkRefreshReasons(): string {
    const reasons = [...this.pendingChunkRefreshReasons].sort();
    this.pendingChunkRefreshReasons.clear();
    if (reasons.length > 0) {
      return reasons.join("+");
    }

    if (import.meta.env.DEV) {
      console.error("[WorldmapPerf] scheduled chunk refresh has no attributed trigger");
    }
    return "unattributed_scheduled_refresh";
  }

  private waitForRequestedChunkRefresh(requestToken: number): Promise<void> {
    return waitForWorldmapRequestedChunkRefresh({
      isSwitchedOff: () => this.isSwitchedOff,
      requestToken,
      state: this.chunkRefreshRuntimeState,
    });
  }

  private scheduleLegacyChunkRefresh(requestedDelayMs: number): void {
    const scheduledToken = this.chunkRefreshRequestToken;
    scheduleWorldmapChunkRefreshTimer({
      clearTimeoutFn: (timeoutId) => window.clearTimeout(timeoutId),
      nowMs: performance.now(),
      onTimer: () => {
        void this.flushLegacyChunkRefresh(scheduledToken);
      },
      requestedDelayMs,
      setTimeoutFn: (callback, delayMs) => window.setTimeout(callback, delayMs),
      state: this.chunkRefreshRuntimeState,
    });
  }

  private async flushLegacyChunkRefresh(scheduledToken: number): Promise<void> {
    const shouldForce = this.pendingChunkRefreshForce;
    const refreshReason = this.pendingChunkRefreshUiReason;
    this.pendingChunkRefreshForce = false;
    this.pendingChunkRefreshUiReason = "default";

    await runWorldmapChunkRefreshExecution({
      executeRefresh: async () => {
        const triggerReason = this.consumePendingChunkRefreshReasons();
        await this.updateVisibleChunks(shouldForce, { reason: refreshReason, triggerReason });
      },
      onError: (error) => {
        console.error("[WorldMap] Legacy chunk refresh failed:", error);
      },
      onExecutionComplete: () => {},
      onRescheduleWhileRunning: () => {},
      onSuperseded: () => {},
      scheduledToken,
      scheduleRerun: () => {
        this.scheduleLegacyChunkRefresh(0);
      },
      state: this.chunkRefreshRuntimeState,
    });
  }

  private scheduleChunkRefreshExecution(requestedDelayMs: number): void {
    const scheduledToken = this.chunkRefreshRequestToken;
    scheduleWorldmapChunkRefreshTimer({
      clearTimeoutFn: (timeoutId) => window.clearTimeout(timeoutId),
      nowMs: performance.now(),
      onTimer: () => {
        void this.flushChunkRefresh(scheduledToken);
      },
      requestedDelayMs,
      setTimeoutFn: (callback, delayMs) => window.setTimeout(callback, delayMs),
      state: this.chunkRefreshRuntimeState,
    });
  }

  private async flushChunkRefresh(scheduledToken: number): Promise<void> {
    const shouldForce = this.pendingChunkRefreshForce;
    const refreshReason = this.pendingChunkRefreshUiReason;
    this.pendingChunkRefreshForce = false;
    this.pendingChunkRefreshUiReason = "default";

    await runWorldmapChunkRefreshExecution({
      executeRefresh: async () => {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "refresh_executed");
        const triggerReason = this.consumePendingChunkRefreshReasons();
        await this.updateVisibleChunks(shouldForce, { reason: refreshReason, triggerReason });
      },
      onError: (error) => {
        console.error("[WorldMap] Chunk refresh failed:", error);
      },
      onExecutionComplete: ({ executionToken, hasNewerRequest, latestToken }) => {
        this.emitZoomHardeningTelemetry("refresh_applied", {
          executionToken,
          latestToken,
          hasNewerRequest,
        });
      },
      onRescheduleWhileRunning: ({ latestToken, scheduledToken: queuedScheduledToken }) => {
        this.emitZoomHardeningTelemetry("refresh_rescheduled", {
          scheduledToken: queuedScheduledToken,
          latestToken,
        });
      },
      onSuperseded: ({ executionToken, latestToken, scheduledToken: queuedScheduledToken }) => {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "refresh_superseded");
        this.emitZoomHardeningTelemetry("refresh_superseded", {
          scheduledToken: queuedScheduledToken,
          latestToken,
          executionToken,
        });
      },
      scheduledToken,
      scheduleRerun: () => {
        this.scheduleChunkRefreshExecution(0);
      },
      state: this.chunkRefreshRuntimeState,
    });
  }

  async updateVisibleChunks(force: boolean, options: WorldmapVisibleChunkUpdateOptions): Promise<boolean> {
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
      const triggerReason = options.triggerReason;
      const chunkDecision = resolveWarpTravelVisibleChunkDecision({
        isSwitchedOff: this.isSwitchedOff,
        focusPoint,
        chunkSize: this.chunkSize,
        hexSize: HEX_SIZE,
        currentChunk: this.currentChunk,
        force,
        reason: options.reason,
        shouldDelayChunkSwitch: this.shouldDelayChunkSwitch(focusPoint),
      });

      if (chunkDecision.action === "noop" && !chunkDecision.shouldPrefetch) {
        this.traceChunk("chunk_transition_noop", {
          reason: options.reason,
          focusPoint: {
            x: focusPoint.x,
            y: focusPoint.y,
            z: focusPoint.z,
          },
        });
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
        const transitionToken = this.claimNextChunkTransitionToken();
        const switchStartedAt = performance.now();
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "transition_started");
        this.state.setLoading(LoadingStateKey.ChunkTransition, true);
        return runWorldmapChunkTransition({
          hardTimeoutMs: WORLDMAP_CHUNK_TRANSITION_HARD_TIMEOUT_MS,
          onFinally: () => {
            this.state.setLoading(LoadingStateKey.ChunkTransition, false);
            recordChunkDiagnosticsEvent(this.chunkDiagnostics, "switch_duration_recorded", {
              durationMs: performance.now() - switchStartedAt,
            });
          },
          onHardTimeout: (info) => {
            this.handleChunkTransitionHardTimeout("switch_chunk", chunkKey, info, transitionToken);
            return false;
          },
          onResolved: (committed) => {
            this.drainQueuedReconnectRefresh();
            return committed;
          },
          state: this.chunkTransitionRuntimeState,
          transitionPromise: this.performChunkSwitch(
            chunkKey,
            startCol,
            startRow,
            force,
            transitionToken,
            options.reason,
            triggerReason,
            focusPoint.clone(),
          ),
        });
      }

      if (chunkDecision.action === "refresh_current_chunk") {
        const { chunkKey, startCol, startRow } = chunkDecision;
        if (chunkKey === null || startCol === null || startRow === null) {
          return false;
        }
        const transitionToken = this.claimNextChunkTransitionToken();
        const liveEntityActions = getLiveWorldmapEntityActions();
        this.actionPathsTransitionToken = resolveEntityActionPathsTransitionTokenForForcedRefresh({
          selectedEntityId: liveEntityActions.selectedEntityId,
          actionPathCount: liveEntityActions.actionPaths.size,
          currentChunk: this.currentChunk,
          targetChunk: chunkKey,
          nextTransitionToken: transitionToken,
          previousTransitionToken: this.actionPathsTransitionToken,
        });
        this.state.setLoading(LoadingStateKey.ChunkTransition, true);
        return runWorldmapChunkTransition({
          hardTimeoutMs: WORLDMAP_CHUNK_TRANSITION_HARD_TIMEOUT_MS,
          onFinally: () => {
            this.state.setLoading(LoadingStateKey.ChunkTransition, false);
          },
          onHardTimeout: (info) => {
            this.handleChunkTransitionHardTimeout("refresh_current_chunk", chunkKey, info, transitionToken);
            return false;
          },
          onResolved: (committed) => {
            this.drainQueuedReconnectRefresh();
            return committed;
          },
          state: this.chunkTransitionRuntimeState,
          transitionPromise: this.refreshCurrentChunk(chunkKey, startCol, startRow, transitionToken, triggerReason),
        });
      }

      return false;
    } finally {
      recordWorldmapRenderDuration("updateVisibleChunks", performance.now() - updateStartedAt);
    }
  }

  private prepareChunkPresentation(input: {
    chunkKey: string;
    startCol: number;
    startRow: number;
    surroundingChunks: string[];
  }) {
    return prepareWorldmapChunkRuntime<PreparedTerrainChunk>({
      chunkKey: input.chunkKey,
      syncProjectionTiles: (targetChunkKey) => this.syncProjectionTilesForChunk(targetChunkKey),
      now: () => performance.now(),
      onChunkPrepared: (preparedChunkKey) => {
        this.hydratedChunkRefreshes.delete(preparedChunkKey);
      },
      onPhaseTimeout: (info) => this.handleChunkPresentationTimeout(info),
      phaseTimeoutMs: WORLDMAP_CHUNK_PHASE_TIMEOUT_MS,
      prewarmChunkAssets: (targetChunkKey) => this.structureManager.prewarmChunkAssets(targetChunkKey),
      prepareTerrainChunk: (targetStartRow, targetStartCol, height, width) =>
        this.prepareTerrainChunk(targetStartRow, targetStartCol, height, width),
      recordWorldmapRenderDuration: (metric, durationMs) =>
        recordWorldmapRenderDuration(metric as WorldmapRenderDurationMetric, durationMs),
      renderSize: this.renderChunkSize,
      startCol: input.startCol,
      startRow: input.startRow,
      surroundingChunks: input.surroundingChunks,
      updatePinnedChunks: (chunkKeys) => this.updatePinnedChunks(chunkKeys),
    });
  }

  private recordPreparedTerrainReady(
    startedAtMs: number,
    preparationResult: {
      projectionSyncSucceeded: boolean;
      preparedTerrain: PreparedTerrainChunk | null;
    },
  ): void {
    if (!preparationResult.projectionSyncSucceeded || !preparationResult.preparedTerrain) {
      return;
    }

    recordWorldmapTerrainReadyDuration({
      diagnostics: this.chunkDiagnostics,
      nowMs: performance.now(),
      recordChunkDiagnosticsEvent,
      recordWorldmapRenderDuration,
      startedAtMs,
    });
  }

  private commitOwnedChunkSwitchTerrain(input: {
    chunkKey: string;
    chunkSwitchStartedAt: number;
    preparedTerrain: PreparedTerrainChunk;
    presentationRuntime: PreparedWorldmapChunkRuntime["presentationRuntime"];
    transitionToken: number;
  }): Promise<number | null> {
    return commitOwnedWorldmapPreparedTerrain({
      preparedTerrain: input.preparedTerrain,
      targetChunk: input.chunkKey,
      transitionToken: input.transitionToken,
      getCurrentTransitionToken: () => this.chunkTransitionToken,
      getRecoveryTransitionToken: (timedOutTransitionToken) => {
        const recoveryAuthority = this.terrainTimeoutRecoveryAuthority;
        return recoveryAuthority?.timedOutTransitionToken === timedOutTransitionToken
          ? recoveryAuthority.recoveryTransitionToken
          : null;
      },
      isSwitchedOff: () => this.isSwitchedOff,
      scheduleCommit: (commit) => this.schedulePreparedTerrainCommit("critical", input.preparedTerrain, commit),
      disposePreparedTerrain: (preparedTerrain) => this.disposePreparedTerrainChunk(preparedTerrain),
      commitChunkAuthority: (targetChunkKey) => this.commitCurrentChunkAuthority(targetChunkKey),
      applyPreparedTerrain: (preparedTerrain) => {
        commitWorldmapPreparedTerrainPresentation({
          applyPreparedTerrain: (preparedTerrain) => {
            this.applyPreparedTerrainChunk(preparedTerrain as PreparedTerrainChunk);
          },
          diagnostics: this.chunkDiagnostics,
          now: () => performance.now(),
          phaseDurations: input.presentationRuntime.phaseDurations,
          preparedTerrain,
          presentationStartedAtMs: input.chunkSwitchStartedAt,
          recordChunkDiagnosticsEvent,
          recordWorldmapRenderDuration,
          incrementWorldmapRenderCounter,
        });
      },
    });
  }

  private scheduleCommittedChunkManagerCatchUp(
    targetChunkKey: string,
    managerOptions: WorldmapManagerCatchUpOptions,
  ): Promise<void> {
    return catchUpCommittedWorldmapChunkManagers({
      stagedPathEnabled: WORLDMAP_STREAMING_ROLLOUT.stagedPathEnabled,
      runImmediateFullManagerCatchUp: () => this.updateManagersForChunk(targetChunkKey, managerOptions),
      runImmediateCriticalManagerCatchUp: () => this.updateCriticalManagersForChunk(targetChunkKey, managerOptions),
      scheduleDeferredNonCriticalManagerCatchUp: () =>
        this.deferNonCriticalManagerCatchUpForCommittedChunk(targetChunkKey, managerOptions),
    });
  }

  private async performChunkSwitch(
    chunkKey: string,
    startCol: number,
    startRow: number,
    force: boolean,
    transitionToken: number,
    reason: "default" | "shortcut",
    triggerReason: string,
    switchPosition?: Vector3,
  ) {
    const chunkSwitchStartedAt = performance.now();
    let exactTerrainPreparation: WorldmapExactTerrainPreparation<PreparedWorldmapChunkRuntime> | null = null;
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

      const {
        effectiveForce,
        hasFiniteOldChunkCoordinates,
        oldChunk,
        oldChunkCoordinates,
        previousPinnedChunks,
        reversalRefreshDecision,
        surroundingChunks,
      } = prepareWorldmapChunkSwitchRuntime({
        chunkKey,
        currentChunk: this.currentChunk,
        force,
        getSurroundingChunkKeys: (targetStartRow, targetStartCol) =>
          this.getSurroundingChunkKeys(targetStartRow, targetStartCol),
        invalidateTerrainCaches: (targetChunkKey, options) =>
          this.aggressivelyInvalidateChunkTerrainCaches(targetChunkKey, options),
        lastChunkSwitchMovement: this.lastChunkSwitchMovement,
        lastChunkSwitchPosition: this.lastChunkSwitchPosition
          ? {
              x: this.lastChunkSwitchPosition.x,
              z: this.lastChunkSwitchPosition.z,
            }
          : null,
        pinnedChunkKeys: this.pinnedChunkKeys,
        prepareBounds: ({ hasFiniteOldChunkCoordinates, oldChunkCoordinates, startCol, startRow, targetChunkKey }) => {
          prepareWarpTravelChunkBounds({
            targetChunkKey,
            startRow,
            startCol,
            hasFiniteOldChunkCoordinates,
            oldChunkCoordinates,
            computeChunkBounds: (targetStartRow, targetStartCol) =>
              this.computeChunkBounds(targetStartRow, targetStartCol),
            registerChunk: (targetChunkKey, bounds) => this.visibilityManager?.registerChunk(targetChunkKey, bounds),
            combineChunkBounds: (previousBounds, nextBounds) => this.combineChunkBounds(previousBounds, nextBounds),
            applySceneChunkBounds: (bounds) => this.applySceneChunkBounds(bounds),
          });
        },
        removeCachedMatricesForChunk: (targetStartRow, targetStartCol) =>
          this.removeCachedMatricesForChunk(targetStartRow, targetStartCol),
        startCol,
        startRow,
        switchPosition: switchPosition
          ? {
              x: switchPosition.x,
              z: switchPosition.z,
            }
          : null,
      });

      exactTerrainPreparation = this.exactTerrainPreparations.start({
        chunkKey,
        transitionToken,
        prepare: () =>
          this.prepareChunkPresentation({
            chunkKey,
            startCol,
            startRow,
            surroundingChunks,
          }),
      });

      this.startChunkSwitchTerrainShell({
        chunkKey,
        startCol,
        startRow,
        transitionToken,
      });

      const { projectionSyncSucceeded, preparedTerrain, presentationRuntime } = await exactTerrainPreparation.promise;

      this.recordPreparedTerrainReady(chunkSwitchStartedAt, {
        projectionSyncSucceeded,
        preparedTerrain,
      });

      let managerCatchUpPromise: Promise<void> | null = null;
      const finalizeResult = await finalizeWarpTravelChunkSwitch({
        projectionSyncSucceeded,
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
        commitPreparedTerrain: (nextPreparedTerrain) =>
          this.commitOwnedChunkSwitchTerrain({
            chunkKey,
            chunkSwitchStartedAt,
            preparedTerrain: nextPreparedTerrain as PreparedTerrainChunk,
            presentationRuntime,
            transitionToken,
          }),
        disposePreparedTerrain: (droppedPreparedTerrain) =>
          this.disposePreparedTerrainChunk(droppedPreparedTerrain as PreparedTerrainChunk),
        updatePinnedChunks: (chunkKeys) => this.updatePinnedChunks(chunkKeys),
        unregisterChunk: (targetChunkKey) => this.unregisterVisibilityChunk(targetChunkKey),
        restorePreviousChunkVisuals: (oldStartRow, oldStartCol) =>
          this.restorePreviousChunkVisualsAfterRollback(oldStartRow, oldStartCol),
        clearSceneChunkBounds: () => this.clearSceneChunkBounds(),
        forceVisibilityUpdate: () => this.forceVisibilityManagerUpdate(),
        updateCurrentChunkBounds: (targetStartRow, targetStartCol) =>
          this.updateCurrentChunkBounds(targetStartRow, targetStartCol),
        scheduleManagerCatchUp: (targetChunkKey, managerOptions) => {
          managerCatchUpPromise = this.scheduleCommittedChunkManagerCatchUp(targetChunkKey, {
            ...managerOptions,
            triggerReason,
          });
        },
        unregisterPreviousChunkOnNextFrame: (targetChunkKey) => this.queueChunkVisibilityUnregister(targetChunkKey),
      });

      const committed = await handleWorldmapChunkFinalizeResult({
        diagnostics: this.chunkDiagnostics,
        finalizeStatus: finalizeResult.status,
        managerCatchUpPromise,
        onCommitted: () => {
          const nextAnchorState = resolveWorldmapChunkSwitchAnchorState({
            nextMovementVector: reversalRefreshDecision.nextMovementVector,
            previousAnchorState: {
              hasChunkSwitchAnchor: this.hasChunkSwitchAnchor,
              movementVector: this.lastChunkSwitchMovement,
              switchPosition: this.lastChunkSwitchPosition,
            },
            switchPosition,
          });
          this.hasChunkSwitchAnchor = nextAnchorState.hasChunkSwitchAnchor;
          this.lastChunkSwitchMovement = nextAnchorState.movementVector;
          this.lastChunkSwitchPosition = nextAnchorState.switchPosition
            ? new Vector3(nextAnchorState.switchPosition.x, 0, nextAnchorState.switchPosition.z)
            : undefined;
        },
        recordChunkDiagnosticsEvent,
      });

      if (!committed) {
        return false;
      }

      if (oldChunk === "null") {
        // Cold-start chunk commits can land before exact-fetch results are applied.
        // Queue one same-chunk hydrated refresh so a hard reload converges like
        // the post-overlay/dashboard path instead of switching on stale terrain.
        this.scheduleHydratedChunkRefresh(chunkKey);
      }

      // Track memory usage after chunk switch
      if (memoryMonitor) {
        const postChunkStats = memoryMonitor.getCurrentStats(`chunk-switch-post-${chunkKey}`);
        const memoryDelta = recordWorldmapChunkMemoryDelta({
          postChunkStats,
          preChunkStats,
        });
        // Memory monitoring hooks - intentionally silent unless threshold exceeded
        void memoryDelta;
      }
      return true;
    } finally {
      if (exactTerrainPreparation) {
        this.exactTerrainPreparations.release(exactTerrainPreparation);
      }
      recordWorldmapRenderDuration("performChunkSwitch", performance.now() - chunkSwitchStartedAt);
    }
  }

  private async refreshCurrentChunk(
    chunkKey: string,
    startCol: number,
    startRow: number,
    transitionToken: number,
    triggerReason: string,
  ) {
    const memoryMonitor = (window as { __gameRenderer?: { memoryMonitor?: MemoryMonitor } }).__gameRenderer
      ?.memoryMonitor;
    const preChunkStats = memoryMonitor?.getCurrentStats(`chunk-refresh-pre-${chunkKey}`);
    const refreshAreaKey = this.getRenderAreaKeyForChunk(chunkKey);

    const surroundingChunks = this.getSurroundingChunkKeys(startRow, startCol);
    this.removeCachedMatricesForChunk(startRow, startCol);
    const refreshStartedAt = performance.now();
    const refreshCommitStatus = await runWorldmapRefreshRuntime({
      commitRefresh: async ({ preparedTerrain, projectionSyncSucceeded, presentationRuntime }) => {
        const commitDecision = resolveSameChunkRefreshCommit({
          refreshToken: transitionToken,
          currentRefreshToken: this.chunkTransitionToken,
          currentChunk: this.currentChunk,
          targetChunk: chunkKey,
          preparedTerrain,
        });

        return handleWorldmapRefreshCommitRuntime({
          chunkKey,
          commitPreparedTerrain: (nextPreparedTerrain) => {
            const preparedTerrain = nextPreparedTerrain as PreparedTerrainChunk;
            return this.schedulePreparedTerrainCommit("critical", preparedTerrain, () => {
              commitWorldmapPreparedTerrainPresentation({
                applyPreparedTerrain: (preparedTerrain) => {
                  this.applyPreparedTerrainChunk(preparedTerrain as PreparedTerrainChunk);
                },
                diagnostics: this.chunkDiagnostics,
                now: () => performance.now(),
                onAfterApply: () => {
                  this.updateCurrentChunkBounds(startRow, startCol);
                },
                phaseDurations: presentationRuntime.phaseDurations,
                preparedTerrain: nextPreparedTerrain,
                presentationStartedAtMs: refreshStartedAt,
                recordChunkDiagnosticsEvent,
                recordWorldmapRenderDuration,
                incrementWorldmapRenderCounter,
              });
            });
          },
          disposePreparedTerrain: (droppedPreparedTerrain) =>
            this.disposePreparedTerrainChunk(droppedPreparedTerrain as PreparedTerrainChunk),
          diagnostics: this.chunkDiagnostics,
          force: true,
          preparedTerrain,
          recordChunkDiagnosticsEvent,
          refreshDecision: commitDecision,
          runImmediateFullManagerCatchUp: (targetChunkKey, options) =>
            this.updateManagersForChunk(targetChunkKey, options),
          runImmediateCriticalManagerCatchUp: (targetChunkKey, options) =>
            this.updateCriticalManagersForChunk(targetChunkKey, { ...options, triggerReason }),
          scheduleDeferredNonCriticalManagerCatchUp: (targetChunkKey, options) =>
            this.deferNonCriticalManagerCatchUpForChunk(targetChunkKey, options),
          stagedPathEnabled: WORLDMAP_STREAMING_ROLLOUT.stagedPathEnabled,
          projectionSyncSucceeded,
          transitionToken,
        });
      },
      prepareChunk: () =>
        this.prepareChunkPresentation({
          chunkKey,
          startCol,
          startRow,
          surroundingChunks,
        }),
      onPreparedTerrainReady: (preparationResult) => {
        this.recordPreparedTerrainReady(refreshStartedAt, {
          projectionSyncSucceeded: preparationResult.projectionSyncSucceeded,
          preparedTerrain: preparationResult.preparedTerrain,
        });
      },
      refreshAreaKey,
      suppressedAreaKeys: this.hydratedRefreshSuppressionAreaKeys,
    });

    if (memoryMonitor) {
      const postChunkStats = memoryMonitor.getCurrentStats(`chunk-refresh-post-${chunkKey}`);
      const memoryDelta = recordWorldmapChunkMemoryDelta({
        postChunkStats,
        preChunkStats,
      });
      // Memory monitoring hooks - intentionally silent unless threshold exceeded
      void memoryDelta;
    }
    return refreshCommitStatus === "committed";
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
      this.syncStructureManagerGauges();
      setWorldmapRenderGauge("activePaths", this.armyManager.getActivePathCount());
      setWorldmapRenderGauge("activeLabels", this.hoverLabelManager.getActiveLabelCount());
      this.reconcileHoverLabels("manager_catch_up");
    }
  }

  private createCriticalManagerStallRecoveryResolver(
    chunkKey: string,
    stalledTransitionToken: number | undefined,
  ): CriticalManagerStallRecoveryResolver {
    let recoveryInput: WorldmapManagerChunkRecoveryInput | null = null;
    let recoveryDetails: Record<string, unknown> = {};
    let shouldScheduleRecoveryRefresh = false;

    const resolveRecoveryInput = () => {
      if (recoveryInput) {
        return recoveryInput;
      }

      const transitionToken = stalledTransitionToken ?? this.chunkTransitionToken;
      const recoveryDecision = this.invalidateChunkTransitionAuthorityAfterStall(transitionToken);
      recoveryDetails = {
        stalledTransitionToken: transitionToken,
        recoveryTransitionToken: recoveryDecision.recoveryTransitionToken,
        invalidatedStaleTransition: recoveryDecision.shouldInvalidateTimedOutTransition,
      };
      shouldScheduleRecoveryRefresh = recoveryDecision.shouldInvalidateTimedOutTransition;
      recoveryInput = {
        chunkKey: shouldScheduleRecoveryRefresh ? chunkKey : "null",
        transitionToken: recoveryDecision.recoveryTransitionToken,
      };
      return recoveryInput;
    };

    return {
      resolveRecoveryInput,
      getRecoveryDetails: () => recoveryDetails,
      shouldScheduleRecoveryRefresh: () => shouldScheduleRecoveryRefresh,
    };
  }

  private async updateCriticalManagersForChunk(chunkKey: string, options: WorldmapManagerCatchUpOptions) {
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
    recordChunkDiagnosticsEvent(this.chunkDiagnostics, "critical_manager_catch_up_started");

    let failures: WorldmapCriticalManagerCatchUpFailure[] = [];
    const criticalManagerRecovery = this.createCriticalManagerStallRecoveryResolver(chunkKey, options?.transitionToken);

    try {
      failures = await runWorldmapCriticalManagerCatchUp({
        context: {
          chunkKey,
          transitionToken: options.transitionToken ?? this.chunkTransitionToken,
          triggerReason: options.triggerReason,
        },
        log: undefined,
        managers: [
          {
            label: "army",
            recover: () =>
              this.armyManager.recoverChunkUpdateAfterStall(criticalManagerRecovery.resolveRecoveryInput()),
            run: () => this.armyManager.updateChunk(chunkKey, options),
          },
          {
            label: "structure",
            recover: () =>
              this.structureManager.recoverChunkUpdateAfterStall(criticalManagerRecovery.resolveRecoveryInput()),
            run: () => this.structureManager.updateChunk(chunkKey, options),
          },
        ],
        timeoutMs: WORLDMAP_CHUNK_PHASE_TIMEOUT_MS,
      });
    } finally {
      const durationMs = performance.now() - managerStartedAt;
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "manager_duration_recorded", {
        durationMs,
      });
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "manager_catch_up_duration_recorded", {
        durationMs,
      });
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "critical_manager_catch_up_duration_recorded", {
        durationMs,
      });
      recordWorldmapRenderDuration("chunkManagerCatchUpMs", durationMs);
      recordWorldmapRenderDuration("updateManagersForChunk", durationMs);
      setWorldmapRenderGauge("visibleArmies", this.armyManager.getVisibleCount());
      this.syncStructureManagerGauges();
      setWorldmapRenderGauge("activePaths", this.armyManager.getActivePathCount());
      setWorldmapRenderGauge("activeLabels", this.hoverLabelManager.getActiveLabelCount());
      this.retryPendingHoverLabelRecovery("critical_manager_catch_up");
    }

    handleWorldmapCriticalManagerCatchUpFailures({
      chunkKey,
      failures,
      onManagerFailure: (failure) => {
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "manager_update_failed");
        recordChunkDiagnosticsEvent(this.chunkDiagnostics, "critical_manager_catch_up_failed");
        console.error(`[CHUNK SYNC] Critical ${failure.label} manager failed for chunk ${chunkKey}`, failure.reason);
      },
      scheduleRecovery: (failedChunkKey, failingManagers) => {
        if (!criticalManagerRecovery.shouldScheduleRecoveryRefresh()) {
          return;
        }

        this.recoverChunkStreamingAfterStall({
          reason: "critical_manager_failure",
          chunkKey: failedChunkKey,
          details: {
            failingManagers,
            ...criticalManagerRecovery.getRecoveryDetails(),
          },
          refreshReason: "manager_recovery",
        });
      },
    });
  }

  private async updateNonCriticalManagersForChunk(
    chunkKey: string,
    options?: { force?: boolean; transitionToken?: number },
  ) {
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
      await this.chestManager.updateChunk(chunkKey, options);
    } catch (reason) {
      recordChunkDiagnosticsEvent(this.chunkDiagnostics, "manager_update_failed");
      console.error(`[CHUNK SYNC] chest manager failed for chunk ${chunkKey}`, reason);
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
      this.retryPendingHoverLabelRecovery("non_critical_manager_catch_up");
    }
  }

  private syncArrivalGhostChunkVisibility(): void {
    this.arrivalGhostManager.setCurrentChunk(this.currentChunk);
  }

  update(deltaTime: number) {
    const animationContext = this.getAnimationVisibilityContext();
    this.syncWorldmapZoomSnapshot(deltaTime);
    super.update(deltaTime);
    this.armyManager.update(deltaTime, animationContext);
    this.syncTerrainMovementInteractions();
    this.proceduralTerrain.update(deltaTime);
    this.combatPresentation?.update(deltaTime);
    this.syncArrivalGhostChunkVisibility();
    this.arrivalGhostManager.update(deltaTime);
    this.fxManager.update(deltaTime);
    this.resourceFXManager.update(deltaTime);
    this.selectionPulseManager.update(deltaTime);
    this.selectedHexManager.update(deltaTime);
    this.structureManager.updateAnimations(deltaTime, animationContext);
    this.chestManager.update(deltaTime);
    this.updateCameraTargetHexThrottled?.();
    setWorldmapRenderGauge("activeLabels", this.hoverLabelManager.getActiveLabelCount());
    this.runPendingHoverLabelRecoveryFrame();
    this.terrainVisibilityHealthMonitor.tick({
      isWorldmapScene: this.sceneManager.getCurrentScene() === SceneName.WorldMap,
      isSwitchedOff: this.isSwitchedOff,
      currentChunk: this.currentChunk,
      currentChunkBox: this.currentChunkBounds?.box ?? null,
    });
  }

  private syncTerrainMovementInteractions(): void {
    this.armyManager.collectVisibleTerrainMovementInteractions(this.terrainMovementInteractionBuffer);
    this.proceduralTerrain.setMovementInteractions(this.terrainMovementInteractionBuffer);
  }

  private syncWorldmapZoomSnapshot(deltaTime: number): void {
    const zoomFrame = this.zoomCoordinator.tick({
      actualDistance: this.getCurrentCameraDistance(),
      deltaMs: deltaTime * 1000,
      nowMs: performance.now(),
    });
    if (zoomFrame.didMove) {
      this.placeWorldmapCameraAtDistance(zoomFrame.snapshot.actualDistance);
    }

    this.publishWorldmapZoomSnapshot(zoomFrame.snapshot);
  }

  private emitZoomHardeningTelemetry(event: string, payload: Record<string, unknown>): void {
    if (!WORLDMAP_ZOOM_HARDENING.telemetry || !VERBOSE_LOGS_ENABLED) {
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

  private buildChunkTraceState(extra: Record<string, unknown> = {}): Record<string, unknown> {
    const liveEntityActions = getLiveWorldmapEntityActions();
    const currentAreaKey = this.currentChunk !== "null" ? this.getRenderAreaKeyForChunk(this.currentChunk) : null;
    const connectionState = useConnectionStore.getState();

    return {
      currentChunk: this.currentChunk,
      currentAreaKey,
      isChunkTransitioning: this.isChunkTransitioning,
      hasGlobalChunkSwitchPromise: this.globalChunkSwitchPromise !== null,
      chunkTransitionToken: this.chunkTransitionToken,
      chunkRefreshRequestToken: this.chunkRefreshRequestToken,
      chunkRefreshAppliedToken: this.chunkRefreshAppliedToken,
      chunkRefreshRunning: this.chunkRefreshRunning,
      chunkRefreshRerunRequested: this.chunkRefreshRerunRequested,
      pinnedChunkKeys: Array.from(this.pinnedChunkKeys),
      pinnedRenderAreas: Array.from(this.pinnedRenderAreas),
      hydratedChunkRefreshes: Array.from(this.hydratedChunkRefreshes),
      hoveredHex: liveEntityActions.hoveredHex,
      selectedEntityId: liveEntityActions.selectedEntityId,
      actionPathCount: liveEntityActions.actionPaths.size,
      lastSpatialUpdateAgeMs: Math.max(0, Date.now() - connectionState.lastSpatialUpdate),
      ...extra,
    };
  }

  private traceChunk(event: WorldmapChunkTraceEvent, details: Record<string, unknown> = {}): void {
    const isErrorEvent =
      event === "chunk_presentation_timeout" ||
      event === "connection_failure_recovery" ||
      event === "chunk_recovery_scheduled" ||
      event === "chunk_recovery_executed";

    if (isErrorEvent) {
      console.warn(formatWorldmapChunkWarning(event, details));
    }

    if (!import.meta.env.DEV) {
      return;
    }

    const entry = appendWorldmapChunkTrace(this.chunkTraceBuffer, event, this.buildChunkTraceState(details));
    if (VERBOSE_LOGS_ENABLED) console.debug("[WorldmapChunkTrace]", entry);
  }

  private getChunkTraceSnapshot(): WorldmapChunkTraceEntry[] {
    return snapshotWorldmapChunkTrace(this.chunkTraceBuffer);
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

  private evaluateProjectionSyncVolumeRegressionAgainstBaseline(
    baselineLabel?: string,
    allowedIncreaseFraction: number = 0,
  ): WorldmapProjectionSyncVolumeRegressionDebugResult {
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
          baselineSyncCount: 0,
          currentSyncCount: Math.max(0, Math.floor(this.chunkDiagnostics.projectionSyncStarted)),
          allowedIncreaseFraction: Math.max(0, allowedIncreaseFraction),
          increaseFraction: Number.POSITIVE_INFINITY,
        },
      };
    }

    return {
      baselineLabel: selectedBaseline.label,
      result: evaluateProjectionSyncVolumeRegression({
        baseline: selectedBaseline.diagnostics,
        current: this.chunkDiagnostics,
        allowedIncreaseFraction,
      }),
    };
  }

  private installChunkDiagnosticsDebugHooks(): void {
    if (!DEV_MODE_ENABLED) {
      return;
    }

    const debugWindow = window as WorldmapChunkDiagnosticsDebugWindow;
    debugWindow.getWorldmapChunkDiagnostics = () => this.getChunkDiagnosticsSnapshot();
    debugWindow.getWorldmapChunkTrace = () => this.getChunkTraceSnapshot();
    debugWindow.resetWorldmapChunkDiagnostics = () => this.resetChunkDiagnostics();
    debugWindow.getWorldmapRenderDiagnostics = () => snapshotWorldmapRenderDiagnostics();
    debugWindow.getWorldBiomeSurface = () => this.worldBiomeSurface;
    debugWindow.getStrategicMarkers = () => this.strategicMarkers;
    debugWindow.getTerrainUploadMetrics = () => this.proceduralTerrain.getUploadMetrics();
    debugWindow.getTerrainPresentMetrics = () => this.proceduralTerrain.getPresentMetrics();
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
    debugWindow.evaluateWorldmapProjectionSyncVolumeRegression = (
      baselineLabel?: string,
      allowedIncreaseFraction?: number,
    ) => this.evaluateProjectionSyncVolumeRegressionAgainstBaseline(baselineLabel, allowedIncreaseFraction);
  }

  private removeChunkDiagnosticsDebugHooks(): void {
    if (!DEV_MODE_ENABLED) {
      return;
    }

    const debugWindow = window as WorldmapChunkDiagnosticsDebugWindow;
    debugWindow.getWorldmapChunkDiagnostics = undefined;
    debugWindow.getWorldmapChunkTrace = undefined;
    debugWindow.resetWorldmapChunkDiagnostics = undefined;
    debugWindow.getWorldmapRenderDiagnostics = undefined;
    debugWindow.getWorldBiomeSurface = undefined;
    debugWindow.getStrategicMarkers = undefined;
    debugWindow.getTerrainUploadMetrics = undefined;
    debugWindow.getTerrainPresentMetrics = undefined;
    debugWindow.resetWorldmapRenderDiagnostics = undefined;
    debugWindow.captureWorldmapChunkBaseline = undefined;
    debugWindow.evaluateWorldmapChunkSwitchP95Regression = undefined;
    debugWindow.evaluateWorldmapChunkFirstVisibleCommitP95Regression = undefined;
    debugWindow.evaluateWorldmapProjectionSyncVolumeRegression = undefined;
  }

  public hasActiveLabelAnimations(): boolean {
    return (
      this.armyManager.hasMovingArmies() ||
      this.resourceFXManager.hasActiveFx() ||
      this.fxManager.hasActiveLabelFx() ||
      this.hoverLabelManager.hasActiveLabels()
    );
  }

  public clearTileEntityCache() {
    this.clearQueuedPrefetchState();
    this.pinnedRenderAreas.clear();
    this.clearCache();
    // Also clear the interactive hexes when clearing the entire cache
    this.interactiveHexManager.clearHexes();
  }

  destroy() {
    this.logInteractionDebug("destroy_called", {
      existingStoreSubscriptionCount: this.storeSubscriptions.length,
      ...this.getInteractionDebugSnapshot(),
    });
    this.onSwitchOff();
    this.unsubscribeProceduralMeleeContact?.();
    this.unsubscribeProceduralMeleeContact = undefined;
    this.unsubscribeProceduralRangedRelease?.();
    this.unsubscribeProceduralRangedRelease = undefined;
    this.unsubscribeProceduralProjectileImpact?.();
    this.unsubscribeProceduralProjectileImpact = undefined;
    this.combatPresentation?.dispose();
    this.combatPresentation = undefined;
    this.syncUrlChangedListenerLifecycle("destroy");
    this.resetZoomHardeningRuntimeState();
    this.removeChunkDiagnosticsDebugHooks();
    uninstallWorldmapDebugHooks(window);
    if (this.chunkRecoveryTimeout !== null) {
      clearTimeout(this.chunkRecoveryTimeout);
      this.chunkRecoveryTimeout = null;
    }
    this.clearVisualTerrainPresentations();
    this.currentHexGridTask = null;

    this.disposeStoreSubscriptions();
    this.disposeWorldUpdateSubscriptions();
    this.unsubscribeWorldSpatialProjection?.();
    this.unsubscribeWorldSpatialProjection = undefined;
    this.pendingArmyMovementVisualLifecycleDisposers.forEach((dispose) => dispose());
    this.pendingArmyMovementVisualLifecycleDisposers.clear();
    this.pendingExploreLatencyActions.clear();
    if (this.handleTransactionProgress) {
      this.dojo.network?.provider?.off("transactionProgress", this.handleTransactionProgress);
    }
    this.unregisterWorldmapRecoveryHandle?.();
    this.unregisterWorldmapRecoveryHandle = null;

    destroyWorldmapOwnedManagers({
      armyManager: this.armyManager,
      arrivalGhostManager: this.arrivalGhostManager,
      structureManager: this.structureManager,
      reservedHyperstructureManager: this.reservedHyperstructureManager,
      chestManager: this.chestManager,
      fxManager: this.fxManager,
      resourceFXManager: this.resourceFXManager,
    });
    this.updateCameraTargetHexThrottled?.cancel();
    this.refreshVisualTerrainWindowThrottled?.cancel();
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
    this.chunkWorkQueue.dispose();
    this.proceduralTerrain.dispose();
    this.worldBiomeSurface.dispose();
    this.strategicMarkers.dispose();

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
        const hasMovementInputLock = this.isArmyMovementInputLocked(army.entityId);

        // Skip armies whose previous movement is still pending in this scene.
        if (hasMovementInputLock) {
          attempts++;
          continue;
        }

        // Skip armies that can't actually act right now (not enough stamina,
        // in battle cooldown). Lands Tab only on units the user could submit
        // a move from — prevents the "selected but tx will fail" trap.
        if (!this.canArmyAct(army.entityId)) {
          attempts++;
          continue;
        }

        const resolvedPosition = this.getArmyDisplayPosition(army.entityId);
        if (!resolvedPosition) {
          if (import.meta.env.DEV) {
            console.warn(`[WorldMap] Selectable army missing from spatial projection (entityId=${army.entityId})`);
          }
          attempts++;
          continue;
        }
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
            await this.updateVisibleChunks(true, {
              reason: "shortcut",
              triggerReason: "army_shortcut_selection_fallback",
            });
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
      await settleWorldmapShortcutSelectionProtection({
        awaitActiveChunkSwitch: this.globalChunkSwitchPromise
          ? async () => {
              await this.globalChunkSwitchPromise;
            }
          : undefined,
        awaitRequestedRefresh: (requestToken) => this.waitForRequestedChunkRefresh(requestToken),
        currentRefreshToken: this.chunkRefreshRequestToken,
        hasGlobalChunkSwitchPromise: this.globalChunkSwitchPromise !== null,
        hasPendingChunkRefreshTimer: this.chunkRefreshTimeout !== null,
        isChunkRefreshRunning: this.chunkRefreshRunning,
        warn: (message, error) => {
          console.warn(message, error);
        },
      });

      this.isShortcutArmySelectionInFlight = false;
      if (
        shouldResetWorldmapShortcutRefreshUiReason({
          hasGlobalChunkSwitchPromise: this.globalChunkSwitchPromise !== null,
          hasPendingChunkRefreshTimer: this.chunkRefreshTimeout !== null,
          isChunkRefreshRunning: this.chunkRefreshRunning,
        })
      ) {
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

    const switched = await this.updateVisibleChunks(forceChunkRefresh, {
      reason: "shortcut",
      triggerReason: "shortcut_navigation",
    });
    if (
      shouldRunShortcutForceFallback({
        isShortcutNavigation: true,
        chunkChanged,
        initialSwitchSucceeded: switched,
      })
    ) {
      await this.updateVisibleChunks(true, {
        reason: "shortcut",
        triggerReason: "shortcut_navigation_fallback",
      });
    }
  }

  private updateSelectableArmies(armies: SelectableArmy[]) {
    this.selectableArmies = armies;
    if (this.armyIndex >= armies.length) {
      this.armyIndex = 0;
    }
  }

  private handleEntityActionsStoreUpdate(
    nextEntityActions: WorldmapStoreState["entityActions"],
    previousEntityActions?: WorldmapStoreState["entityActions"],
  ): void {
    if (!this.isInteractionOwner()) {
      this.logInteractionDebug("entity_actions_update_ignored_without_ownership", {
        previousSelectedEntityId: previousEntityActions?.selectedEntityId,
        nextSelectedEntityId: nextEntityActions.selectedEntityId,
        previousActionPathCount: previousEntityActions?.actionPaths.size ?? 0,
        nextActionPathCount: nextEntityActions.actionPaths.size,
        ...this.getInteractionDebugSnapshot(),
      });
      return;
    }

    this.syncEntityActionPathsTransitionToken();
    this.logInteractionDebug("entity_actions_store_update", {
      previousSelectedEntityId: previousEntityActions?.selectedEntityId,
      nextSelectedEntityId: nextEntityActions.selectedEntityId,
      previousActionPathCount: previousEntityActions?.actionPaths.size ?? 0,
      nextActionPathCount: nextEntityActions.actionPaths.size,
      nextHoveredHex: nextEntityActions.hoveredHex,
      ...this.getInteractionDebugSnapshot(),
    });

    if (this.isSceneExitInteractionResetInProgress) {
      this.logInteractionDebug("entity_actions_update_ignored_during_switch_off", {
        nextSelectedEntityId: nextEntityActions.selectedEntityId,
        nextActionPathCount: nextEntityActions.actionPaths.size,
        ...this.getInteractionDebugSnapshot(),
      });
      return;
    }

    if (this.isMissingActionPathOwnershipState()) {
      this.logInteractionDebug("clearing_entity_selection_for_missing_ownership", {
        nextSelectedEntityId: nextEntityActions.selectedEntityId,
        nextActionPathCount: nextEntityActions.actionPaths.size,
        ...this.getInteractionDebugSnapshot(),
      });
      this.clearEntitySelection();
      return;
    }

    if (
      shouldClearEntitySelectionForEntityActionTransition(
        previousEntityActions?.selectedEntityId,
        nextEntityActions.selectedEntityId,
      )
    ) {
      this.logInteractionDebug("clearing_entity_selection_for_defined_to_null_transition", {
        previousSelectedEntityId: previousEntityActions?.selectedEntityId,
        nextSelectedEntityId: nextEntityActions.selectedEntityId,
        ...this.getInteractionDebugSnapshot(),
      });
      this.clearEntitySelection();
    }
  }

  /** The worldmap zooms through its coordinator so bands and refreshes stay in step; MapControls must not. */
  private lockMapControlsZoom(): void {
    this.controls.enableZoom = false;
  }

  private registerStoreSubscriptions() {
    if (this.storeSubscriptions.length > 0) {
      this.logInteractionDebug("store_subscriptions_registration_skipped", {
        existingStoreSubscriptionCount: this.storeSubscriptions.length,
        ...this.getInteractionDebugSnapshot(),
      });
      return;
    }

    this.storeSubscriptions = registerWorldmapStoreBridge({
      onSelectableArmiesChanged: (selectableArmies) => this.updateSelectableArmies(selectableArmies),
      onPlayerStructuresChanged: (playerStructures) => this.updatePlayerStructures(playerStructures),
      onIncomingTroopArrivalsChanged: (publicIncomingTroopArrivalsByStructure) => {
        this.structureManager.setIncomingTroopArrivalsByStructure(publicIncomingTroopArrivalsByStructure);
      },
      onEntityActionsChanged: (nextEntityActions, previousEntityActions) => {
        this.handleEntityActionsStoreUpdate(nextEntityActions, previousEntityActions);
        this.refreshLabelPriorityContext();
      },
      onSelectedHexChanged: (selectedHex) => {
        this.state.selectedHex = selectedHex;
      },
    });
    this.bindRouteOwnedRefreshLifecycle();
    this.bindPersistedZoomPreferenceLifecycle();

    this.logInteractionDebug("store_subscriptions_registered", {
      registeredSubscriptionCount: this.storeSubscriptions.length,
      ...this.getInteractionDebugSnapshot(),
    });
    this.syncStateFromStore();
  }

  private bindRouteOwnedRefreshLifecycle(): void {
    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.showBlankOverlay,
        (showBlankOverlay) => {
          if (showBlankOverlay) {
            return;
          }

          const playRoute = parsePlayRoute(window.location);
          if (playRoute?.scene !== "map" || playRoute.col === null || playRoute.row === null) {
            return;
          }

          this.moveCameraToURLLocation({ requestRefresh: false });
          this.refreshRouteOwnedChunkState();
        },
      ),
    );
  }

  // Applies zoom-preference changes coming from the settings UI while the
  // worldmap is active. Settled scene zooms write the same distance back to
  // the store, which the target-distance guard turns into a no-op.
  private bindPersistedZoomPreferenceLifecycle(): void {
    this.storeSubscriptions.push(
      useCameraZoomStore.subscribe(
        (state) => state.worldmapDistance,
        () => {
          const distance = this.resolvePreferredWorldmapCameraDistance();
          if (Math.abs(distance - this.zoomCoordinator.getSnapshot().targetDistance) < 0.05) {
            return;
          }

          this.applyWorldmapZoomIntent({ type: "snap_to_distance", distance });
        },
      ),
    );
  }

  private refreshRouteOwnedChunkState(): void {
    void this.updateVisibleChunks(true, { reason: "default", triggerReason: "route_owned_refresh" }).catch((error) => {
      console.error("[WorldMap] Route-owned refresh failed:", error);
    });
  }

  private disposeStoreSubscriptions() {
    if (this.storeSubscriptions.length === 0) {
      this.logInteractionDebug("store_subscriptions_dispose_skipped", {
        existingStoreSubscriptionCount: this.storeSubscriptions.length,
        ...this.getInteractionDebugSnapshot(),
      });
      return;
    }

    this.logInteractionDebug("store_subscriptions_disposing", {
      existingStoreSubscriptionCount: this.storeSubscriptions.length,
      ...this.getInteractionDebugSnapshot(),
    });

    disposeWorldmapStoreBridge({
      subscriptions: this.storeSubscriptions,
      onDisposeError: (error) => {
        console.warn("[WorldMap] Failed to unsubscribe store listener", error);
      },
    });
    this.storeSubscriptions = [];
    this.logInteractionDebug("store_subscriptions_disposed", {
      remainingStoreSubscriptionCount: this.storeSubscriptions.length,
      ...this.getInteractionDebugSnapshot(),
    });
  }

  private syncStateFromStore() {
    syncWorldmapStoreBridgeState({
      isInteractionOwner: this.isInteractionOwner(),
      onSkippedWithoutOwnership: () => {
        this.logInteractionDebug("sync_state_from_store_skipped_without_ownership", {
          ...this.getInteractionDebugSnapshot(),
        });
      },
      onSelectableArmiesChanged: (selectableArmies) => this.updateSelectableArmies(selectableArmies),
      onPlayerStructuresChanged: (playerStructures) => this.updatePlayerStructures(playerStructures),
      onIncomingTroopArrivalsChanged: (publicIncomingTroopArrivalsByStructure) => {
        this.structureManager.setIncomingTroopArrivalsByStructure(publicIncomingTroopArrivalsByStructure);
      },
      onEntityActionStateSynced: () => this.syncEntityActionPathsTransitionToken(),
      hasMissingActionPathOwnership: () => this.isMissingActionPathOwnershipState(),
      clearEntitySelection: () => this.clearEntitySelection(),
      onSelectedHexChanged: (selectedHex) => {
        this.state.selectedHex = selectedHex;
      },
      onSynced: (uiState) => {
        this.logInteractionDebug("sync_state_from_store", {
          ...this.getInteractionDebugSnapshot(),
          selectedEntityId: uiState.entityActions.selectedEntityId,
          actionPathCount: uiState.entityActions.actionPaths.size,
          hoveredHex: uiState.entityActions.hoveredHex,
          selectedHex: uiState.selectedHex,
        });
      },
    });
  }

  private resetInteractionSelectionForSwitchOff(nextSceneName?: SceneName): void {
    const shouldResetSharedInteractionState = this.isInteractionOwner();
    this.logInteractionDebug("switch_off_reset_start", {
      nextSceneName,
      shouldResetSharedInteractionState,
      ...this.getInteractionDebugSnapshot(),
    });
    this.isSceneExitInteractionResetInProgress = true;

    try {
      this.selectedHexManager.resetPosition();
      this.state.setSelectedHex(null);
      this.state.setHoveredHex(null);
      this.highlightHexManager.highlightHexes([]);
      this.selectionPulseManager.hideSelection();
      this.selectionPulseManager.clearOwnershipPulses();
      if (shouldResetSharedInteractionState) {
        resetWorldmapEntityActions();
      }
      this.actionPathsTransitionToken = null;
      this.previouslyHoveredHex = null;
      this.lastHoverReconciliation = null;
      document.body.style.cursor = "default";
      this.applyContextualHoverPalette(null);
    } finally {
      this.isSceneExitInteractionResetInProgress = false;
    }

    this.logInteractionDebug("switch_off_reset_complete", {
      nextSceneName,
      shouldResetSharedInteractionState,
      ...this.getInteractionDebugSnapshot(),
    });
  }

  private claimInteractionOwnership(): void {
    claimWorldmapInteractionOwner(this.interactionDebugInstanceId);
    this.logInteractionDebug("interaction_owner_claimed", {
      ownerInstanceId: getWorldmapInteractionOwnerInstanceId(),
      ...this.getInteractionDebugSnapshot(),
    });
  }

  private releaseInteractionOwnership(reason: "switch_off" | "destroy"): void {
    const ownerBeforeRelease = getWorldmapInteractionOwnerInstanceId();
    releaseWorldmapInteractionOwner(this.interactionDebugInstanceId);
    this.logInteractionDebug("interaction_owner_released", {
      reason,
      ownerBeforeRelease,
      ownerAfterRelease: getWorldmapInteractionOwnerInstanceId(),
      ...this.getInteractionDebugSnapshot(),
    });
  }

  private isInteractionOwner(): boolean {
    return isWorldmapInteractionOwner(this.interactionDebugInstanceId);
  }

  private getInteractionDebugSnapshot() {
    const liveEntityActions = getLiveWorldmapEntityActions();

    return {
      currentScene: this.sceneManager.getCurrentScene(),
      activeInteractionOwnerInstanceId: getWorldmapInteractionOwnerInstanceId(),
      isInteractionOwner: this.isInteractionOwner(),
      selectedEntityId: liveEntityActions.selectedEntityId,
      actionPathCount: liveEntityActions.actionPaths.size,
      actionPathKeysSample: Array.from(liveEntityActions.actionPaths.keys()).slice(0, 6),
      hoveredActionHex: liveEntityActions.hoveredHex,
      selectedHex: this.state.selectedHex,
      chunkTransitionToken: this.chunkTransitionToken,
      actionPathsTransitionToken: this.actionPathsTransitionToken,
      isSwitchedOff: this.isSwitchedOff,
      isSceneExitInteractionResetInProgress: this.isSceneExitInteractionResetInProgress,
    };
  }

  private logInteractionDebug(event: string, details: Record<string, unknown>): void {
    if (!import.meta.env.DEV || !VERBOSE_LOGS_ENABLED) {
      return;
    }

    console.debug(`[WorldmapInteraction] ${event}`, {
      instanceId: this.interactionDebugInstanceId,
      ...details,
    });
  }

  private updatePlayerStructures(structures: Structure[]) {
    const previousTerrainOwnership = this.playerStructures
      .map(({ entityId }) => entityId.toString())
      .toSorted()
      .join(":");
    this.playerStructures = structures;
    if (this.structureIndex >= structures.length) {
      this.structureIndex = 0;
    }
    const nextTerrainOwnership = structures
      .map(({ entityId }) => entityId.toString())
      .toSorted()
      .join(":");
    if (previousTerrainOwnership !== nextTerrainOwnership) this.scheduleTerrainEcologyRefresh();
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
}
