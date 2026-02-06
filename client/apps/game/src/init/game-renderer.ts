import type { SetupResult } from "@bibliothecadao/dojo";

import GameRenderer from "../three/game-renderer";

export const initializeGameRenderer = (setupResult: SetupResult, enableDevTools: boolean) => {
  // CRITICAL: Clean up any existing GameRenderer before creating a new one
  // This prevents memory leaks when navigating home and back to the game
  if ((window as any).__cleanupGameRenderer) {
    console.log("[initializeGameRenderer] Cleaning up existing GameRenderer before creating new one");
    (window as any).__cleanupGameRenderer();
  }

  const renderer = new GameRenderer(setupResult);

  renderer.initScene();
  if (enableDevTools) {
    renderer.initStats();
  }

  const existingUnloadHandler = window.onbeforeunload;
  let isDestroyed = false;

  const cleanup = () => {
    if (isDestroyed) {
      return;
    }
    isDestroyed = true;

    try {
      renderer.destroy();
      console.log("GameRenderer cleaned up");
    } catch (error) {
      console.error("Error during GameRenderer cleanup:", error);
    } finally {
      window.removeEventListener("pagehide", cleanup);
      window.onbeforeunload = existingUnloadHandler;
      if ((window as any).__cleanupGameRenderer === cleanup) {
        delete (window as any).__cleanupGameRenderer;
      }
    }
  };

  window.onbeforeunload = (event) => {
    if (existingUnloadHandler) {
      existingUnloadHandler.call(window, event);
    }
    cleanup();
  };

  window.addEventListener("pagehide", cleanup);
  (window as any).__cleanupGameRenderer = cleanup;

  return cleanup;
};
