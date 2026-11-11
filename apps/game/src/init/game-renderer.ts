import type { GameClientSetup as SetupResult } from "@bibliothecadao/eternum/game-client";

import { createLazyMapRenderer } from "@/map-client/lazy-map-renderer";
import { resolveMapClientFromSearch } from "@/map-client/map-client-flag";
import { parsePlayRoute } from "@/play/navigation/play-route";

import { createGameRendererSession, type GameRendererSession } from "./game-renderer-session";

let activeGameRendererSession: GameRendererSession | null = null;

export const prepareGameRenderer = (setupResult: SetupResult, enableDevTools: boolean): GameRendererSession => {
  activeGameRendererSession?.cleanup();
  const session = createGameRendererSession({
    createRenderer: asksForMapClient(window.location) ? createLazyMapRenderer : undefined,
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

/**
 * Whether the page's address asks for the map client under trial. It draws the world map only, so an address of the
 * realm view is drawn by the game's own renderer whatever it asks.
 */
function asksForMapClient(location: Pick<Location, "pathname" | "search">): boolean {
  return resolveMapClientFromSearch(location.search) === "next" && parsePlayRoute(location)?.scene !== "hex";
}
