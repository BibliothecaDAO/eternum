import type { ID, Tile, TileOpt } from "@bibliothecadao/types";

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

const extractPackedTileField = (data: bigint, shift: number, mask: bigint): bigint => (data >> BigInt(shift)) & mask;

/** Decode the contract's packed TileOpt representation without runtime dependencies. */
export function tileOptToTile(tileOpt?: TileOpt): Tile {
  if (!tileOpt) return null as unknown as Tile;

  const { data } = tileOpt;
  return {
    alt: extractPackedTileField(data, ALT_SHIFT, ALT_MASK) !== 0n,
    col: Number(extractPackedTileField(data, COL_SHIFT, COL_MASK)),
    row: Number(extractPackedTileField(data, ROW_SHIFT, ROW_MASK)),
    biome: Number(extractPackedTileField(data, BIOME_SHIFT, BIOME_MASK)),
    occupier_id: Number(extractPackedTileField(data, OCCUPIER_ID_SHIFT, OCCUPIER_ID_MASK)) as ID,
    occupier_type: Number(extractPackedTileField(data, OCCUPIER_TYPE_SHIFT, OCCUPIER_TYPE_MASK)),
    occupier_is_structure: extractPackedTileField(data, OCCUPIER_IS_STRUCTURE_SHIFT, OCCUPIER_IS_STRUCTURE_MASK) !== 0n,
    reward_extracted: extractPackedTileField(data, REWARD_EXTRACTED_SHIFT, REWARD_EXTRACTED_MASK) !== 0n,
  };
}
