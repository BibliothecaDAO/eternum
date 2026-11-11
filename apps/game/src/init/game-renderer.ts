import type { GameClientSetup as SetupResult } from "@bibliothecadao/eternum/game-client";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { createLazyMapRenderer } from "@/map-client/lazy-map-renderer";
import { mapClientFor } from "@/map-client/map-client-flag";
import { parsePlayRoute } from "@/play/navigation/play-route";
import GameRenderer from "@/three/game-renderer";

import { createGameRendererSession, type GameRendererSession } from "./game-renderer-session";
import { createSwitchingRenderer } from "./switching-renderer";

let activeGameRendererSession: GameRendererSession | null = null;

export const prepareGameRenderer = (setupResult: SetupResult, enableDevTools: boolean): GameRendererSession => {
  activeGameRendererSession?.cleanup();
  const session = createGameRendererSession({
    // A page whose map is the game's own renderer's is left exactly as it was: the renderer session makes it.
    createRenderer: mapClientFor(window.location.search) === "next" ? createMapOrGameRenderer : undefined,
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

/** The events that tell the page's address changed (`renderer-route-runtime.ts`). */
const ROUTE_EVENTS = ["urlChanged", "popstate", "sceneAddressChanged"] as const;

/**
 * What the map client draws: the world map's surface. Everything else the game shows (the realm view, the Ethereal
 * layers and the Deep under them) is drawn by the game's own renderer.
 */
export function mapClientDraws(location: Pick<Location, "pathname" | "search">, layer: boolean): boolean {
  return parsePlayRoute(location)?.scene !== "hex" && !layer;
}

/**
 * The renderer of a page whose map is the map client's: the map client while the page shows what it draws, and the
 * game's own renderer for everything else, each taking over from the other in place as the player moves between them.
 */
function createMapOrGameRenderer(setup: SetupResult) {
  return createSwitchingRenderer(setup, {
    create: { map: createLazyMapRenderer, game: (given) => new GameRenderer(given) },
    pick: () => (mapClientDraws(window.location, useUIStore.getState().mapLayer) ? "map" : "game"),
    watch: (changed) => {
      for (const event of ROUTE_EVENTS) window.addEventListener(event, changed);
      const stopLayer = useUIStore.subscribe((state) => state.mapLayer, changed);
      return () => {
        for (const event of ROUTE_EVENTS) window.removeEventListener(event, changed);
        stopLayer();
      };
    },
    onSwitch: () => useUIStore.getState().setIsLoadingScreenEnabled(true),
  });
}
