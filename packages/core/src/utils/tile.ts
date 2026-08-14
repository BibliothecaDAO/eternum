import type { ClientComponents, Tile, TileOpt } from "@bibliothecadao/types";
import { getComponentValue, type Entity } from "@dojoengine/recs";
import { gameEntityKey } from "../managers/config-manager";
import { tileOptToTile } from "./tile-opt";

export { tileOptToTile } from "./tile-opt";

/**
 * Default alt value for standard hex coordinates (non-alt map)
 */
export const DEFAULT_COORD_ALT = false;

/**
 * Get a Tile component value and automatically convert from TileOpt to Tile.
 * Use this function instead of `getComponentValue(components.Tile, ...)` to ensure
 * proper conversion from the optimized contract representation to the client representation.
 *
 * @param components - The ClientComponents object
 * @param entity - The entity to query
 * @returns The unpacked Tile or undefined if not found
 */
export function getTileComponentValue(components: ClientComponents, entity: Entity): Tile | undefined {
  const tileOpt = getComponentValue(components.TileOpt, entity) as TileOpt | undefined;
  return tileOpt ? tileOptToTile(tileOpt) : undefined;
}

/**
 * Get a Tile at the specified hex coordinates.
 * This is a convenience function that handles entity key creation and TileOpt conversion.
 *
 * @param components - The ClientComponents object
 * @param alt - Whether this is an alt map coordinate (default: false)
 * @param col - The column coordinate
 * @param row - The row coordinate
 * @returns The unpacked Tile or undefined if not found
 */
export function getTileAt(components: ClientComponents, alt: boolean, col: number, row: number): Tile | undefined {
  const entity = gameEntityKey([BigInt(alt ? 1 : 0), BigInt(col), BigInt(row)]);
  return getTileComponentValue(components, entity);
}
