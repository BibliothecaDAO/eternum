import { StaminaManager } from "@bibliothecadao/eternum";
import type { ID, Troops } from "@bibliothecadao/types";

import { getFreshPendingStaminaSource } from "./source-store";
import { selectFreshestArmyStaminaSource } from "./source-resolution";
import type { ArmyStaminaSourceKind, PendingArmyStaminaSourceSnapshot } from "./types";

interface MovementStaminaPathStep {
  staminaCost?: number | null;
}

interface MovementStaminaPendingInput {
  amount: bigint;
  updatedTick: number;
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
    pendingAmount?: number;
    pendingUpdatedTick?: number;
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
  pendingStamina?: MovementStaminaPendingInput | null;
}): MovementStaminaResolution => {
  const staminaCost = calculateMovementStaminaCost(input.actionPath);
  const pendingStamina = resolvePendingStamina(input.entityId, input.pendingStamina);
  const diagnostics = buildMovementStaminaDiagnostics({
    liveTroops: input.liveTroops,
    pendingStamina,
  });

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
    pendingStamina,
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

export const buildPendingMovementStaminaSource = (input: {
  entityId: ID;
  currentStamina: number;
  currentArmiesTick: number;
  staminaCost: number;
  capturedAtMs?: number;
}): PendingArmyStaminaSourceSnapshot | null => {
  if (!Number.isFinite(input.staminaCost) || input.staminaCost <= 0) {
    return null;
  }

  return {
    source: "pending",
    entityId: input.entityId,
    amount: BigInt(Math.max(0, Math.floor(input.currentStamina) - Math.floor(input.staminaCost))),
    updatedTick: input.currentArmiesTick,
    capturedAtMs: input.capturedAtMs ?? Date.now(),
  };
};

const resolvePendingStamina = (
  entityId: ID,
  pendingStamina?: MovementStaminaPendingInput | null,
): MovementStaminaPendingInput | null => {
  if (pendingStamina !== undefined) {
    return pendingStamina;
  }

  return getFreshPendingStaminaSource(entityId) ?? null;
};

const buildMovementStaminaDiagnostics = (input: {
  liveTroops?: Troops | null;
  pendingStamina?: MovementStaminaPendingInput | null;
}): MovementStaminaResolution["diagnostics"] => ({
  liveAmount: input.liveTroops?.stamina ? Number(input.liveTroops.stamina.amount) : undefined,
  liveUpdatedTick: input.liveTroops?.stamina ? Number(input.liveTroops.stamina.updated_tick) : undefined,
  pendingAmount: input.pendingStamina ? Number(input.pendingStamina.amount) : undefined,
  pendingUpdatedTick: input.pendingStamina?.updatedTick,
});

const canAffordStaminaCost = (currentStamina: number, staminaCost: number): boolean =>
  Math.floor(currentStamina) >= Math.floor(staminaCost);
