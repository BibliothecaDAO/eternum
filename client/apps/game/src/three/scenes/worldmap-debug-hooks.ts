export interface WorldmapDebugWindow {
  testMaterialSharing?: () => void;
  testTroopDiffFx?: (diff?: number) => void;
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
}

export function uninstallWorldmapDebugHooks<T extends object>(debugWindow: T & WorldmapDebugWindow): void {
  delete debugWindow.testMaterialSharing;
  delete debugWindow.testTroopDiffFx;
}
