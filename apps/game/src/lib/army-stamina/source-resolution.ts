import { StaminaManager } from "@bibliothecadao/eternum";
import { Troops, TroopTier, TroopType } from "@bibliothecadao/types";

import { ArmyStaminaSourceSnapshot } from "./types";

interface ExplorerStaminaSnapshotInput {
  currentArmiesTick: number;
  liveTroops?: Troops | null;
}

export const selectFreshestArmyStaminaSource = (input: {
  liveTroops?: Troops | null;
}): ArmyStaminaSourceSnapshot | null => {
  if (!input.liveTroops) return null;
  return {
    source: "live",
    amount: input.liveTroops.stamina?.amount ?? 0n,
    updatedTick: Number(input.liveTroops.stamina?.updated_tick ?? 0n),
    troopCount: Number(input.liveTroops.count ?? 0n),
    troops: input.liveTroops,
  };
};

const selectFreshestTroopsSnapshot = (input: { liveTroops?: Troops | null }): Troops | null =>
  selectFreshestArmyStaminaSource(input)?.troops ?? null;

export const getExplorerStaminaSnapshot = (
  input: ExplorerStaminaSnapshotInput,
): { current: number; max: number; stamina: { amount: bigint; updated_tick: bigint }; troops: Troops } | null => {
  const troops = selectFreshestTroopsSnapshot(input);
  if (!troops) return null;

  const stamina = StaminaManager.getStamina(troops, input.currentArmiesTick);
  return {
    current: Number(stamina.amount),
    max: StaminaManager.getMaxStamina(troops.category as TroopType, troops.tier as TroopTier, troops.staminaMax),
    stamina,
    troops,
  };
};
