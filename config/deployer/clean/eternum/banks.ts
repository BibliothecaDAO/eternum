import { Coord, getAllHexDirections, HexGrid } from "@bibliothecadao/types";
import { shortString } from "starknet";

export const BANK_COUNT = 6;
export const BANK_STEPS_FROM_CENTER = 15 * 21;
export const BANK_NAME_PREFIX = "Central Bank";
const WORLD_CONFIG_OFFSET_STEP = 10;
const WORLD_CONFIG_OFFSET_MODULUS = BigInt(HexGrid.CENTER / 2);

export interface BankCoord {
  alt: boolean;
  x: number;
  y: number;
}

export interface BankDefinition {
  name: string;
  coord: BankCoord;
}

function buildBankName(index: number): string {
  return `${BANK_NAME_PREFIX} ${index + 1}`;
}

function toBankCoord(coord: Coord): BankCoord {
  return {
    alt: false,
    x: coord.x,
    y: coord.y,
  };
}

export function deriveMapCenterOffsetFromWorldConfigTx(txHash: string): number {
  const baseOffset = Number(BigInt(txHash) % WORLD_CONFIG_OFFSET_MODULUS);
  return Math.floor(baseOffset / WORLD_CONFIG_OFFSET_STEP) * WORLD_CONFIG_OFFSET_STEP;
}

export function resolveMapCenterCoord(mapCenterOffset: number): Coord {
  return new Coord(HexGrid.CENTER - mapCenterOffset, HexGrid.CENTER - mapCenterOffset);
}

export function buildBankCoordsForMapCenterOffset(mapCenterOffset: number): BankCoord[] {
  const center = resolveMapCenterCoord(mapCenterOffset);
  return getAllHexDirections().map((direction) => toBankCoord(center.travel(direction, BANK_STEPS_FROM_CENTER)));
}

export function buildBanksForMapCenterOffset(mapCenterOffset: number): BankDefinition[] {
  const bankCoords = buildBankCoordsForMapCenterOffset(mapCenterOffset);

  return Array.from({ length: BANK_COUNT }, (_, index) => ({
    name: shortString.encodeShortString(buildBankName(index)),
    coord: bankCoords[index],
  }));
}
