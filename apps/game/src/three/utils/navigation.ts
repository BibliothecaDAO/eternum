import { traceFlightMark } from "../flight-trace";
import { Position } from "@bibliothecadao/eternum";
import { buildPlayHref, parsePlayRoute } from "@/play/navigation/play-route";

import { Structure } from "@bibliothecadao/types";
import { resolveNavigationSceneTarget } from "../scene-navigation-boundary";
import { SceneName } from "../types";

function buildSceneLocationUrl(position: Position, targetScene: SceneName): string {
  const playRoute = requirePlayRoute();
  const normalized = position.getNormalized();
  return buildPlayHref({ ...playRoute, scene: targetScene, col: normalized.x, row: normalized.y });
}

function requirePlayRoute() {
  const playRoute = parsePlayRoute(window.location);
  if (!playRoute) throw new Error(`Cannot navigate scenes outside a game route: ${window.location.pathname}`);
  return playRoute;
}

function dispatchSceneNavigation(navigationUrl: string): void {
  traceFlightMark(`navigate ${navigationUrl}`);
  window.history.pushState({}, "", navigationUrl);
  window.dispatchEvent(new Event("urlChanged"));
  traceFlightMark("urlChanged listeners done");
}

/**
 * Navigate to a structure by updating the URL and dispatching a URL change event
 * This can be used from any scene (Hexception, WorldMap, etc.) to navigate to a structure
 *
 * @param structure - The structure to navigate to
 * @param scene - Optional scene to navigate to ('hex' or 'map'). Defaults to current scene.
 */
export function navigateToStructure(position: Position, scene?: "hex" | "map") {
  const targetScene = resolveNavigationSceneTarget({
    requestedScene: scene === "hex" ? SceneName.Hexception : scene === "map" ? SceneName.WorldMap : undefined,
    currentPath: window.location.pathname,
  });

  dispatchSceneNavigation(buildSceneLocationUrl(position, targetScene));
}

/**
 * Cycle through player structures and navigate to the next one
 *
 * @param playerStructures - Array of player structures
 * @param currentIndex - Current structure index
 * @param scene - Optional scene to navigate to ('hex' or 'map'). Defaults to current scene.
 * @returns Updated index after cycling
 */
export function selectNextStructure(
  playerStructures: Structure[],
  currentIndex: number,
  scene?: "hex" | "map",
): number {
  if (playerStructures.length === 0) return currentIndex;

  const nextIndex = (currentIndex + 1) % playerStructures.length;
  const structure = playerStructures[nextIndex];

  navigateToStructure(Position.fromContract(structure.position), scene);

  return nextIndex;
}

/**
 * Toggle between map and hex views while preserving the current location
 * Changes /map?col=X&row=Y to /hex?col=X&row=Y and vice versa
 */
export function toggleMapHexView() {
  const playRoute = requirePlayRoute();
  if (playRoute.col === null || playRoute.row === null) {
    console.warn("No coordinates found in URL, cannot toggle view");
    return;
  }

  dispatchSceneNavigation(buildPlayHref({ ...playRoute, scene: playRoute.scene === "hex" ? "map" : "hex" }));
}
