import type { SetupResult } from "@bibliothecadao/dojo";
import { createGameRendererSession, type GameRendererSession } from "./game-renderer-session";

let activeGameRendererSession: GameRendererSession | null = null;

export const prepareGameRenderer = (setupResult: SetupResult, enableDevTools: boolean): GameRendererSession => {
  activeGameRendererSession?.cleanup();
  const session = createGameRendererSession({ enableDevTools, setupResult });
  activeGameRendererSession = session;
  return {
    initialize: session.initialize,
    cleanup: () => {
      session.cleanup();
      if (activeGameRendererSession === session) activeGameRendererSession = null;
    },
  };
};
