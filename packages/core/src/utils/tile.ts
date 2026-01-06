import type { ClientComponents, ID, Tile, TileOpt } from "@bibliothecadao/types";
import { getComponentValue, type Entity } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";

/**
 * Default alt value for standard hex coordinates (non-alt map)
 */
export const DEFAULT_COORD_ALT = false;

/**
 * Bit shift and mask constants matching the Cairo contract implementation
 * Layout (LSB -> MSB): occupier_is_structure, occupier_type, occupier_id, biome, row, col, reward_extracted, ... , alt (bit 127).
 */
const OCCUPIER_IS_STRUCTURE_SHIFT = 0;
const OCCUPIER_IS_STRUCTURE_MASK = 0x1n;

const OCCUPIER_TYPE_SHIFT = 1;
const OCCUPIER_TYPE_MASK = 0xffn;

const OCCUPIER_ID_SHIFT = 9;
const OCCUPIER_ID_MASK = 0xffffffffn;

const BIOME_SHIFT = 41;
const BIOME_MASK = 0xffn;

const ROW_SHIFT = 49;
const ROW_MASK = 0xffffffffn;

const COL_SHIFT = 81;
const COL_MASK = 0xffffffffn;

const REWARD_EXTRACTED_SHIFT = 113;
const REWARD_EXTRACTED_MASK = 0x1n;

const ALT_SHIFT = 127;
const ALT_MASK = 0x1n;

/**
 * Extract a field value from packed data using bitwise operations
 */
function extractField(data: bigint, shift: number, mask: bigint): bigint {
  return (data >> BigInt(shift)) & mask;
}

/**
 * Convert a TileOpt (optimized/packed) to a Tile (unpacked) structure.
 * This function mirrors the Cairo contract's TileOptIntoTile implementation.
 *
 * @param tileOpt - The optimized tile data from the contract
 * @returns Unpacked Tile with all fields extracted
 */
export function tileOptToTile(tileOpt?: TileOpt): Tile {
  if (!tileOpt) {return null as unknown as Tile;}

  const { data } = tileOpt;

  const occupier_is_structure = extractField(data, OCCUPIER_IS_STRUCTURE_SHIFT, OCCUPIER_IS_STRUCTURE_MASK) !== 0n;
  const occupier_type = Number(extractField(data, OCCUPIER_TYPE_SHIFT, OCCUPIER_TYPE_MASK));
  const occupier_id = Number(extractField(data, OCCUPIER_ID_SHIFT, OCCUPIER_ID_MASK)) as ID;
  const biome = Number(extractField(data, BIOME_SHIFT, BIOME_MASK));
  const row = Number(extractField(data, ROW_SHIFT, ROW_MASK));
  const col = Number(extractField(data, COL_SHIFT, COL_MASK));
  const reward_extracted = extractField(data, REWARD_EXTRACTED_SHIFT, REWARD_EXTRACTED_MASK) !== 0n;
  const alt = extractField(data, ALT_SHIFT, ALT_MASK) !== 0n;

  return {
    alt,
    col,
    row,
    biome,
    occupier_id,
    occupier_type,
    occupier_is_structure,
    reward_extracted,
  };
}

/**
 * Get a Tile component value and automatically convert from TileOpt to Tile.
 * Use this function instead of `getComponentValue(components.Tile, ...)` to ensure
 * proper conversion from the optimized contract representation to the client representation.
 *
 * @param components - The ClientComponents object
 * @param entity - The entity to query
 * @returns The unpacked Tile or undefined if not found
 */
export function getTileComponentValue(
  components: ClientComponents,
  entity: Entity,
): Tile | undefined {
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
export function getTileAt(
  components: ClientComponents,
  alt: boolean,
  col: number,
  row: number,
): Tile | undefined {
  const entity = getEntityIdFromKeys([BigInt(alt ? 1 : 0), BigInt(col), BigInt(row)]);
  return getTileComponentValue(components, entity);
}
