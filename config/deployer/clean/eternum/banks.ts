import { shortString } from "starknet";

const BANK_COUNT = 6;
const BANK_STEPS_FROM_CENTER = 15 * 21;
const BANK_NAME_PREFIX = "Central Bank";
const WORLD_CENTER_COORDINATE = 2_147_483_646;

type HexDirection = "east" | "northEast" | "northWest" | "west" | "southWest" | "southEast";

const BANK_DIRECTIONS: readonly HexDirection[] = ["east", "northEast", "northWest", "west", "southWest", "southEast"];

interface OffsetCoord {
  x: number;
  y: number;
}

export interface BankDefinition {
  name: string;
  coord: {
    alt: boolean;
    x: number;
    y: number;
  };
}

function resolveDefaultBankCoordinates(): BankDefinition["coord"][] {
  return BANK_DIRECTIONS.map((direction) => ({
    alt: false,
    ...travelFromCenter(direction, BANK_STEPS_FROM_CENTER),
  }));
}

function travelFromCenter(direction: HexDirection, steps: number): OffsetCoord {
  let current: OffsetCoord = {
    x: WORLD_CENTER_COORDINATE,
    y: WORLD_CENTER_COORDINATE,
  };

  for (let step = 0; step < steps; step += 1) {
    current = moveToNeighbor(current, direction);
  }

  return current;
}

function moveToNeighbor(coord: OffsetCoord, direction: HexDirection): OffsetCoord {
  const isEvenRow = coord.y % 2 === 0;

  switch (direction) {
    case "east":
      return { x: coord.x + 1, y: coord.y };
    case "northEast":
      return isEvenRow ? { x: coord.x + 1, y: coord.y + 1 } : { x: coord.x, y: coord.y + 1 };
    case "northWest":
      return isEvenRow ? { x: coord.x, y: coord.y + 1 } : { x: coord.x - 1, y: coord.y + 1 };
    case "west":
      return { x: coord.x - 1, y: coord.y };
    case "southWest":
      return isEvenRow ? { x: coord.x, y: coord.y - 1 } : { x: coord.x - 1, y: coord.y - 1 };
    case "southEast":
      return isEvenRow ? { x: coord.x + 1, y: coord.y - 1 } : { x: coord.x, y: coord.y - 1 };
  }
}

export function buildDefaultBanks(): BankDefinition[] {
  // Keep bank generation self-contained so the clean launcher can run from the repo root in CI.
  const bankCoords = resolveDefaultBankCoordinates();

  return Array.from({ length: BANK_COUNT }, (_, index) => ({
    name: shortString.encodeShortString(`${BANK_NAME_PREFIX} ${index + 1}`),
    coord: bankCoords[index],
  }));
}
