import type { MapSnapshot } from "./renderer.js";
import type { MapProtocol } from "./protocol.js";

/**
 * Shared mutable context threaded through the map loop and all tools.
 *
 * The map loop writes to this object on every refresh; tools read from it to
 * get the latest ASCII map snapshot and coordinate lookups without issuing
 * additional network requests.
 */
export interface MapContext {
  /** Latest rendered map snapshot, or null before the first refresh completes. */
  snapshot: MapSnapshot | null;
  /** Structured query layer over the snapshot — like LSP for the map. */
  protocol: MapProtocol | null;
  /** Absolute path where the ASCII map is written after each refresh (typically `<dataDir>/map.txt`). Null in tests to skip disk writes. */
  filePath: string | null;
  /**
   * Trigger an immediate out-of-band map refresh.
   *
   * Set by the application entry point once the map loop is created. Tools call
   * this after a successful on-chain action so the snapshot reflects the new state
   * without waiting for the next scheduled interval.
   */
  refresh?: () => Promise<void>;
  /**
   * Positions known to be occupied by recently moved armies.
   * Keyed by tile "x,y" → army entity ID. Pruned when Torii confirms the army
   * at that position (occupierId matches). Patches the blocked set in pathfinding
   * so sequential moves don't route through each other.
   */
  recentlyMoved?: Map<string, number>;
  /**
   * Chests opened recently but not yet reflected in Torii's snapshot.
   * Keyed by tile "x,y". Pruned when the tile is absent from the snapshot
   * or its occupierType is no longer 34 (chest).
   */
  recentlyOpenedChests?: Set<string>;
  /**
   * Tiles our armies explored recently but not yet in Torii's snapshot.
   * Added after a successful explore move. Merged into the explored set for
   * pathfinding so subsequent moves treat these as passable. Pruned when
   * Torii's snapshot includes the tile.
   */
  recentlyExplored?: Set<string>;
  /**
   * Known actual stamina for armies that have moved recently.
   * Keyed by entity ID → { stamina, atTime } where atTime is the
   * wall-clock timestamp when the stamina was recorded. Expires after
   * 120 seconds (enough for Torii to catch up). Takes priority over
   * Torii's stale projection when present.
   */
  staminaSpent?: Map<number, { spent: number; atTick: number }>;
  /**
   * Overrides Torii stamina with known actual values from move results
   * or chain error messages. Keyed by entity ID → remaining stamina.
   * Cleared when the map loop confirms Torii has caught up.
   */
  knownStamina?: Map<number, { stamina: number; time: number }>;
}
