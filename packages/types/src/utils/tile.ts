import type { Tile, TileOpt } from "../types/common";

export type TileDataInput = bigint | string | number;

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

const extractField = (data: bigint, shift: number, mask: bigint): bigint => (data >> BigInt(shift)) & mask;

const toBigInt = (value: TileDataInput): bigint => {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    return BigInt(Math.trunc(value));
  }
  return BigInt(value);
};

export const tileDataToTile = (dataInput: TileDataInput): Tile => {
  const data = toBigInt(dataInput);

  const occupier_is_structure = extractField(data, OCCUPIER_IS_STRUCTURE_SHIFT, OCCUPIER_IS_STRUCTURE_MASK) !== 0n;
  const occupier_type = Number(extractField(data, OCCUPIER_TYPE_SHIFT, OCCUPIER_TYPE_MASK));
  const occupier_id = Number(extractField(data, OCCUPIER_ID_SHIFT, OCCUPIER_ID_MASK));
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
};

export const tileOptToTile = (tileOpt: TileOpt): Tile => tileDataToTile(tileOpt.data);
