/**
 * The world map's selection as the page shows it: the selected hex, the structure on it, the hexes ringed, the army,
 * and the structure under the pointer.
 */
interface MapSelectionSnapshot {
  hex: { col: number; row: number } | null;
  structure: { id: number; owner: string; realm: boolean; ownedByViewer: boolean } | null;
  /** Hexes the ownership ring layer draws: every one the selected structure's owner holds, or none. */
  ringedHexes: number;
  /** The selected army, its hex, and how many tiles it is offered an order on (none while its order is in flight). */
  army: { id: number; hex: { col: number; row: number }; orders: number } | null;
  /**
   * The structure under the pointer, whether it is the viewer's, and whether it is the holding the HUD has selected
   * (the proof's transfer gesture right-clicks another of the viewer's).
   */
  hovered: { id: number; ownedByViewer: boolean; selectedHolding: boolean } | null;
}

interface MapSelectionWindow {
  __eternumMapSelection?: MapSelectionSnapshot;
}

/**
 * Mirrors the map's selection after every change of it, of what it rings or of the selected army's orders, for checks
 * that cannot see the canvas (the playtest's ownership-ring and army steps). Each source publishes its own part. Read
 * it as `window.__eternumMapSelection`.
 */
export const publishMapSelection = (part: Partial<MapSelectionSnapshot>): void => {
  if (typeof window === "undefined") return;
  const page = window as typeof window & MapSelectionWindow;
  page.__eternumMapSelection = { ...page.__eternumMapSelection, ...part } as MapSelectionSnapshot;
};
