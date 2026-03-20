import { HexGrid } from "@bibliothecadao/types";
import { shortString } from "starknet";

const BANK_COUNT = 6;
const BANK_STEPS_FROM_CENTER = 15 * 21;
const BANK_NAME_PREFIX = "Central Bank";

export interface BankDefinition {
  name: string;
  coord: {
    alt: boolean;
    x: number;
    y: number;
  };
}

export function buildDefaultBanks(): BankDefinition[] {
  const distantCoords = HexGrid.findHexCoordsfromCenter(BANK_STEPS_FROM_CENTER);
  const bankCoords = Object.values(distantCoords).map((coord) => ({
    alt: false,
    x: coord.x,
    y: coord.y,
  }));

  return Array.from({ length: BANK_COUNT }, (_, index) => ({
    name: shortString.encodeShortString(`${BANK_NAME_PREFIX} ${index + 1}`),
    coord: bankCoords[index],
  }));
}
