import { Coord, getAllHexDirections, HexGrid } from "@bibliothecadao/types";

const BANK_STEPS_FROM_CENTER = 15 * 21;
const WORLD_CONFIG_OFFSET_STEP = 10;
const WORLD_CONFIG_OFFSET_MODULUS = BigInt(HexGrid.CENTER / 2);

export interface BankCoord {
  alt: boolean;
  x: number;
  y: number;
}

export function deriveMapCenterOffsetFromWorldConfigTx(txHash: string): number {
  const baseOffset = Number(BigInt(txHash) % WORLD_CONFIG_OFFSET_MODULUS);
  return Math.floor(baseOffset / WORLD_CONFIG_OFFSET_STEP) * WORLD_CONFIG_OFFSET_STEP;
}

export function buildBankCoordsForMapCenterOffset(mapCenterOffset: number): BankCoord[] {
  const center = new Coord(HexGrid.CENTER - mapCenterOffset, HexGrid.CENTER - mapCenterOffset);

  return getAllHexDirections().map((direction) => {
    const coord = center.travel(direction, BANK_STEPS_FROM_CENTER);
    return { alt: false, x: coord.x, y: coord.y };
  });
}
