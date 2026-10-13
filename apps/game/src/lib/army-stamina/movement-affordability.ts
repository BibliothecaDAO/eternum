import { StaminaManager } from "@bibliothecadao/eternum";
import type { Troops } from "@bibliothecadao/types";

import { selectFreshestArmyStaminaSource } from "./source-resolution";
import type { ArmyStaminaSourceKind } from "./types";

interface MovementStaminaPathStep {
  staminaCost?: number | null;
}

export interface MovementStaminaResolution {
  canAfford: boolean;
  staminaCost: number;
  currentStamina: number;
  timestamp: number;
  source: ArmyStaminaSourceKind | "none";
  diagnostics: {
    liveAmount?: number;
    liveSettledAt?: number;
  };
}

const calculateMovementStaminaCost = (actionPath: MovementStaminaPathStep[]): number =>
  actionPath.reduce((total, pathStep) => {
    const staminaCost = pathStep.staminaCost ?? 0;
    return Number.isFinite(staminaCost) ? total + staminaCost : total;
  }, 0);

export const resolveMovementStamina = (input: {
  actionPath: MovementStaminaPathStep[];
  timestamp: number;
  liveTroops?: Troops | null;
}): MovementStaminaResolution => {
  const staminaCost = calculateMovementStaminaCost(input.actionPath);
  const diagnostics = buildMovementStaminaDiagnostics(input.liveTroops);

  if (!Number.isFinite(staminaCost) || staminaCost <= 0) {
    return {
      canAfford: true,
      staminaCost,
      currentStamina: 0,
      timestamp: input.timestamp,
      source: "none",
      diagnostics,
    };
  }

  const selectedSource = selectFreshestArmyStaminaSource({ liveTroops: input.liveTroops });

  if (selectedSource?.troops) {
    const stamina = StaminaManager.getStamina(selectedSource.troops, input.timestamp);
    return {
      canAfford: canAffordStaminaCost(Number(stamina.amount), staminaCost),
      staminaCost,
      currentStamina: Number(stamina.amount),
      timestamp: input.timestamp,
      source: selectedSource.source,
      diagnostics,
    };
  }

  return {
    canAfford: false,
    staminaCost,
    currentStamina: 0,
    timestamp: input.timestamp,
    source: "none",
    diagnostics,
  };
};

const buildMovementStaminaDiagnostics = (liveTroops?: Troops | null): MovementStaminaResolution["diagnostics"] => ({
  liveAmount: liveTroops?.stamina ? Number(liveTroops.stamina.amount) : undefined,
  liveSettledAt: liveTroops?.stamina ? liveTroops.stamina.settled_at : undefined,
});

const canAffordStaminaCost = (currentStamina: number, staminaCost: number): boolean =>
  Math.floor(currentStamina) >= Math.floor(staminaCost);
