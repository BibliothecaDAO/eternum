import {
  clearArmyMovementLatencyTrace,
  snapshotArmyMovementLatencyTrace,
  summarizeArmyMovementLatency,
  type ArmyMovementLatencySummary,
  type ArmyMovementLatencyTraceEntry,
} from "@bibliothecadao/eternum";
import type { ProceduralArmyProductionStats } from "../managers/army-manager";

export interface WorldmapDebugWindow {
  testMaterialSharing?: () => void;
  testTroopDiffFx?: (diff?: number) => void;
  getArmyMovementLatencyTrace?: () => ArmyMovementLatencyTraceEntry[];
  getArmyMovementLatencySummary?: () => ArmyMovementLatencySummary;
  clearArmyMovementLatencyTrace?: () => void;
  getProceduralArmyProductionStats?: () => ProceduralArmyProductionStats;
}

interface WorldmapDebugHooks {
  testMaterialSharing: () => void;
  testTroopDiffFx: (diff?: number) => void;
  getProceduralArmyProductionStats: () => ProceduralArmyProductionStats;
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
  debugWindow.getProceduralArmyProductionStats = hooks.getProceduralArmyProductionStats;
}

export function uninstallWorldmapDebugHooks<T extends object>(debugWindow: T & WorldmapDebugWindow): void {
  delete debugWindow.testMaterialSharing;
  delete debugWindow.testTroopDiffFx;
  delete debugWindow.getArmyMovementLatencyTrace;
  delete debugWindow.getArmyMovementLatencySummary;
  delete debugWindow.clearArmyMovementLatencyTrace;
  delete debugWindow.getProceduralArmyProductionStats;
}
