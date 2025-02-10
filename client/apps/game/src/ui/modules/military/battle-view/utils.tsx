import { getTotalTroops } from "@/ui/modules/military/battle-view/battle-history";
import { roundDownToPrecision } from "@/ui/utils/utils";
import {
  ClientComponents,
  configManager,
  Percentage,
  ResourcesIds,
  Troops as SdkTroops,
} from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";

type ArmyBattleInfo = {
  troops: {
    knight_count: bigint;
    paladin_count: bigint;
    crossbowman_count: bigint;
  };
  health: { current: bigint; lifetime: bigint };
};

export const getChancesOfSuccess = (
  attackerArmy: ArmyBattleInfo | undefined,
  defenderArmy: ArmyBattleInfo | undefined,
  troopConfig: ComponentValue<ClientComponents["TroopConfig"]["schema"]>,
) => {
  if (!attackerArmy || !defenderArmy) {
    return attackerArmy ? 1 : 0;
  }

  const attackingArmyStrength = Number(
    fullStrength(attackerArmy.troops, troopConfig) * percentageLeft(attackerArmy.health),
  );
  const defendingArmyStrength = Number(
    fullStrength(defenderArmy.troops, troopConfig) * percentageLeft(defenderArmy.health),
  );

  const attackSuccessProbability =
    attackingArmyStrength / Math.max(Number(attackingArmyStrength + defendingArmyStrength), 1);
  return attackSuccessProbability;
};

function fullStrength(
  troops: SdkTroops,
  troopConfig: ComponentValue<ClientComponents["TroopConfig"]["schema"]>,
): bigint {
  const knightCount = BigInt(troops.knight_count);
  const paladinCount = BigInt(troops.paladin_count);
  const crossbowmanCount = BigInt(troops.crossbowman_count);
  const totalKnightStrength = BigInt(troopConfig.knight_strength) * knightCount;
  const totalPaladinStrength = BigInt(troopConfig.paladin_strength) * paladinCount;
  const totalCrossbowmanStrength = BigInt(troopConfig.crossbowman_strength) * crossbowmanCount;

  return totalKnightStrength + totalPaladinStrength + totalCrossbowmanStrength;
}

function percentageLeft(health: { current: bigint; lifetime: bigint }): bigint {
  if (health.lifetime === 0n) {
    return 0n;
  }
  return (health.current * BigInt(Percentage._100())) / health.lifetime;
}

export const getMaxResourceAmountStolen = (
  attackerArmy: ArmyBattleInfo | undefined,
  defenderArmy: ArmyBattleInfo | undefined,
  troopConfig: ComponentValue<ClientComponents["TroopConfig"]["schema"]>,
) => {
  if (!attackerArmy) return 0;
  const attackingTroops = getTotalTroops(attackerArmy.troops) / configManager.getResourcePrecision();
  return Math.floor(attackingTroops * getChancesOfSuccess(attackerArmy, defenderArmy, troopConfig));
};

export const calculateRemainingTroops = (
  armyInfo: { troops: { crossbowman_count: bigint; knight_count: bigint; paladin_count: bigint } },
  troopLosses: { crossbowmanLost: number; knightLost: number; paladinLost: number },
) => {
  return {
    [ResourcesIds.Crossbowman]: roundDownToPrecision(
      armyInfo.troops.crossbowman_count - BigInt(troopLosses.crossbowmanLost),
      configManager.getResourcePrecision(),
    ),
    [ResourcesIds.Knight]: roundDownToPrecision(
      armyInfo.troops.knight_count - BigInt(troopLosses.knightLost),
      configManager.getResourcePrecision(),
    ),
    [ResourcesIds.Paladin]: roundDownToPrecision(
      armyInfo.troops.paladin_count - BigInt(troopLosses.paladinLost),
      configManager.getResourcePrecision(),
    ),
  };
};
