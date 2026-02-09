const DEFENDER_PENALTY = 0.7;

export function computeStrength(troopCount: number, tier: number): number {
  return troopCount * tier;
}

export function computeStaminaModifier(
  stamina: number,
  isAttacker: boolean,
  attackReq: number,
  defenseReq: number,
): number {
  const required = isAttacker ? attackReq : defenseReq;

  if (stamina >= required) {
    return 1;
  }

  if (isAttacker) {
    return 0;
  }

  return DEFENDER_PENALTY;
}

export function computeCooldownModifier(cooldownEnd: number, currentTime: number, isAttacker: boolean): number {
  if (currentTime >= cooldownEnd) {
    return 1;
  }

  if (isAttacker) {
    return 0;
  }

  return DEFENDER_PENALTY;
}
