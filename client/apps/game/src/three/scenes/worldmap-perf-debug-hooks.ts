import type { PerformanceReport } from "../utils/performance-monitor";
import { registerDebugHook, unregisterDebugHook, type DebugHookInstallOptions } from "../utils/debug-hooks";
import type { WorldmapChunkDiagnostics } from "./worldmap-chunk-diagnostics";
import type { WorldmapChunkDiagnosticsBaselineEntry } from "./worldmap-chunk-diagnostics-baseline";

export interface WorldmapChunkDiagnosticsSnapshot {
  diagnostics: WorldmapChunkDiagnostics;
  baselines: WorldmapChunkDiagnosticsBaselineEntry[];
  currentChunk: string;
  chunkTransitionToken: number;
  chunkRefreshRequestToken: number;
  chunkRefreshAppliedToken: number;
}

export interface WorldmapDebugArmySpawnOptions {
  count: number;
  spread: number;
  troopType: "Knight" | "Crossbowman" | "Paladin";
  troopTier: "T1" | "T2" | "T3";
  mixTypes: boolean;
  mixTiers: boolean;
  isMine: boolean;
}

export interface WorldmapDebugArmyStats {
  debugArmyCount: number;
  totalArmyCount: number;
  visibleArmyCount: number;
}

export interface WorldmapPerfControlPatch {
  simulateAllExplored?: boolean;
  biomeAnimationsEnabled?: boolean;
  biomeShadowsEnabled?: boolean;
}

export interface WorldmapPerfDebugState {
  currentChunk: string;
  currentChunkSize: number;
  renderChunkSize: { width: number; height: number };
  cameraTargetHex: { col: number; row: number };
  simulateAllExplored: boolean;
  biomeAnimationsEnabled: boolean;
  biomeShadowsEnabled: boolean;
  visibleArmies: number;
  visibleStructures: number;
  visibleChests: number;
  debugArmies: WorldmapDebugArmyStats;
}

export interface WorldmapChunkOffsetMoveOptions {
  rowChunks?: number;
  colChunks?: number;
  durationSeconds?: number;
  settleDelayMs?: number;
}

export interface WorldmapBenchmarkSnapshot {
  diagnostics: WorldmapChunkDiagnosticsSnapshot;
  performance: PerformanceReport;
  state: WorldmapPerfDebugState;
}

interface WorldmapPerfDebugHookCallbacks {
  getChunkDiagnostics: () => WorldmapChunkDiagnosticsSnapshot;
  resetChunkDiagnostics: () => void;
  captureChunkBaseline: (label?: string) => WorldmapChunkDiagnosticsBaselineEntry;
  evaluateChunkSwitchP95Regression: (baselineLabel?: string, allowedRegressionFraction?: number) => unknown;
  evaluateTileFetchVolumeRegression: (baselineLabel?: string, allowedIncreaseFraction?: number) => unknown;
  getPerformanceReport: () => PerformanceReport;
  resetPerformanceReport: () => void;
  getPerfState: () => WorldmapPerfDebugState;
  setPerfState: (patch: WorldmapPerfControlPatch) => Promise<WorldmapPerfDebugState>;
  spawnDebugArmies: (options?: Partial<WorldmapDebugArmySpawnOptions>) => Promise<WorldmapDebugArmyStats>;
  clearDebugArmies: () => WorldmapDebugArmyStats;
  forceChunkRefresh: () => Promise<WorldmapPerfDebugState>;
  moveToChunkOffset: (options?: WorldmapChunkOffsetMoveOptions) => Promise<WorldmapPerfDebugState>;
  getBenchmarkSnapshot: () => WorldmapBenchmarkSnapshot;
}

interface InstallWorldmapPerfDebugHooksOptions extends DebugHookInstallOptions {
  callbacks: WorldmapPerfDebugHookCallbacks;
}

export const WORLDMAP_PERF_DEBUG_HOOK_NAMES = [
  "getWorldmapChunkDiagnostics",
  "resetWorldmapChunkDiagnostics",
  "captureWorldmapChunkBaseline",
  "evaluateWorldmapChunkSwitchP95Regression",
  "evaluateWorldmapTileFetchVolumeRegression",
  "getThreePerformanceReport",
  "resetThreePerformanceReport",
  "getWorldmapPerfState",
  "setWorldmapPerfState",
  "spawnWorldmapDebugArmies",
  "clearWorldmapDebugArmies",
  "forceWorldmapChunkRefresh",
  "moveWorldmapToChunkOffset",
  "getWorldmapBenchmarkSnapshot",
] as const;

export function installWorldmapPerfDebugHooks(options: InstallWorldmapPerfDebugHooksOptions): void {
  const { callbacks, ...installOptions } = options;

  registerDebugHook("getWorldmapChunkDiagnostics", callbacks.getChunkDiagnostics, installOptions);
  registerDebugHook("resetWorldmapChunkDiagnostics", callbacks.resetChunkDiagnostics, installOptions);
  registerDebugHook("captureWorldmapChunkBaseline", callbacks.captureChunkBaseline, installOptions);
  registerDebugHook(
    "evaluateWorldmapChunkSwitchP95Regression",
    callbacks.evaluateChunkSwitchP95Regression,
    installOptions,
  );
  registerDebugHook(
    "evaluateWorldmapTileFetchVolumeRegression",
    callbacks.evaluateTileFetchVolumeRegression,
    installOptions,
  );
  registerDebugHook("getThreePerformanceReport", callbacks.getPerformanceReport, installOptions);
  registerDebugHook("resetThreePerformanceReport", callbacks.resetPerformanceReport, installOptions);
  registerDebugHook("getWorldmapPerfState", callbacks.getPerfState, installOptions);
  registerDebugHook("setWorldmapPerfState", callbacks.setPerfState, installOptions);
  registerDebugHook("spawnWorldmapDebugArmies", callbacks.spawnDebugArmies, installOptions);
  registerDebugHook("clearWorldmapDebugArmies", callbacks.clearDebugArmies, installOptions);
  registerDebugHook("forceWorldmapChunkRefresh", callbacks.forceChunkRefresh, installOptions);
  registerDebugHook("moveWorldmapToChunkOffset", callbacks.moveToChunkOffset, installOptions);
  registerDebugHook("getWorldmapBenchmarkSnapshot", callbacks.getBenchmarkSnapshot, installOptions);
}

export function removeWorldmapPerfDebugHooks(options: DebugHookInstallOptions = {}): void {
  WORLDMAP_PERF_DEBUG_HOOK_NAMES.forEach((hookName) => unregisterDebugHook(hookName, options));
}
