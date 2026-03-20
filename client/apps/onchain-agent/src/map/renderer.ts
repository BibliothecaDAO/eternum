/**
 * Map snapshot builder for the Eternum world map.
 *
 * Converts raw tile state into a {@link MapSnapshot} with a spatial grid index
 * and coordinate helpers. Used by the map loop, protocol layer, and core tools.
 */

import type { TileState, ExplorerInfo, StructureInfo } from "@bibliothecadao/client";
import type { StaminaConfig } from "@bibliothecadao/torii";

/**
 * Immutable snapshot of the map state and associated lookup helpers.
 *
 * Returned by {@link renderMap} and stored in {@link MapContext} so all tools
 * share a consistent world view between map loop refreshes.
 */
export interface MapSnapshot {
  /** Total map rows in the bounding box. */
  rowCount: number;
  /** Total map columns in the bounding box. */
  colCount: number;
  /** All tiles used to build this snapshot. */
  tiles: TileState[];
  /** Fast lookup by world hex coordinate ("x,y" → TileState). */
  gridIndex: Map<string, TileState>;
  /**
   * Resolve a 1-indexed map row and column to world hex coordinates.
   *
   * @param row - 1-indexed map row (top = 1).
   * @param col - 1-indexed map column (left = 1).
   * @returns The world hex coordinates, or null if out of bounds.
   */
  resolve(row: number, col: number): { x: number; y: number } | null;
  /**
   * Return the tile at a 1-indexed map row and column.
   *
   * @param row - 1-indexed map row (top = 1).
   * @param col - 1-indexed map column (left = 1).
   * @returns The TileState at that position, or null if unexplored or out of bounds.
   */
  tileAt(row: number, col: number): TileState | null;
  /** Per-explorer metadata, stored for downstream consumers. */
  explorerDetails: Map<number, any>;
  /** Per-structure metadata, stored for downstream consumers. */
  structureDetails: Map<number, any>;
  /** Fixed coordinate anchor — pass to subsequent renders to keep row:col stable. */
  anchor: MapAnchor;
}

/**
 * Fixed coordinate anchor that locks the bounding box of the rendered map.
 *
 * Pass the anchor from a previous {@link MapSnapshot} to the next {@link renderMap}
 * call to keep row:col positions stable as new tiles are explored.
 */
export interface MapAnchor {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Build a map snapshot from explored tiles.
 *
 * Computes the bounding box, builds a spatial grid index, and attaches
 * explorer/structure metadata for downstream consumers (protocol, tools).
 *
 * @param tiles - All explored tile states from the Torii query.
 * @param ownedEntityIds - Entity IDs owned by the player (unused after ASCII removal, kept for API compat).
 * @param explorerDetails - Per-explorer metadata (troop count, type, stamina).
 * @param staminaConfig - Stamina config (unused after ASCII removal, kept for API compat).
 * @param mapAnchor - Previous anchor to keep coordinates stable across refreshes.
 * @param structureDetails - Per-structure metadata (level, army slots, resources).
 * @returns A {@link MapSnapshot} with the grid index, lookup helpers, and anchor.
 */
export function renderMap(
  tiles: TileState[],
  _ownedEntityIds?: Set<number>,
  explorerDetails?: Map<number, ExplorerInfo>,
  _staminaConfig?: StaminaConfig,
  mapAnchor?: MapAnchor,
  structureDetails?: Map<number, StructureInfo>,
): MapSnapshot {
  if (tiles.length === 0) {
    return {
      rowCount: 0,
      colCount: 0,
      tiles: [],
      gridIndex: new Map(),
      resolve: () => null,
      tileAt: () => null,
      explorerDetails: explorerDetails ?? new Map(),
      structureDetails: structureDetails ?? new Map(),
      anchor: mapAnchor ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    };
  }

  // Compute bounding box
  let rawMinX = Infinity, rawMaxX = -Infinity;
  let rawMinY = Infinity, rawMaxY = -Infinity;
  const grid = new Map<string, TileState>();

  for (const t of tiles) {
    if (t.position.x < rawMinX) rawMinX = t.position.x;
    if (t.position.x > rawMaxX) rawMaxX = t.position.x;
    if (t.position.y < rawMinY) rawMinY = t.position.y;
    if (t.position.y > rawMaxY) rawMaxY = t.position.y;
    grid.set(`${t.position.x},${t.position.y}`, t);
  }

  // Use the fixed anchor if provided (keeps coordinates stable across renders).
  const minX = mapAnchor?.minX ?? rawMinX;
  const minY = mapAnchor?.minY ?? rawMinY;
  const maxX = Math.max(mapAnchor?.maxX ?? rawMaxX, rawMaxX);
  const maxY = Math.max(mapAnchor?.maxY ?? rawMaxY, rawMaxY);

  const totalRows = maxY - minY + 1;
  const totalCols = maxX - minX + 1;

  function resolve(mapRow: number, col: number): { x: number; y: number } | null {
    if (mapRow < 1 || mapRow > totalRows || col < 1 || col > totalCols) return null;
    const y = maxY - (mapRow - 1);
    const x = minX + (col - 1);
    return { x, y };
  }

  function tileAt(mapRow: number, col: number): TileState | null {
    const pos = resolve(mapRow, col);
    if (!pos) return null;
    return grid.get(`${pos.x},${pos.y}`) ?? null;
  }

  const anchor: MapAnchor = { minX, minY, maxX, maxY };
  return {
    rowCount: totalRows,
    colCount: totalCols,
    tiles,
    gridIndex: grid,
    resolve,
    tileAt,
    explorerDetails: explorerDetails ?? new Map(),
    structureDetails: structureDetails ?? new Map(),
    anchor,
  };
}
