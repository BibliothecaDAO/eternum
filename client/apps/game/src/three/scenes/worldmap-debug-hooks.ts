import {
  clearArmyMovementLatencyTrace,
  snapshotArmyMovementLatencyTrace,
  type ArmyMovementLatencyTraceEntry,
} from "@bibliothecadao/eternum";

export interface WorldmapDebugWindow {
  testMaterialSharing?: () => void;
  testTroopDiffFx?: (diff?: number) => void;
  getArmyMovementLatencyTrace?: () => ArmyMovementLatencyTraceEntry[];
  clearArmyMovementLatencyTrace?: () => void;
}

interface WorldmapDebugHooks {
  testMaterialSharing: () => void;
  testTroopDiffFx: (diff?: number) => void;
}

export function installWorldmapDebugHooks<T extends object>(
  debugWindow: T & WorldmapDebugWindow,
  hooks: WorldmapDebugHooks,
): void {
  debugWindow.testMaterialSharing = hooks.testMaterialSharing;
  debugWindow.testTroopDiffFx = hooks.testTroopDiffFx;
  debugWindow.getArmyMovementLatencyTrace = () => snapshotArmyMovementLatencyTrace();
  debugWindow.clearArmyMovementLatencyTrace = () => clearArmyMovementLatencyTrace();
}

export function uninstallWorldmapDebugHooks<T extends object>(debugWindow: T & WorldmapDebugWindow): void {
  delete debugWindow.testMaterialSharing;
  delete debugWindow.testTroopDiffFx;
  delete debugWindow.getArmyMovementLatencyTrace;
  delete debugWindow.clearArmyMovementLatencyTrace;
}
