export interface RendererDebugWindow {
  __gameRenderer?: unknown;
  __memoryMonitorRenderer?: unknown;
}

export function registerGameRendererDebugGlobals<T extends object>(
  debugWindow: T & RendererDebugWindow,
  gameRenderer: unknown,
  renderer: unknown,
): void {
  debugWindow.__gameRenderer = gameRenderer;
  debugWindow.__memoryMonitorRenderer = renderer;
}

export function clearGameRendererDebugGlobals<T extends object>(debugWindow: T & RendererDebugWindow): void {
  delete debugWindow.__gameRenderer;
  delete debugWindow.__memoryMonitorRenderer;
}
