import type { SetupResult } from "@bibliothecadao/dojo";

import { createGameRendererSession, type GameRendererSession } from "./game-renderer-session";

let activeGameRendererSession: GameRendererSession | null = null;

export const initializeGameRenderer = async (setupResult: SetupResult, enableDevTools: boolean) => {
  disposeActiveGameRendererSession();
  const session = await createGameRendererSession({
    enableDevTools,
    setupResult,
  });
  activeGameRendererSession = session;

  return () => {
    session.cleanup();
    if (activeGameRendererSession === session) {
      activeGameRendererSession = null;
    }
  };
};

function disposeActiveGameRendererSession() {
  if (!activeGameRendererSession) {
    return;
  }

  console.log("[initializeGameRenderer] Cleaning up existing GameRenderer before creating new one");
  activeGameRendererSession.cleanup();
  activeGameRendererSession = null;
}
