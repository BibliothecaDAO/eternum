import type { MapSnapshot } from "./renderer.js";

/** Shared mutable ref so all tools and the map loop can access the latest map snapshot. */
export interface MapContext {
  snapshot: MapSnapshot | null;
  /** Path to write the ASCII map file (null in tests). */
  filePath: string | null;
  /** Force an immediate map refresh (set by main after map loop is created). */
  refresh?: () => Promise<void>;
  /**
   * Positions known to be occupied by armies that moved recently.
   * Keyed by tile "x,y" → army entity ID. Entries are pruned when Torii's
   * snapshot confirms the army at that position (occupierId matches).
   * Used to patch the blocked set in pathfinding so sequential moves
   * don't route through each other.
   */
  recentlyMoved?: Map<string, number>;
  /**
   * Stamina consumed by each army since last on-chain update.
   * Keyed by entity ID → { spent, atTick } where atTick is the
   * staminaUpdatedTick when the spend was recorded. When explorerInfo
   * returns a newer staminaUpdatedTick, the entry is stale and ignored.
   */
  staminaSpent?: Map<number, { spent: number; atTick: number }>;
}
