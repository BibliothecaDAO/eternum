import type { GameClientSetup as SetupResult } from "@bibliothecadao/eternum/game-client";

import { resolveMapClientFromSearch } from "@/map-client/map-client-flag";
import { MapClientRenderer } from "@/map-client/map-renderer";

import { createGameRendererSession, type GameRendererSession } from "./game-renderer-session";

let activeGameRendererSession: GameRendererSession | null = null;

export const prepareGameRenderer = (setupResult: SetupResult, enableDevTools: boolean): GameRendererSession => {
  activeGameRendererSession?.cleanup();
  const session = createGameRendererSession({
    // The map client under trial draws the map only when the page's address asks for it.
    createRenderer:
      resolveMapClientFromSearch(window.location.search) === "next"
        ? (setup) => new MapClientRenderer(setup)
        : undefined,
    enableDevTools,
    setupResult,
  });
  activeGameRendererSession = session;
  return {
    initialize: session.initialize,
    cleanup: () => {
      session.cleanup();
      if (activeGameRendererSession === session) activeGameRendererSession = null;
    },
  };
};
