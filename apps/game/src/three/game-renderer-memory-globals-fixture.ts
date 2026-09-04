import { clearGameRendererDebugGlobals, registerGameRendererDebugGlobals } from "./game-renderer-debug-globals";

interface RendererDebugWindow {
  __gameRenderer?: unknown;
  __memoryMonitorRenderer?: unknown;
}

interface GameRendererMemoryGlobalsFixture {
  debugWindow: RendererDebugWindow;
  setup(): void;
  destroy(): void;
}

export function createGameRendererMemoryGlobalsFixture(): GameRendererMemoryGlobalsFixture {
  const debugWindow: RendererDebugWindow = {};
  const subject = {};
  const renderer = {};

  return {
    debugWindow,
    setup() {
      registerGameRendererDebugGlobals(debugWindow, subject, renderer);
    },
    destroy() {
      clearGameRendererDebugGlobals(debugWindow);
    },
  };
}
