import { StaminaManager } from "@bibliothecadao/eternum";
import type { Troops } from "@bibliothecadao/types";

export interface ArmyStaminaSnapshot {
  currentStamina: number;
  onChainStamina: {
    amount: bigint;
    updatedTick: number;
  };
}

interface ResolveAuthoritativeArmyStaminaInput {
  currentArmiesTick: number;
  fallbackCurrentStamina: number;
  fallbackOnChainStamina: {
    amount: bigint;
    updatedTick: number;
  };
  liveTroops?: Troops;
}

export const resolveAuthoritativeArmyStamina = ({
  currentArmiesTick,
  fallbackCurrentStamina,
  fallbackOnChainStamina,
  liveTroops,
}: ResolveAuthoritativeArmyStaminaInput): ArmyStaminaSnapshot => {
  if (!liveTroops) {
    return {
      currentStamina: fallbackCurrentStamina,
      onChainStamina: fallbackOnChainStamina,
    };
  }

  const liveOnChainStamina = {
    amount: BigInt(liveTroops.stamina.amount),
    updatedTick: Number(liveTroops.stamina.updated_tick),
  };

  // Prefer the freshest stamina source to prevent stale map-data values from overriding live ECS state.
  if (liveOnChainStamina.updatedTick >= fallbackOnChainStamina.updatedTick) {
    const currentStamina = Number(StaminaManager.getStamina(liveTroops, currentArmiesTick).amount);
    return {
      currentStamina,
      onChainStamina: liveOnChainStamina,
    };
  }

  return {
    currentStamina: fallbackCurrentStamina,
    onChainStamina: fallbackOnChainStamina,
  };
};
