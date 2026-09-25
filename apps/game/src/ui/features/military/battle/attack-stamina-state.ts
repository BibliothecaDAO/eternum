type AttackActionLabel = "Attack" | "Claim";

interface ResolveAttackStaminaStateInput {
  attackerStamina: bigint | number | undefined;
  hasAttackerTroops: boolean;
  hasDefenders: boolean;
  requiredStamina: number;
}

export interface AttackStaminaState {
  actionLabel: AttackActionLabel;
  currentStamina: number | undefined;
  hasAttackerTroops: boolean;
  hasRequiredStamina: boolean;
  isBlocked: boolean;
  requiredStamina: number;
}

export function resolveAttackStaminaState(input: ResolveAttackStaminaStateInput): AttackStaminaState {
  const currentStamina = input.attackerStamina === undefined ? undefined : Number(input.attackerStamina);
  const actionLabel: AttackActionLabel = input.hasDefenders ? "Attack" : "Claim";
  const hasRequiredStamina = currentStamina !== undefined && currentStamina >= input.requiredStamina;
  const isBlocked = input.hasAttackerTroops && !hasRequiredStamina;

  return {
    actionLabel,
    currentStamina,
    hasAttackerTroops: input.hasAttackerTroops,
    hasRequiredStamina,
    isBlocked,
    requiredStamina: input.requiredStamina,
  };
}

export function buildAttackStaminaRequirementLabel(state: AttackStaminaState): string {
  return `Need ${state.requiredStamina} stamina to ${state.actionLabel.toLowerCase()}`;
}

export function buildAttackStaminaWarning(state: AttackStaminaState): string {
  if (state.currentStamina === undefined)
    return `Stamina — / ${state.requiredStamina} required to ${state.actionLabel.toLowerCase()}`;
  return `Insufficient stamina: ${state.currentStamina} / ${state.requiredStamina} required to ${state.actionLabel.toLowerCase()}`;
}
