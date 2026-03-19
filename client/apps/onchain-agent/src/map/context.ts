/**
 * Shared map context that bridges the background map loop and agent tools.
 *
 * A single {@link MapContext} object is created at startup and passed by
 * reference to every tool and the map refresh loop. The loop writes fresh
 * snapshots into it; tools read from it to get up-to-date world state
 * without additional network calls. Several "recently*" fields act as
 * optimistic patches — they record on-chain actions that have been submitted
 * but not yet indexed by Torii, preventing stale reads from causing
 * double-moves or routing through occupied tiles.
 *
 * @see {@link MapSnapshot} for the rendered ASCII grid and coordinate helpers.
 * @see {@link MapProtocol} for the typed query layer over the snapshot.
 *
 * @example
 * ```ts
 * const mapCtx: MapContext = { snapshot: null, protocol: null, filePath: join(dataDir, "map.txt") };
 * // After the first map loop tick, mapCtx.snapshot and mapCtx.protocol are populated.
 * ```
 *
 * @module
 */
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
  /** Latest rendered map snapshot, or `null` before the first refresh completes. */
  snapshot: MapSnapshot | null;

  /**
   * Structured query layer over the snapshot — like LSP for the map.
   *
   * Provides typed operations (`tileInfo`, `nearby`, `find`, etc.) so tools
   * can query the world without visually parsing the ASCII grid.
   *
   * @see {@link MapProtocol}
   */
  protocol: MapProtocol | null;

  /**
   * Absolute path where the ASCII map is written after each refresh.
   *
   * Typically `<dataDir>/map.txt`. Set to `null` in tests to skip disk writes.
   */
  filePath: string | null;

  /**
   * Trigger an immediate out-of-band map refresh.
   *
   * Set by the application entry point once the map loop is created. Tools call
   * this after a successful on-chain action so the snapshot reflects the new state
   * without waiting for the next scheduled interval.
   *
   * @example
   * ```ts
   * await mapCtx.refresh?.();
   * // mapCtx.snapshot now reflects the latest on-chain state
   * ```
   */
  refresh?: () => Promise<void>;

  /**
   * Optimistic position claims for recently moved armies.
   *
   * Keyed by `"x,y"` world coordinates, value is the army entity ID that moved
   * there. Prevents pathfinding from routing subsequent armies through tiles
   * that are occupied but not yet indexed by Torii. Entries are pruned once
   * Torii confirms the occupier at that position.
   */
  recentlyMoved?: Map<string, number>;

  /**
   * Chests opened recently but not yet reflected in Torii's snapshot.
   *
   * Keyed by `"x,y"` world coordinates. Prevents tools from trying to open
   * the same chest twice. Pruned when the tile is absent from the snapshot
   * or its occupierType is no longer 34 (chest).
   */
  recentlyOpenedChests?: Set<string>;

  /**
   * Tiles explored by our armies but not yet present in Torii's snapshot.
   *
   * Added after a successful explore move. Merged into the explored set for
   * pathfinding so subsequent moves treat these tiles as passable. Pruned
   * once Torii's snapshot includes the tile.
   */
  recentlyExplored?: Set<string>;

  /**
   * Stamina consumed by recent moves, before Torii indexes the update.
   *
   * Keyed by explorer entity ID. Each entry records how many stamina points
   * were spent (`spent`) and the game tick at which the spend occurred
   * (`atTick`). Used to subtract from Torii's stale stamina projection
   * so tools don't overestimate remaining stamina.
   */
  staminaSpent?: Map<number, {
    /** Stamina points consumed by the move. */
    spent: number;
    /** Game tick when the stamina was spent. */
    atTick: number;
  }>;

  /**
   * Authoritative stamina overrides from move results or chain error messages.
   *
   * Keyed by explorer entity ID. Takes priority over Torii's stale stamina
   * when present. Cleared when the map loop confirms Torii has caught up.
   */
  knownStamina?: Map<number, {
    /** Remaining stamina for the explorer. */
    stamina: number;
    /** Wall-clock timestamp (ms) when the value was recorded. Expires after ~120s. */
    time: number;
  }>;
}
