import type { MapSnapshot } from "./renderer.js";

/** Shared mutable ref so all tools and the map loop can access the latest map snapshot. */
export interface MapContext {
  snapshot: MapSnapshot | null;
  /** Path to write the ASCII map file (null in tests). */
  filePath: string | null;
  /** Force an immediate map refresh (set by main after map loop is created). */
  refresh?: () => Promise<void>;
  /**
   * Positions known to be occupied by armies that just moved this tick.
   * Cleared on each fresh map load from Torii. Used to patch the blocked
   * set in pathfinding so sequential moves don't route through each other.
   * Keys are "x,y" strings.
   */
  recentlyMoved?: Set<string>;
}
