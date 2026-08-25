type AttackActionLabel = "Attack" | "Claim";

interface ResolveAttackStaminaStateInput {
  attackerStamina: bigint | number;
  hasAttackerTroops: boolean;
  hasDefenders: boolean;
  requiredStamina: number;
}

export interface AttackStaminaState {
  actionLabel: AttackActionLabel;
  currentStamina: number;
  hasAttackerTroops: boolean;
  hasRequiredStamina: boolean;
  isBlocked: boolean;
  requiredStamina: number;
}

export function resolveAttackStaminaState(input: ResolveAttackStaminaStateInput): AttackStaminaState {
  const currentStamina = Number(input.attackerStamina);
  const actionLabel: AttackActionLabel = input.hasDefenders ? "Attack" : "Claim";
  const hasRequiredStamina = currentStamina >= input.requiredStamina;
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
  return `Insufficient stamina: ${state.currentStamina} / ${state.requiredStamina} required to ${state.actionLabel.toLowerCase()}`;
}
