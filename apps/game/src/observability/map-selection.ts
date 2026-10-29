/**
 * The world map's selection as the page shows it: the selected hex, the structure on it, the hexes ringed, the army,
 * the structure under the pointer, and the hex the camera looks at.
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
  /** The camera target in contract hexes, used to check map links and the realm site after a day turn. */
  camera: { col: number; row: number } | null;
  /** The layer the map shows: the depth below (true) or the surface. */
  layer: boolean;
  /** Where the screen draws the selected hex (page px): a tapped chest, once a phone's camera has framed it. */
  hexOnScreen: { x: number; y: number } | null;
}

interface MapSelectionWindow {
  __eternumMapSelection?: MapSelectionSnapshot;
}

/**
 * Mirrors the map's selection after every change of it, of what it rings, of the selected army's orders or of where
 * the camera looks, for checks that cannot see the canvas (the playtest's ownership-ring, army and link steps). Each
 * source publishes its own part. Read it as `window.__eternumMapSelection`.
 */
export const publishMapSelection = (part: Partial<MapSelectionSnapshot>): void => {
  if (typeof window === "undefined") return;
  const page = window as typeof window & MapSelectionWindow;
  page.__eternumMapSelection = { ...page.__eternumMapSelection, ...part } as MapSelectionSnapshot;
};
