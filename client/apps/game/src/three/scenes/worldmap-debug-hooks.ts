import {
  clearArmyMovementLatencyTrace,
  snapshotArmyMovementLatencyTrace,
  summarizeArmyMovementLatency,
  type ArmyMovementLatencySummary,
  type ArmyMovementLatencyTraceEntry,
} from "@bibliothecadao/eternum";

export interface WorldmapDebugWindow {
  testMaterialSharing?: () => void;
  testTroopDiffFx?: (diff?: number) => void;
  getArmyMovementLatencyTrace?: () => ArmyMovementLatencyTraceEntry[];
  getArmyMovementLatencySummary?: () => ArmyMovementLatencySummary;
  clearArmyMovementLatencyTrace?: () => void;
  simulateArmyGhostDesync?: (entityId: number) => boolean;
  simulateArmyPositionDesync?: (entityId: number, col: number, row: number) => boolean;
  getArmyGhostHardeningStats?: () => unknown;
}

// DEV-only desync injectors for the ghost-army reconcile loops: they reproduce
// the production failure modes (missed deletion event, rendered/RECS position
// drift) so the self-healing sweeps can be exercised without waiting for a
// real desync.
export interface WorldmapArmyDesyncHarnessHooks {
  simulateArmyGhostDesync: (entityId: number) => boolean;
  simulateArmyPositionDesync: (entityId: number, col: number, row: number) => boolean;
  getArmyGhostHardeningStats: () => unknown;
}

interface WorldmapDebugHooks {
  testMaterialSharing: () => void;
  testTroopDiffFx: (diff?: number) => void;
  armyDesyncHarness?: WorldmapArmyDesyncHarnessHooks;
}

export function installWorldmapDebugHooks<T extends object>(
  debugWindow: T & WorldmapDebugWindow,
  hooks: WorldmapDebugHooks,
): void {
  debugWindow.testMaterialSharing = hooks.testMaterialSharing;
  debugWindow.testTroopDiffFx = hooks.testTroopDiffFx;
  debugWindow.getArmyMovementLatencyTrace = () => snapshotArmyMovementLatencyTrace();
  debugWindow.getArmyMovementLatencySummary = () => summarizeArmyMovementLatency();
  debugWindow.clearArmyMovementLatencyTrace = () => clearArmyMovementLatencyTrace();
  if (hooks.armyDesyncHarness) {
    debugWindow.simulateArmyGhostDesync = hooks.armyDesyncHarness.simulateArmyGhostDesync;
    debugWindow.simulateArmyPositionDesync = hooks.armyDesyncHarness.simulateArmyPositionDesync;
    debugWindow.getArmyGhostHardeningStats = hooks.armyDesyncHarness.getArmyGhostHardeningStats;
  }
}

export function uninstallWorldmapDebugHooks<T extends object>(debugWindow: T & WorldmapDebugWindow): void {
  delete debugWindow.testMaterialSharing;
  delete debugWindow.testTroopDiffFx;
  delete debugWindow.getArmyMovementLatencyTrace;
  delete debugWindow.getArmyMovementLatencySummary;
  delete debugWindow.clearArmyMovementLatencyTrace;
  delete debugWindow.simulateArmyGhostDesync;
  delete debugWindow.simulateArmyPositionDesync;
  delete debugWindow.getArmyGhostHardeningStats;
}
