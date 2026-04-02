export interface TrackedArmyBattleState {
  battleCooldownEnd?: number;
  battleTimerLeft?: number;
  attackedFromDegrees?: number;
  attackedTowardDegrees?: number;
}

export interface TrackedArmyStaminaSnapshot extends TrackedArmyBattleState {
  troopCount: number;
  currentStamina: number;
  maxStamina: number;
  onChainStamina: {
    amount: bigint;
    updatedTick: number;
  };
}

interface ShouldAcceptTrackedArmyStaminaSnapshotInput {
  existing?: TrackedArmyStaminaSnapshot;
  incoming?: TrackedArmyStaminaSnapshot;
}

interface BuildTrackedArmyTileSyncInput {
  existing: TrackedArmyStaminaSnapshot;
  incoming: {
    troopCount?: number;
    currentStamina?: number;
    maxStamina?: number;
    onChainStamina?: {
      amount: bigint;
      updatedTick: number;
    };
    battleState?: TrackedArmyBattleState;
    owningStructureId?: number | null;
  };
  currentArmiesTick: number;
  recomputeCurrentStamina: (input: {
    troopCount: number;
    onChainStamina: {
      amount: bigint;
      updatedTick: number;
    };
    currentArmiesTick: number;
  }) => number;
}

interface TrackedArmyTileSyncResult extends TrackedArmyStaminaSnapshot {
  owningStructureId?: number | null;
}

export function shouldAcceptTrackedArmyStaminaSnapshot(input: ShouldAcceptTrackedArmyStaminaSnapshotInput): boolean {
  if (!input.incoming) {
    return false;
  }

  if (!input.existing) {
    return true;
  }

  const existingTick = input.existing.onChainStamina.updatedTick;
  const incomingTick = input.incoming.onChainStamina.updatedTick;

  if (incomingTick > existingTick) {
    return true;
  }

  if (incomingTick < existingTick) {
    return false;
  }

  return (
    input.incoming.troopCount !== input.existing.troopCount ||
    input.incoming.battleCooldownEnd !== input.existing.battleCooldownEnd ||
    input.incoming.battleTimerLeft !== input.existing.battleTimerLeft
  );
}

export function buildTrackedArmyTileSync(input: BuildTrackedArmyTileSyncInput): TrackedArmyTileSyncResult {
  const incomingSnapshot =
    input.incoming.onChainStamina !== undefined
      ? {
          troopCount: input.incoming.troopCount ?? input.existing.troopCount,
          currentStamina: input.incoming.currentStamina ?? input.existing.currentStamina,
          maxStamina: input.incoming.maxStamina ?? input.existing.maxStamina,
          onChainStamina: input.incoming.onChainStamina,
          battleCooldownEnd: input.incoming.battleState?.battleCooldownEnd ?? input.existing.battleCooldownEnd,
          battleTimerLeft: input.incoming.battleState?.battleTimerLeft ?? input.existing.battleTimerLeft,
          attackedFromDegrees: input.incoming.battleState?.attackedFromDegrees ?? input.existing.attackedFromDegrees,
          attackedTowardDegrees:
            input.incoming.battleState?.attackedTowardDegrees ?? input.existing.attackedTowardDegrees,
        }
      : undefined;

  const shouldAcceptSnapshot = shouldAcceptTrackedArmyStaminaSnapshot({
    existing: input.existing,
    incoming: incomingSnapshot,
  });

  const acceptedOnChainStamina =
    shouldAcceptSnapshot && input.incoming.onChainStamina
      ? input.incoming.onChainStamina
      : input.existing.onChainStamina;
  const acceptedTroopCount =
    shouldAcceptSnapshot && input.incoming.troopCount !== undefined
      ? input.incoming.troopCount
      : input.existing.troopCount;
  const acceptedCurrentStamina =
    shouldAcceptSnapshot && input.incoming.onChainStamina
      ? (input.incoming.currentStamina ??
        input.recomputeCurrentStamina({
          troopCount: acceptedTroopCount,
          onChainStamina: acceptedOnChainStamina,
          currentArmiesTick: input.currentArmiesTick,
        }))
      : input.existing.currentStamina;
  const acceptedMaxStamina =
    shouldAcceptSnapshot && input.incoming.maxStamina !== undefined
      ? input.incoming.maxStamina
      : input.existing.maxStamina;

  return {
    troopCount: acceptedTroopCount,
    currentStamina: acceptedCurrentStamina,
    maxStamina: acceptedMaxStamina,
    onChainStamina: acceptedOnChainStamina,
    battleCooldownEnd: input.incoming.battleState?.battleCooldownEnd ?? input.existing.battleCooldownEnd,
    battleTimerLeft: input.incoming.battleState?.battleTimerLeft ?? input.existing.battleTimerLeft,
    attackedFromDegrees: input.incoming.battleState?.attackedFromDegrees ?? input.existing.attackedFromDegrees,
    attackedTowardDegrees: input.incoming.battleState?.attackedTowardDegrees ?? input.existing.attackedTowardDegrees,
    owningStructureId: input.incoming.owningStructureId,
  };
}
