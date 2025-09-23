import { HexPosition, ID } from "@bibliothecadao/types";
import { HEX_SIZE } from "../constants";

export interface CombatAngles {
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
  // Calculate hex coordinate differences
  const hexRadius = HEX_SIZE;
  const hexHeight = hexRadius * 2;
  const hexWidth = Math.sqrt(3) * hexRadius;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;

  // Calculate world positions directly
  const fromRowOffset = ((fromHex.row % 2) * Math.sign(fromHex.row) * horizDist) / 2;
  const toRowOffset = ((toHex.row % 2) * Math.sign(toHex.row) * horizDist) / 2;

  const fromX = fromHex.col * horizDist - fromRowOffset;
  const fromZ = fromHex.row * vertDist;

  const toX = toHex.col * horizDist - toRowOffset;
  const toZ = toHex.row * vertDist;

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
