import { MAX_U32 } from "../constants/market";

type TileDataInput = bigint | string | number;

const toBigInt = (value: TileDataInput): bigint => {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    return BigInt(Math.trunc(value));
  }
  return BigInt(value);
};

/**
 * Packs tile coordinates into the same collision-free seed format used on-chain:
 * [alt:1 bit | col:32 bits | row:32 bits]
 */
export const packTileSeed = ({ alt, col, row }: { alt: boolean; col: TileDataInput; row: TileDataInput }): bigint => {
  const colValue = toBigInt(col);
  const rowValue = toBigInt(row);

  if (colValue < 0n || colValue > MAX_U32) {
    throw new Error(`col out of u32 range: ${colValue.toString()}`);
  }
  if (rowValue < 0n || rowValue > MAX_U32) {
    throw new Error(`row out of u32 range: ${rowValue.toString()}`);
  }

  const altValue = alt ? 1n : 0n;
  return (altValue << 64n) + (colValue << 32n) + rowValue;
};
