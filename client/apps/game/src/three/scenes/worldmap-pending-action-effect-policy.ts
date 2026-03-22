import { Direction, getNeighborHexes, HexPosition, ID } from "@bibliothecadao/types";

interface ShouldClearPendingCreateArmyEffectInput {
  pendingTargetHex: HexPosition;
  updateHex: HexPosition;
  removed: boolean;
}

interface ShouldClearPendingAttackEffectInput {
  pendingAttackerId: ID;
  pendingDefenderId?: ID;
  battleAttackerId?: ID;
  battleDefenderId?: ID;
}

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

export function shouldClearPendingCreateArmyEffect(input: ShouldClearPendingCreateArmyEffectInput): boolean {
  if (input.removed) {
    return false;
  }

  if (input.updateHex.col !== input.pendingTargetHex.col || input.updateHex.row !== input.pendingTargetHex.row) {
    return false;
  }

  return true;
}

export function shouldClearPendingAttackEffect(input: ShouldClearPendingAttackEffectInput): boolean {
  if (input.pendingAttackerId !== input.battleAttackerId) {
    return false;
  }

  if (input.pendingDefenderId !== undefined && input.pendingDefenderId !== input.battleDefenderId) {
    return false;
  }

  return true;
}
