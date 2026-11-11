import type { GameClientSetup as SetupResult } from "@bibliothecadao/eternum/game-client";

import { createLazyMapRenderer } from "@/map-client/lazy-map-renderer";
import { mapClientFor } from "@/map-client/map-client-flag";

import { createGameRendererSession, type GameRendererSession } from "./game-renderer-session";

let activeGameRendererSession: GameRendererSession | null = null;

export const prepareGameRenderer = (setupResult: SetupResult, enableDevTools: boolean): GameRendererSession => {
  activeGameRendererSession?.cleanup();
  const session = createGameRendererSession({
    // One renderer to a page: the map client where the build or the address gives it the map, else the game's own.
    createRenderer: mapClientFor(window.location.search) === "next" ? createLazyMapRenderer : undefined,
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
