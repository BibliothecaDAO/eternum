import { Position } from "@bibliothecadao/eternum";
import { parsePlayRoute } from "@/play/navigation/play-route";
import { openPlace } from "@/play/navigation/open-place";

import { Structure } from "@bibliothecadao/types";
import { resolveNavigationSceneTarget } from "../scene-navigation-boundary";
import { SceneName } from "../types";

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

  openPlace(targetScene === SceneName.Hexception ? "hex" : "map", position);
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
  const playRoute = parsePlayRoute(window.location);
  if (!playRoute) throw new Error(`Cannot toggle scenes outside a game route: ${window.location.pathname}`);
  if (playRoute.col === null || playRoute.row === null) {
    console.warn("No coordinates found in URL, cannot toggle view");
    return;
  }

  // The URL's hex is normalized (mapRouteHex).
  openPlace(playRoute.scene === "hex" ? "map" : "hex", Position.fromNormalized({ x: playRoute.col, y: playRoute.row }));
}
