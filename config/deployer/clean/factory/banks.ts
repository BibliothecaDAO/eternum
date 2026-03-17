import { HexGrid } from "@bibliothecadao/types";
import { shortString } from "starknet";
import { BANK_COUNT, BANK_NAME_PREFIX, BANK_STEPS_FROM_CENTER } from "../constants";

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
