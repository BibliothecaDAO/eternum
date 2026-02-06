export interface ComputeStaminaParams {
  currentAmount: number;
  lastUpdateTick: number;
  currentTick: number;
  maxStamina: number;
  regenPerTick: number;
  boost?: number;
}

export interface ComputeStaminaResult {
  current: number;
  max: number;
  ticksUntilFull: number;
}

export function computeStamina(params: ComputeStaminaParams): ComputeStaminaResult {
  const effectiveRegen = params.regenPerTick + (params.boost ?? 0);
  const ticksElapsed = Math.max(0, params.currentTick - params.lastUpdateTick);

  const regenerated = ticksElapsed * effectiveRegen;
  const current = Math.min(params.maxStamina, params.currentAmount + regenerated);

  const remaining = params.maxStamina - current;

  let ticksUntilFull: number;
  if (remaining <= 0) {
    ticksUntilFull = 0;
  } else if (effectiveRegen <= 0) {
    ticksUntilFull = Infinity;
  } else {
    ticksUntilFull = Math.ceil(remaining / effectiveRegen);
  }

  return {
    current,
    max: params.maxStamina,
    ticksUntilFull,
  };
}
