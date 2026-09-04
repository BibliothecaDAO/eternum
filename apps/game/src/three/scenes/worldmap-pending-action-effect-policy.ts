import { Direction, getNeighborHexes, HexPosition } from "@bibliothecadao/types";

export function resolveCreateArmyEffectTargetHex(
  structureHex: HexPosition | undefined,
  direction: Direction,
): HexPosition | null {
  if (!structureHex) {
    return null;
  }

  const match = getNeighborHexes(structureHex.col, structureHex.row).find(
    (neighbor) => neighbor.direction === direction,
  );
  if (!match) {
    return null;
  }

  return { col: match.col, row: match.row };
}
