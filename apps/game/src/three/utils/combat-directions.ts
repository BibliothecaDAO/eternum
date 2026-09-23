import { HexPosition, ID } from "@bibliothecadao/types";
import { latticeToWorld } from "./hex-lattice";

interface CombatAngles {
  attackedFromDegrees?: number | null;
  attackTowardDegrees?: number | null;
}

/**
 * Calculate combat directions based on attacker and defender positions
 * @param targetPosition - The position of the entity being analyzed
 * @param latestAttackerId - The ID of the entity that attacked this position
 * @param latestDefenderId - The ID of the entity that this position attacked
 * @param defenderPosition - The position of the entity that attacked this position
 * @param attackerPosition - The position of the entity that this position attacked
 * @returns Object containing attackedFromDirection and attackedTowardDirection
 */
export function getCombatAngles(
  targetPosition: { col: number; row: number },
  latestAttackerId: ID | undefined,
  attackerPosition: { x: number; y: number } | undefined,
  latestDefenderId: ID | undefined,
  defenderPosition: { x: number; y: number } | undefined,
): CombatAngles {
  const result: CombatAngles = {};

  // Calculate direction from which this entity was attacked
  if (latestAttackerId) {
    if (attackerPosition) {
      result.attackedFromDegrees = getAngleBetweenHexPositions(targetPosition, {
        col: attackerPosition.x,
        row: attackerPosition.y,
      });
    }
  }

  // Calculate direction toward which this entity attacked
  if (latestDefenderId) {
    if (defenderPosition) {
      result.attackTowardDegrees = getAngleBetweenHexPositions(targetPosition, {
        col: defenderPosition.x,
        row: defenderPosition.y,
      });
    }
  }

  return result;
}

// returns direction angle
export const getAngleBetweenHexPositions = (fromHex: HexPosition, toHex: HexPosition): number => {
  // The angle depends only on the lattice difference between the two hexes, never on where the map is drawn.
  const { x: fromX, z: fromZ } = latticeToWorld(fromHex.col, fromHex.row);
  const { x: toX, z: toZ } = latticeToWorld(toHex.col, toHex.row);

  // Calculate direction vector
  const deltaX = toX - fromX;
  const deltaZ = toZ - fromZ;

  // Calculate angle and always return positive value
  const angleRadians = Math.atan2(deltaZ, deltaX);
  let angleDegrees = angleRadians * (180 / Math.PI);

  // Convert negative angles to positive [0, 360) range
  if (angleDegrees < 0) {
    angleDegrees += 360;
  }

  return angleDegrees;
};

/**
 * Convert offset coordinates to cube coordinates
 * Using even-r offset coordinate system
 */
function offsetToCube(col: number, row: number): { q: number; r: number; s: number } {
  const q = col - Math.floor((row - (row % 2)) / 2);
  const r = row;
  const s = -q - r;
  return { q, r, s };
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
