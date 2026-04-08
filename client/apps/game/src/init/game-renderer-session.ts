import type { SetupResult } from "@bibliothecadao/dojo";

import GameRenderer from "../three/game-renderer";

type GameRendererLike = Pick<GameRenderer, "destroy" | "initScene" | "initStats">;
type BeforeUnloadHandler = NonNullable<Window["onbeforeunload"]>;

interface GameRendererSessionWindow {
  addEventListener(type: "pagehide", listener: EventListenerOrEventListenerObject): void;
  onbeforeunload: BeforeUnloadHandler | null;
  removeEventListener(type: "pagehide", listener: EventListenerOrEventListenerObject): void;
}

interface CreateGameRendererSessionInput {
  createRenderer?: (setupResult: SetupResult) => GameRendererLike;
  enableDevTools: boolean;
  setupResult: SetupResult;
  windowObject?: GameRendererSessionWindow;
}

export interface GameRendererSession {
  cleanup(): void;
}

export async function createGameRendererSession(input: CreateGameRendererSessionInput): Promise<GameRendererSession> {
  const renderer = (input.createRenderer ?? createDefaultGameRenderer)(input.setupResult);

  await renderer.initScene();
  if (input.enableDevTools) {
    renderer.initStats();
  }

  return createBrowserManagedRendererSession({
    renderer,
    windowObject: input.windowObject ?? window,
  });
}

function createDefaultGameRenderer(setupResult: SetupResult): GameRendererLike {
  return new GameRenderer(setupResult);
}

function createBrowserManagedRendererSession(input: {
  renderer: GameRendererLike;
  windowObject: GameRendererSessionWindow;
}): GameRendererSession {
  const previousBeforeUnload = input.windowObject.onbeforeunload;
  let isDestroyed = false;

  const cleanup = () => {
    if (isDestroyed) {
      return;
    }

    isDestroyed = true;

    try {
      input.renderer.destroy();
      console.log("GameRenderer cleaned up");
    } catch (error) {
      console.error("Error during GameRenderer cleanup:", error);
    } finally {
      input.windowObject.removeEventListener("pagehide", cleanup);
      input.windowObject.onbeforeunload = previousBeforeUnload;
    }
  };

  input.windowObject.onbeforeunload = (event) => {
    previousBeforeUnload?.call(input.windowObject as never, event);
    cleanup();
  };

  input.windowObject.addEventListener("pagehide", cleanup);

  return {
    cleanup,
  };
}
