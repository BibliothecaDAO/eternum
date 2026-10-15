/** The world map's selection as the page shows it: the selected hex, the structure on it and the hexes ringed. */
interface MapSelectionSnapshot {
  hex: { col: number; row: number } | null;
  structure: { id: number; owner: string; realm: boolean; ownedByViewer: boolean } | null;
  /** Hexes the ownership ring layer draws: every one the selected structure's owner holds, or none. */
  ringedHexes: number;
}

interface MapSelectionWindow {
  __eternumMapSelection?: MapSelectionSnapshot;
}

/**
 * Mirrors the map's selection after every change of it or of what it rings, for checks that cannot see the canvas
 * (the playtest's ownership-ring steps). Read it as `window.__eternumMapSelection`.
 */
export const publishMapSelection = (snapshot: MapSelectionSnapshot): void => {
  if (typeof window === "undefined") return;
  (window as typeof window & MapSelectionWindow).__eternumMapSelection = snapshot;
};
