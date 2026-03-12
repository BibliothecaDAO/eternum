interface RendererDebugWindow {
  __gameRenderer?: unknown;
  __memoryMonitorRenderer?: unknown;
}

export function registerGameRendererDebugGlobals(
  debugWindow: RendererDebugWindow,
  gameRenderer: unknown,
  renderer: unknown,
): void {
  debugWindow.__gameRenderer = gameRenderer;
  debugWindow.__memoryMonitorRenderer = renderer;
}

export function clearGameRendererDebugGlobals(debugWindow: RendererDebugWindow): void {
  delete debugWindow.__gameRenderer;
  delete debugWindow.__memoryMonitorRenderer;
}
