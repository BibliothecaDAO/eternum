import { Direction, getDirectionBetweenAdjacentHexes, ID } from "@bibliothecadao/types";

export interface CombatDirections {
  attackedFromDirection?: Direction | null;
  attackedTowardDirection?: Direction | null;
}

/**
 * Calculate combat directions based on attacker and defender positions
 * @param targetPosition - The position of the entity being analyzed
 * @param latestAttackerId - The ID of the entity that attacked this position
 * @param latestDefenderId - The ID of the entity that this position attacked
 * @param getEntityPosition - Function to get an entity's position by ID
 * @returns Object containing attackedFromDirection and attackedTowardDirection
 */
export function getCombatDirections(
  targetPosition: { col: number; row: number },
  latestAttackerId: ID | undefined,
  latestDefenderId: ID | undefined,
  getEntityPosition: (entityId: ID) => { x: number; y: number } | undefined,
): CombatDirections {
  const result: CombatDirections = {};

  // Calculate direction from which this entity was attacked
  if (latestAttackerId) {
    const attackerPosition = getEntityPosition(latestAttackerId);
    if (attackerPosition) {
      result.attackedFromDirection = getDirectionBetweenAdjacentHexes(targetPosition, {
        col: attackerPosition.x,
        row: attackerPosition.y,
      });
    }
  }

  // Calculate direction toward which this entity attacked
  if (latestDefenderId) {
    const defenderPosition = getEntityPosition(latestDefenderId);
    if (defenderPosition) {
      result.attackedTowardDirection = getDirectionBetweenAdjacentHexes(targetPosition, {
        col: defenderPosition.x,
        row: defenderPosition.y,
      });
    }
  }

  return result;
}

/**
 * Calculate time left from battle cooldown end timestamp
 * @param battleCooldownEnd - Unix timestamp when battle cooldown ends
 * @param currentTimestamp - Current unix timestamp (optional, defaults to Date.now())
 * @returns Time left in seconds, or undefined if cooldown has ended
 */
export function getBattleTimerLeft(
  battleCooldownEnd: number | undefined,
  currentTimestamp: number = Math.floor(Date.now() / 1000),
): number | undefined {
  if (!battleCooldownEnd || battleCooldownEnd <= currentTimestamp) {
    return undefined;
  }
  return battleCooldownEnd - currentTimestamp;
}
