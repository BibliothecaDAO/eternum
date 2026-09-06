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
  initialize(): Promise<void>;
}

export function createGameRendererSession(input: CreateGameRendererSessionInput): GameRendererSession {
  // Construction starts the GPU handshake; scene initialization waits for synced game config.
  const renderer = (input.createRenderer ?? createDefaultGameRenderer)(input.setupResult);
  let disposed = false;
  const managed = createBrowserManagedRendererSession({
    renderer,
    windowObject: input.windowObject ?? window,
    onDispose: () => {
      disposed = true;
    },
  });
  let initialization: Promise<void> | undefined;
  const cleanup = () => {
    disposed = true;
    managed.cleanup();
  };
  const initialize = async () => {
    if (disposed) throw new Error("Renderer session was disposed before scene initialization");
    try {
      await renderer.initScene();
      if (disposed) throw new Error("Renderer session was disposed during scene initialization");
      if (input.enableDevTools) renderer.initStats();
    } catch (error) {
      cleanup();
      throw error;
    }
  };
  return { cleanup, initialize: () => (initialization ??= initialize()) };
}

function createDefaultGameRenderer(setupResult: SetupResult): GameRendererLike {
  return new GameRenderer(setupResult);
}

function createBrowserManagedRendererSession(input: {
  renderer: GameRendererLike;
  windowObject: GameRendererSessionWindow;
  onDispose: () => void;
}): Pick<GameRendererSession, "cleanup"> {
  const previousBeforeUnload = input.windowObject.onbeforeunload;
  let isDestroyed = false;

  const cleanup = () => {
    if (isDestroyed) {
      return;
    }

    isDestroyed = true;
    input.onDispose();

    try {
      input.renderer.destroy();
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
