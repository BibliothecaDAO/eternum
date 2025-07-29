import { Position } from "@/types/position";
import { Structure } from "@bibliothecadao/types";

/**
 * Navigate to a structure by updating the URL and dispatching a URL change event
 * This can be used from any scene (Hexception, WorldMap, etc.) to navigate to a structure
 *
 * @param structure - The structure to navigate to
 * @param scene - Optional scene to navigate to ('hex' or 'map'). Defaults to current scene.
 */
export function navigateToStructure(col: number, row: number, scene?: "hex" | "map") {
  const url = new Position({ x: col, y: row });

  // Determine which URL method to use based on scene parameter or current URL
  let navigationUrl: string;
  if (scene === "hex") {
    navigationUrl = url.toHexLocationUrl();
  } else if (scene === "map") {
    navigationUrl = url.toMapLocationUrl();
  } else {
    // If no scene specified, stay in the current scene
    const currentPath = window.location.pathname;
    if (currentPath.includes("/hex")) {
      navigationUrl = url.toHexLocationUrl();
    } else {
      navigationUrl = url.toMapLocationUrl();
    }
  }

  // Update browser URL
  window.history.pushState({}, "", navigationUrl);

  // Dispatch URL changed event to trigger scene updates
  window.dispatchEvent(new Event("urlChanged"));
}

/**
 * Navigate to a position by updating the URL and dispatching a URL change event
 *
 * @param col - Column coordinate
 * @param row - Row coordinate
 * @param scene - Optional scene to navigate to ('hex' or 'map'). Defaults to current scene.
 */
export function navigateToPosition(col: number, row: number, scene?: "hex" | "map") {
  const url = new Position({ x: col, y: row });

  // Determine which URL method to use based on scene parameter or current URL
  let navigationUrl: string;
  if (scene === "hex") {
    navigationUrl = url.toHexLocationUrl();
  } else if (scene === "map") {
    navigationUrl = url.toMapLocationUrl();
  } else {
    // If no scene specified, stay in the current scene
    const currentPath = window.location.pathname;
    if (currentPath.includes("/hex")) {
      navigationUrl = url.toHexLocationUrl();
    } else {
      navigationUrl = url.toMapLocationUrl();
    }
  }

  // Update browser URL
  window.history.pushState({}, "", navigationUrl);

  // Dispatch URL changed event to trigger scene updates
  window.dispatchEvent(new Event("urlChanged"));
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

  navigateToStructure(structure.position.x, structure.position.y, scene);

  console.log(
    `Selected structure: ${structure.ownerName}'s structure at (${structure.position.x}, ${structure.position.y})`,
  );

  return nextIndex;
}

/**
 * Toggle between map and hex views while preserving the current location
 * Changes /map?col=X&row=Y to /hex?col=X&row=Y and vice versa
 */
export function toggleMapHexView() {
  const currentUrl = new URL(window.location.href);
  const currentPath = currentUrl.pathname;

  // Get current coordinates from URL params
  const col = currentUrl.searchParams.get("col");
  const row = currentUrl.searchParams.get("row");

  if (!col || !row) {
    console.warn("No coordinates found in URL, cannot toggle view");
    return;
  }

  // Determine new path based on current path
  let newPath: string;
  if (currentPath.includes("/hex")) {
    newPath = "/map";
  } else if (currentPath.includes("/map")) {
    newPath = "/hex";
  } else {
    console.warn("Current path is neither /hex nor /map, cannot toggle");
    return;
  }

  // Construct new URL with same coordinates
  const newUrl = `${newPath}?col=${col}&row=${row}`;

  // Update browser URL
  window.history.pushState({}, "", newUrl);

  // Dispatch URL changed event to trigger scene updates
  window.dispatchEvent(new Event("urlChanged"));

  console.log(`Toggled view from ${currentPath} to ${newPath}`);
}
