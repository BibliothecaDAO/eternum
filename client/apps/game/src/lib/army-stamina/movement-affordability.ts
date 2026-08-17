import { StaminaManager } from "@bibliothecadao/eternum";
import type { ID, Troops } from "@bibliothecadao/types";

import { selectFreshestArmyStaminaSource } from "./source-resolution";
import type { ArmyStaminaSourceKind } from "./types";

interface MovementStaminaPathStep {
  staminaCost?: number | null;
}

export interface MovementStaminaResolution {
  canAfford: boolean;
  staminaCost: number;
  currentStamina: number;
  currentArmiesTick: number;
  source: ArmyStaminaSourceKind | "none";
  diagnostics: {
    liveAmount?: number;
    liveUpdatedTick?: number;
  };
}

export const calculateMovementStaminaCost = (actionPath: MovementStaminaPathStep[]): number =>
  actionPath.reduce((total, pathStep) => {
    const staminaCost = pathStep.staminaCost ?? 0;
    return Number.isFinite(staminaCost) ? total + staminaCost : total;
  }, 0);

export const resolveMovementStamina = (input: {
  entityId: ID;
  actionPath: MovementStaminaPathStep[];
  currentArmiesTick: number;
  liveTroops?: Troops | null;
}): MovementStaminaResolution => {
  const staminaCost = calculateMovementStaminaCost(input.actionPath);
  const diagnostics = buildMovementStaminaDiagnostics(input.liveTroops);

  if (!Number.isFinite(staminaCost) || staminaCost <= 0) {
    return {
      canAfford: true,
      staminaCost,
      currentStamina: 0,
      currentArmiesTick: input.currentArmiesTick,
      source: "none",
      diagnostics,
    };
  }

  const selectedSource = selectFreshestArmyStaminaSource({
    entityId: input.entityId,
    liveTroops: input.liveTroops,
  });

  if (selectedSource?.troops) {
    const stamina = StaminaManager.getStamina(selectedSource.troops, input.currentArmiesTick);
    return {
      canAfford: canAffordStaminaCost(Number(stamina.amount), staminaCost),
      staminaCost,
      currentStamina: Number(stamina.amount),
      currentArmiesTick: input.currentArmiesTick,
      source: selectedSource.source,
      diagnostics,
    };
  }

  return {
    canAfford: false,
    staminaCost,
    currentStamina: 0,
    currentArmiesTick: input.currentArmiesTick,
    source: "none",
    diagnostics,
  };
};

const buildMovementStaminaDiagnostics = (liveTroops?: Troops | null): MovementStaminaResolution["diagnostics"] => ({
  liveAmount: liveTroops?.stamina ? Number(liveTroops.stamina.amount) : undefined,
  liveUpdatedTick: liveTroops?.stamina ? Number(liveTroops.stamina.updated_tick) : undefined,
});

const canAffordStaminaCost = (currentStamina: number, staminaCost: number): boolean =>
  Math.floor(currentStamina) >= Math.floor(staminaCost);
